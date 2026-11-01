import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { appOrigin } from "@/lib/app-origin"
import { extractChannelRunConfig } from "@/lib/channel-run-config"

export const maxDuration = 60

const MAX_QUESTION_LENGTH = 4_000

function corsHeaders(request: NextRequest): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  })
  const origin = request.headers.get("origin")
  if (origin) headers.set("Access-Control-Allow-Origin", origin)
  return headers
}

function json(request: NextRequest, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders(request) })
}

function safeOrigin(value: unknown): string {
  try {
    const url = new URL(String(value || ""))
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : ""
  } catch {
    return ""
  }
}

function assistantText(content: unknown): string {
  if (typeof content === "string") return content.trim()
  if (!Array.isArray(content)) return ""
  return content
    .filter(
      (part) =>
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string",
    )
    .map((part) => String(part.text))
    .join("\n")
    .trim()
}

function lastAssistantAnswer(state: any): string {
  const messages = state?.values?.messages ?? state?.messages
  if (!Array.isArray(messages)) return ""
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    const role = String(message?.type || message?.role || "").toLowerCase()
    if (role !== "ai" && role !== "assistant") continue
    const text = assistantText(message?.content)
    if (text) return text
  }
  return ""
}

function publicKnowledgeApps(apps: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(apps).filter(([, config]) => {
      if (!config || typeof config !== "object" || Array.isArray(config)) return false
      const type = String(config.tool_type || "").trim().toLowerCase()
      return type === "knowledge"
    }),
  )
}

function distributionConfig(agent: any): Record<string, any> {
  const meta = agent?.metadata || agent?.rawData?.metadata || {}
  const channel = meta?.distributionChannel || meta?.distribution_channel || {}
  const config = channel?.config || channel?.configuration || {}
  if (!config || typeof config !== "object" || Array.isArray(config)) return {}
  return {
    ...config,
    allowedSystemTools: [],
    allowed_system_tools: [],
    allowMemorySearch: false,
    allowFileUpload: false,
    allowWorkspaceTools: false,
    allowCodeExecution: false,
  }
}

async function drain(response: Response): Promise<void> {
  if (!response.body) return
  const reader = response.body.getReader()
  try {
    while (!(await reader.read()).done) {
      // Consume the SSE stream so the run is allowed to finish.
    }
  } finally {
    reader.releaseLock()
  }
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return json(request, { error: "invalid_json", message: "Invalid JSON body." }, 400)
  }

  const agent = String(body?.agent || "").trim()
  const question = String(body?.question || "").trim()
  const language = String(body?.language || "").trim().slice(0, 35)
  const pageUrl = String(body?.pageUrl || "").trim().slice(0, 2_000)
  const pageTitle = String(body?.pageTitle || "").trim().slice(0, 300)
  const sessionToken = String(body?.sessionToken || "").trim()

  if (!agent || agent.length > 200) {
    return json(request, { error: "invalid_agent", message: "A valid agent id is required." }, 400)
  }
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return json(
      request,
      { error: "invalid_question", message: `Question must contain 1-${MAX_QUESTION_LENGTH} characters.` },
      400,
    )
  }
  if (!/^[a-zA-Z0-9._~-]{32,256}$/.test(sessionToken)) {
    return json(request, { error: "invalid_session", message: "A valid embed session is required." }, 400)
  }

  const origin = request.headers.get("origin") || safeOrigin(pageUrl)
  const baseUrl = appOrigin(request)
  const commonHeaders = new Headers({
    "Content-Type": "application/json",
    "X-Embed-Session": sessionToken,
    "X-Embed-Agent-Id": agent,
  })
  if (origin) commonHeaders.set("Origin", origin)
  if (pageUrl) commonHeaders.set("Referer", pageUrl)

  try {
    const encodedAgent = encodeURIComponent(agent)
    const agentResponse = await fetch(`${baseUrl}/api/embed-proxy/assistants/${encodedAgent}`, {
      headers: commonHeaders,
      cache: "no-store",
    })
    if (!agentResponse.ok) {
      return json(
        request,
        {
          error: agentResponse.status === 404 ? "agent_not_found" : "agent_unavailable",
          message: "The website expert is not available.",
        },
        agentResponse.status === 404 ? 404 : 502,
      )
    }
    const agentData = await agentResponse.json()
    const channelConfig = distributionConfig(agentData)
    if (channelConfig.password_protected === true) {
      return json(
        request,
        {
          error: "agent_requires_authentication",
          message: "Password-protected embeds are not available to external site tools.",
        },
        401,
      )
    }

    const threadResponse = await fetch(`${baseUrl}/api/embed-proxy/threads`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({}),
      cache: "no-store",
    })
    if (!threadResponse.ok) {
      return json(request, { error: "thread_create_failed", message: "Could not start the query." }, 502)
    }
    const thread = await threadResponse.json()
    const threadId = String(thread?.thread_id || "").trim()
    if (!threadId) {
      return json(request, { error: "thread_create_failed", message: "Could not start the query." }, 502)
    }

    const runConfig = extractChannelRunConfig(agentData)
    const apps = publicKnowledgeApps(runConfig.apps)
    const expertId =
      agentData?.metadata?.expert_id ??
      agentData?.metadata?.expertId ??
      agentData?.rawData?.metadata?.expert_id
    const ownerId =
      agentData?.owner ??
      agentData?.owner_id ??
      agentData?.metadata?.owner ??
      agentData?.rawData?.owner
    const cleanOwner = String(ownerId || "").replace(/[|\-]/g, "")
    const cleanExpert = String(expertId || agent).replace(/[|\-]/g, "")
    const entityId = `anonymoususer_${cleanExpert}`
    const knowledgeEntityId = cleanOwner && expertId ? `${cleanOwner}_${expertId}` : undefined
    const requestId = crypto.randomUUID()
    const systemMessage = [
      runConfig.systemMessage || "Answer from the approved public knowledge.",
      "This request comes from an external website agent.",
      "Only provide public information. Never perform write actions or claim that an action was executed.",
      "If the approved knowledge does not support an answer, say so clearly.",
      pageTitle ? `Current page title: ${pageTitle}` : "",
      pageUrl ? `Current page URL: ${pageUrl}` : "",
      language ? `Preferred response language: ${language}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")

    const distributionChannel = {
      type: "Embed",
      config: channelConfig,
    }
    const streamBody = {
      assistant_id: agent,
      input: {
        messages: [{ type: "human", content: question }],
        entity_id: entityId,
        ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
        user_id: "anonymous-agent-user",
        agent_id: agent,
        ...(Object.keys(apps).length ? { apps } : {}),
      },
      config: {
        configurable: {
          assistant_id: agent,
          agent_id: agent,
          user_id: "anonymous-agent-user",
          entity_id: entityId,
          ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
          temperature: 0.2,
          max_tokens: 1_024,
          instructions: runConfig.instructions || "Be accurate, concise, and source-grounded.",
          system_message: systemMessage,
          ...(runConfig.responseModel ? { response_model: runConfig.responseModel } : {}),
          ...(runConfig.queryModel ? { query_model: runConfig.queryModel } : {}),
          ...(runConfig.responseModelBaseUrl
            ? { response_model_base_url: runConfig.responseModelBaseUrl }
            : {}),
          ...(runConfig.queryModelBaseUrl
            ? { query_model_base_url: runConfig.queryModelBaseUrl }
            : {}),
          ...(runConfig.userProviderKeyId
            ? { user_provider_key_id: runConfig.userProviderKeyId }
            : {}),
          ...(runConfig.responseModelProviderKeyRef
            ? { response_model_provider_key_ref: runConfig.responseModelProviderKeyRef }
            : {}),
          ...(Object.keys(apps).length ? { apps } : {}),
          distribution_channel: distributionChannel,
        },
      },
      stream_mode: ["messages", "updates"],
      stream_subgraphs: true,
      subgraphs: true,
      on_disconnect: "cancel",
      metadata: {
        source: "webmcp",
        request_id: requestId,
        agent_id: agent,
        ...(expertId != null ? { expert_id: String(expertId) } : {}),
        page_origin: safeOrigin(pageUrl),
      },
    }

    const streamResponse = await fetch(
      `${baseUrl}/api/embed-proxy/threads/${encodeURIComponent(threadId)}/runs/stream`,
      {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(streamBody),
        cache: "no-store",
      },
    )
    if (!streamResponse.ok) {
      const error = await streamResponse.json().catch(() => null)
      const status = streamResponse.status === 402 || streamResponse.status === 429
        ? streamResponse.status
        : 502
      return json(
        request,
        {
          error: error?.error || "query_failed",
          message: error?.message || "The website expert could not answer this query.",
        },
        status,
      )
    }
    await drain(streamResponse)

    let answer = ""
    for (const delay of [0, 250, 750]) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      const stateResponse = await fetch(
        `${baseUrl}/api/embed-proxy/threads/${encodeURIComponent(threadId)}/state`,
        { headers: commonHeaders, cache: "no-store" },
      )
      if (!stateResponse.ok) continue
      answer = lastAssistantAnswer(await stateResponse.json())
      if (answer) break
    }
    if (!answer) {
      return json(
        request,
        { error: "empty_answer", message: "The website expert returned no answer." },
        502,
      )
    }

    return json(request, {
      answer,
      agent: {
        id: agent,
        name: String(agentData?.name || agentData?.title || "Website Expert"),
      },
      context: {
        pageUrl: pageUrl || null,
        language: language || null,
      },
      requestId,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[AgentQuery] Query failed:", error)
    return json(
      request,
      { error: "query_unavailable", message: "The website expert is temporarily unavailable." },
      502,
    )
  }
}
