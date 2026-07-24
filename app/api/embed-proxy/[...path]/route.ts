import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { applyDefaultBbotModel, isBBotAssistantId } from "@/lib/bbot-default-model"
import {
  authorizeEmbedThreadAccess,
  getEmbedAgentIdFromRequest,
  getEmbedOriginFromRequest,
  getEmbedSessionTokenFromRequest,
  hashEmbedSessionToken,
  metadataHasEmbedSessionBinding,
} from "@/lib/embed-session-server"

export const maxDuration = 60 // Set max duration to 60 seconds for streaming
const STREAM_DEBUG = process.env.STREAM_DEBUG === "1"

function getRequiredAdminApiKey() {
  const apiKey = (process.env.ADMIN_API_KEY || "").trim()
  if (!apiKey || apiKey === "your-super-secret-admin-key" || apiKey.startsWith("your-")) {
    return null
  }
  return apiKey
}

function createLangGraphJsonHeaders(apiKey: string, userId: string) {
  const headers = new Headers()
  headers.set("Content-Type", "application/json")
  headers.set("X-User-ID", userId)
  headers.set("Admin-API-Key", apiKey)
  return headers
}

function injectGeminiApiKey(body: any) {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return body

  const configurable =
    body?.config?.configurable ?? body?.configurable ?? body?.config?.configurable ?? body?.config?.configurable
  const modalities = configurable?.output_modalities
  if (!Array.isArray(modalities)) return body

  configurable.output_modalities = modalities.map((m: any) => {
    if (!m || m.type !== "tts") return m

    const modelName = (typeof m.model === "string" ? m.model : m.model_name) as any
    const isGoogle =
      m.provider === "google" ||
      (typeof modelName === "string" && modelName.startsWith("google/"))
    if (!isGoogle) return m

    if (!m.api_key) {
      return { ...m, api_key: geminiKey }
    }
    return m
  })

  return body
}

async function _fetchThreadStateAsTrusted(
  langGraphApiUrl: string,
  apiKey: string,
  threadId: string,
  userId: string,
): Promise<any | null> {
  const response = await fetch(
    `${langGraphApiUrl}/threads/${encodeURIComponent(threadId)}/state`,
    {
      method: "GET",
      headers: createLangGraphJsonHeaders(apiKey, userId),
    },
  )
  if (!response.ok) return null
  return response.json().catch(() => null)
}

async function _fetchThreadAsTrusted(
  langGraphApiUrl: string,
  apiKey: string,
  threadId: string,
): Promise<{ thread: any | null; userId: string }> {
  let response = await fetch(`${langGraphApiUrl}/threads/${encodeURIComponent(threadId)}`, {
    method: "GET",
    headers: createLangGraphJsonHeaders(apiKey, "admin"),
  })
  let userId = "admin"
  if (response.status === 404) {
    response = await fetch(`${langGraphApiUrl}/threads/${encodeURIComponent(threadId)}`, {
      method: "GET",
      headers: createLangGraphJsonHeaders(apiKey, "anonymous-embed-user"),
    })
    if (response.ok) userId = "anonymous-embed-user"
  }
  if (response.ok) {
    const thread = await response.json().catch(() => null)
    return { thread, userId }
  }

  // Aegra/Synapse often returns 404 for GET /threads/{id} right after a
  // successful anonymous run, while GET /threads/{id}/state still works.
  // Synthesize a thread payload so the SDK does not treat success as failure.
  for (const candidateUserId of ["admin", "anonymous-embed-user"] as const) {
    const state = await _fetchThreadStateAsTrusted(
      langGraphApiUrl,
      apiKey,
      threadId,
      candidateUserId,
    )
    if (!state) continue
    const values = state.values && typeof state.values === "object" ? state.values : state
    const metadata =
      (state.metadata && typeof state.metadata === "object" && state.metadata) ||
      (values?.metadata && typeof values.metadata === "object" && values.metadata) ||
      {}
    return {
      thread: {
        thread_id: threadId,
        values,
        metadata,
        status: state.status || "idle",
      },
      userId: candidateUserId,
    }
  }

  return { thread: null, userId }
}

async function _resolveChannelContext(agentId: string): Promise<{ expertId?: string | number; companyId?: number }> {
  const out: { expertId?: string | number; companyId?: number } = {}
  if (!agentId) return out
  try {
    const assistant = await _fetchAssistantForEmbedCheck(agentId)
    const meta = assistant?.metadata || {}
    const expertRaw = meta?.expert_id ?? meta?.expertId
    if (expertRaw != null && String(expertRaw).trim() !== "") {
      out.expertId = Number.isNaN(Number(expertRaw)) ? String(expertRaw) : Number(expertRaw)
    }
    const companyRaw = meta?.company_id ?? meta?.companyId
    if (companyRaw != null && String(companyRaw).trim() !== "" && !Number.isNaN(Number(companyRaw))) {
      out.companyId = Number(companyRaw)
    }
  } catch {
    // best-effort
  }
  return out
}

// Helper function to create anonymous threads for embed mode
async function handleAnonymousThreadCreation(request: NextRequest) {
  console.log("[EmbedProxy] Creating anonymous thread for embed mode");
  
  try {
    // Create thread directly in LangGraph with admin authentication
    const langGraphApiUrl = process.env.LANGGRAPH_API_URL || "https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app"
    const apiKey = getRequiredAdminApiKey()
    if (!apiKey) {
      return NextResponse.json({ error: "ADMIN_API_KEY not configured" }, { status: 500 })
    }

    const sessionToken = getEmbedSessionTokenFromRequest(request)
    if (!sessionToken || sessionToken.length < 32) {
      return NextResponse.json({ error: "embed_session_required" }, { status: 403 })
    }
    
    // Set up headers for LangGraph API
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    // The thread's metadata identifies the end user as anonymous; its
    // server-side owner is admin so the trusted embed proxy can read it.
    headers.set("X-User-ID", "admin");
    headers.set("Admin-API-Key", apiKey);
    
    // Try to extract assistant/agent and expert from the embed context
    let agentId: string | undefined = undefined;
    let expertId: string | undefined = undefined;
    try {
      // Prefer explicit headers if provided
      const headerAgent = request.headers.get('x-embed-agent-id') || request.headers.get('x-assistant-id');
      const headerExpert = request.headers.get('x-embed-expert-id') || request.headers.get('x-expert-id');

      // Fallback to referer URL query params
      const referer = request.headers.get('referer') || '';
      if (referer) {
        const refUrl = new URL(referer);
        const qpAgent = refUrl.searchParams.get('agent') || refUrl.searchParams.get('assistantId') || undefined;
        const qpExpert = refUrl.searchParams.get('expertId') || undefined;
        agentId = (headerAgent || qpAgent || undefined) as string | undefined;
        expertId = (headerExpert || qpExpert || undefined) as string | undefined;
      } else {
        agentId = headerAgent || undefined;
        expertId = headerExpert || undefined;
      }
    } catch (e) {
      console.log('[EmbedProxy] Failed to parse embed context for agent/expert:', e);
    }

    const sessionHash = hashEmbedSessionToken(sessionToken)
    const embedOrigin = getEmbedOriginFromRequest(request)
    const channelContext = agentId ? await _resolveChannelContext(agentId) : {}
    if (!expertId && channelContext.expertId != null) {
      expertId = String(channelContext.expertId)
    }

    // Create thread payload
    const threadPayload: any = {
      metadata: {
        anonymous: true,
        embed_thread: true,
        channel_type: "Embed",
        distributionChannel: { type: "Embed" },
        user_id: "anonymous-embed-user",
        embed_session_hash: sessionHash,
        owner: `embed-session:${sessionHash.slice(0, 24)}`,
      }
    };
    if (embedOrigin) {
      threadPayload.metadata.embed_origin = embedOrigin
    }

    // Enrich metadata when available so Hub can later filter by expert_id
    if (agentId) {
      // Enforce password protection (if configured) before creating threads.
      const pwErr = await _requireEmbedPasswordIfConfigured(request, agentId)
      if (pwErr) return pwErr
      threadPayload.metadata.assistant_id = agentId;
      threadPayload.metadata.agent_id = agentId;
      threadPayload.metadata.entity_id = `anonymoususer_${agentId}`;
    }
    if (expertId) {
      threadPayload.metadata.expert_id = isNaN(Number(expertId)) ? expertId : Number(expertId);
    }
    if (channelContext.companyId != null) {
      threadPayload.metadata.company_id = channelContext.companyId
      threadPayload.metadata.shared_chat = true
      threadPayload.metadata.shared_acl = { mode: "company_members", owner: "embed" }
    }
    
    console.log("[EmbedProxy] Creating thread in LangGraph with payload:", {
      ...threadPayload,
      metadata: { ...threadPayload.metadata, embed_session_hash: "[redacted]" },
    });
    
    // Make request to create thread in LangGraph
    const response = await fetch(`${langGraphApiUrl}/threads`, {
      method: "POST",
      headers,
      body: JSON.stringify(threadPayload),
    });
    
    console.log("[EmbedProxy] LangGraph thread creation response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[EmbedProxy] Failed to create thread in LangGraph:", errorText);
      return NextResponse.json({ error: "thread_create_failed" }, { status: 502 });
    }
    
    const threadData = await response.json();
    console.log("[EmbedProxy] Successfully created thread in LangGraph:", threadData.thread_id);
    try {
      if (threadData?.metadata && typeof threadData.metadata === "object") {
        delete threadData.metadata.embed_session_hash
      }
    } catch {
      // ignore
    }
    
    return Response.json(threadData, { status: 201 });
    
  } catch (error) {
    console.error("[EmbedProxy] Error creating anonymous thread:", error);
    return NextResponse.json({ error: "thread_create_failed" }, { status: 500 });
  }
}

type EmbedProxyContext = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, context: EmbedProxyContext) {
  const { path } = await context.params
  return handleEmbedProxyRequest(request, path, "GET")
}

export async function POST(request: NextRequest, context: EmbedProxyContext) {
  const { path } = await context.params
  return handleEmbedProxyRequest(request, path, "POST")
}

export async function PUT(request: NextRequest, context: EmbedProxyContext) {
  const { path } = await context.params
  return handleEmbedProxyRequest(request, path, "PUT")
}

export async function DELETE(request: NextRequest, context: EmbedProxyContext) {
  const { path } = await context.params
  return handleEmbedProxyRequest(request, path, "DELETE")
}

export async function PATCH(request: NextRequest, context: EmbedProxyContext) {
  const { path } = await context.params
  return handleEmbedProxyRequest(request, path, "PATCH")
}

const LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL || ""
const MAIN_API_URL = process.env.MAIN_API_URL || process.env.MAIN_API_PUBLIC_URL || ""
const ADMIN_API_KEY = getRequiredAdminApiKey() || ""

async function _resolveSynapseAssistantIdFromDistributionChannel(publicChannelId: string): Promise<string | null> {
  const channelId = String(publicChannelId || "").trim()
  if (!channelId) return null
  if (!MAIN_API_URL || !ADMIN_API_KEY) return null

  try {
    const r = await fetch(`${MAIN_API_URL}/v3/public/distribution-channels/${encodeURIComponent(channelId)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADMIN_API_KEY,
      },
      redirect: "manual",
    })
    if (!r.ok) return null
    const dc: any = await r.json().catch(() => null)
    // Prefer an explicit Synapse assistant UUID when MainAPI provides one.
    // Public embed channels (e.g. Rocket) often only expose graph_id ("bbot") —
    // Synapse rejects the distribution-channel UUID as assistant_id.
    const candidate =
      dc?.assistant_id ||
      dc?.assistantId ||
      dc?.assistant?.assistant_id ||
      dc?.assistant?.assistantId ||
      dc?.assistant?.id ||
      dc?.graph_id ||
      dc?.metadata?.graph_id
    const resolved = String(candidate || "").trim()
    return resolved ? resolved : null
  } catch {
    return null
  }
}

function _sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(String(s || ""), "utf8").digest("hex")
}

function _getEmbedPasswordFromRequest(req: NextRequest): string | null {
  const h = req.headers.get("x-embed-password") || req.headers.get("X-Embed-Password")
  const pw = (h || "").trim()
  return pw ? pw : null
}

async function _fetchAssistantForEmbedCheck(assistantId: string) {
  const langGraphApiUrl = LANGGRAPH_API_URL
  const apiKey = ADMIN_API_KEY
  const url = new URL(`${langGraphApiUrl}/assistants/${assistantId}`)
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": "admin",
      "Admin-API-Key": apiKey,
    },
  })
  if (!res.ok) return null
  return (await res.json().catch(() => null)) as any
}

function _extractEmbedPasswordConfig(assistant: any): { protected: boolean; salt?: string; hash?: string } {
  try {
    const meta = assistant?.metadata
    const dc = meta?.distributionChannel
    const cfg = dc?.config
    const salt = typeof cfg?.embed_password_salt === "string" ? cfg.embed_password_salt : ""
    const hash = typeof cfg?.embed_password_hash === "string" ? cfg.embed_password_hash : ""
    const protFlag = cfg?.password_protected === true || Boolean(salt && hash)
    if (protFlag && salt && hash) return { protected: true, salt, hash }
    if (protFlag) return { protected: true }
    return { protected: false }
  } catch {
    return { protected: false }
  }
}

function _stripEmbedPasswordSecrets(assistant: any) {
  try {
    const clone = assistant && typeof assistant === "object" ? JSON.parse(JSON.stringify(assistant)) : assistant
    const cfg = clone?.metadata?.distributionChannel?.config
    if (cfg && typeof cfg === "object") {
      delete cfg.embed_password_salt
      delete cfg.embed_password_hash
    }
    // expose only a boolean
    if (cfg && typeof cfg === "object") {
      cfg.password_protected = Boolean(cfg?.password_protected || false)
    }
    clone.password_protected = Boolean(cfg?.password_protected || false)
    return clone
  } catch {
    return assistant
  }
}

async function _requireEmbedPasswordIfConfigured(req: NextRequest, assistantId: string): Promise<Response | null> {
  try {
    const assistant = await _fetchAssistantForEmbedCheck(assistantId)
    if (!assistant) return null
    const cfg = _extractEmbedPasswordConfig(assistant)
    if (!cfg.protected) return null
    const pw = _getEmbedPasswordFromRequest(req)
    if (!pw || !cfg.salt || !cfg.hash) {
      return NextResponse.json({ error: "embed_password_required" }, { status: 401 })
    }
    const got = _sha256Hex(String(cfg.salt) + pw)
    if (got !== cfg.hash) {
      return NextResponse.json({ error: "embed_password_invalid" }, { status: 401 })
    }
    return null
  } catch {
    return NextResponse.json({ error: "embed_password_check_failed" }, { status: 401 })
  }
}

// Helper to check for valid UUID
function isValidUUID(uuid: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

async function handleEmbedProxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  try {
    console.log("[EmbedProxy] Processing embed request");

    if (!MAIN_API_URL) {
      return NextResponse.json({ error: "MAIN_API_URL not configured" }, { status: 500 })
    }
    if (!LANGGRAPH_API_URL) {
      return NextResponse.json({ error: "LANGGRAPH_API_URL not configured" }, { status: 500 })
    }

    // Get the API key from environment variables (server-side only)
    // Use the same default as MainAPI if not configured
    const apiKey = ADMIN_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ADMIN_API_KEY not configured" }, { status: 500 })
    }

    console.log("[EmbedProxy] Using API key:", "***PRESENT***")

    // Construct the target path
    const targetPath = pathSegments.join("/")
    console.log("[EmbedProxy] Target path:", targetPath);

    // Special handling for different request types in embed mode
    const isAssistantByIdRequest = targetPath.match(/^assistants\/([^\/]+)$/) && method === "GET"
    const isThreadCreationRequest = targetPath === "threads" && method === "POST"
    // Match any stream request (embed mode should handle all streaming anonymously)
    const isStreamRequest = targetPath.match(/^threads\/[^\/]+\/runs\/stream$/) && method === "POST"
    // Match history requests (embed mode should handle these anonymously too)
    const isHistoryRequest = targetPath.match(/^threads\/[^\/]+\/history$/) && method === "POST"
    const isThreadReadRequest = method === "GET" && pathSegments.length === 2 && pathSegments[0] === "threads" && isValidUUID(pathSegments[1])
    const isThreadStateRequest = method === "GET" && pathSegments.length === 3 && pathSegments[0] === "threads" && isValidUUID(pathSegments[1]) && pathSegments[2] === "state"
    const isThreadMetadataUpdateRequest = method === 'PATCH' && pathSegments.length === 2 && pathSegments[0] === 'threads' && isValidUUID(pathSegments[1]);
    
    // Handle thread creation early return
    if (isThreadCreationRequest) {
      // For thread creation in embed mode, create anonymous threads locally
      console.log("[EmbedProxy] Handling anonymous thread creation for embed mode");
      return handleAnonymousThreadCreation(request);
    }

    if (isThreadMetadataUpdateRequest) {
      console.log('[EMBED-PROXY] Handling thread metadata update request:', pathSegments.join('/'));
      const targetUrl = `${LANGGRAPH_API_URL}/${pathSegments.join('/')}${request.nextUrl.search}`;
      const threadId = String(pathSegments[1] || "").trim()
      const loaded = await _fetchThreadAsTrusted(LANGGRAPH_API_URL, apiKey, threadId)
      if (!loaded.thread) {
        return NextResponse.json({ error: "thread_not_found" }, { status: 404 })
      }
      const authErr = authorizeEmbedThreadAccess(request, loaded.thread?.metadata)
      if (authErr) return authErr
      
      const headers = new Headers(request.headers);
      // Synapse expects Admin-API-Key for admin auth
      headers.set('Admin-API-Key', apiKey);
      headers.set('X-User-ID', loaded.userId);
      headers.delete('host');
      headers.delete('authorization');
      headers.delete('x-api-key');

      console.log('[EMBED-PROXY] Forwarding metadata update to LangGraph:', targetUrl);

      try {
        const body = await request.text()
        const response = await fetch(targetUrl, {
          method: method,
          headers: headers,
          body,
          redirect: 'manual',
        });

        return response;
      } catch (error) {
        console.error('[EMBED-PROXY] Error forwarding metadata update request to LangGraph:', error);
        return new Response(JSON.stringify({ message: 'Error forwarding request' }), { status: 502 });
      }
    }

    if (isThreadReadRequest || isThreadStateRequest) {
      console.log("[EmbedProxy] Handling thread read/state request directly for embed mode:", targetPath)
      const threadId = String(pathSegments[1] || "").trim()
      const loaded = await _fetchThreadAsTrusted(LANGGRAPH_API_URL, apiKey, threadId)
      if (!loaded.thread) {
        return NextResponse.json({ error: "thread_not_found" }, { status: 404 })
      }
      const authErr = authorizeEmbedThreadAccess(request, loaded.thread?.metadata)
      if (authErr) return authErr

      if (isThreadReadRequest) {
        try {
          if (loaded.thread?.metadata && typeof loaded.thread.metadata === "object") {
            const clone = JSON.parse(JSON.stringify(loaded.thread))
            delete clone.metadata.embed_session_hash
            return NextResponse.json(clone, { status: 200 })
          }
        } catch {
          // fall through
        }
        return NextResponse.json(loaded.thread, { status: 200 })
      }

      const url = new URL(`${LANGGRAPH_API_URL}/${targetPath}`)
      const searchParams = new URLSearchParams(request.nextUrl.search)
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.append(key, value)
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: createLangGraphJsonHeaders(apiKey, loaded.userId),
        redirect: "manual",
      })

      const contentType = response.headers.get("Content-Type") || ""
      if (contentType.includes("application/json")) {
        const data = await response.json().catch(() => null)
        return NextResponse.json(data, { status: response.status })
      }
      return new Response(await response.text(), { status: response.status })
    }
    
    // Handle streaming requests in embed mode
    if (isStreamRequest) {
      console.log("[EmbedProxy] Handling stream request for embed mode");
      // Route directly to LangGraph API, bypassing MainAPI user authentication
      const langGraphApiUrl = process.env.LANGGRAPH_API_URL || "https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app"
      let streamTargetPath = targetPath

      const streamThreadId = String(pathSegments?.[1] || "").trim()
      if (streamThreadId && !isValidUUID(streamThreadId)) {
        // Old local fallback IDs like `embed-anonymous-*` never exist in Synapse.
        console.warn("[EmbedProxy] Rejecting non-UUID stream thread id:", streamThreadId)
        return NextResponse.json(
          { error: "invalid_thread_id", detail: "Stale local thread id; create a new thread" },
          { status: 410 },
        )
      }
      
      // Use a minimal header set for upstream streaming.
      // Forwarding browser hop-by-hop headers can destabilize the SSE transport.
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      // The public thread remains anonymous, but the trusted server-to-server
      // stream request must read the channel assistant across owners.
      headers.set("X-User-ID", "admin");
      headers.set("Admin-API-Key", apiKey);
      const requestId = request.headers.get("x-request-id") || request.headers.get("x-requestid")
      if (requestId) headers.set("X-Request-ID", requestId);
      
      // Get request body for streaming
      let body = null
      try {
        body = await request.json()
        body = applyDefaultBbotModel(body)
        body = injectGeminiApiKey(body)
        // Aegra validates run metadata as a flat primitive map. Preserve the
        // public channel details without sending the nested object that causes
        // a 422 validation error on public embed runs.
        const runMetadata = (body as any)?.metadata
        if (
          runMetadata &&
          typeof runMetadata === "object" &&
          runMetadata.distributionChannel &&
          typeof runMetadata.distributionChannel === "object"
        ) {
          runMetadata.distributionChannel = JSON.stringify(runMetadata.distributionChannel)
        }
        if (STREAM_DEBUG) console.log("[EmbedProxy] Stream request body:", JSON.stringify(body, null, 2));
      } catch (error) {
        console.log("[EmbedProxy] Error parsing stream request body:", error);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
      }

      // Prefer enforcing password protection based on the thread's stored distribution-channel id.
      // The client may send a Synapse assistant UUID for execution, but password configs live on the public channel.
      const threadId = String(pathSegments?.[1] || "").trim()
      const assistantFromPayload =
        (typeof (body as any)?.assistant_id === "string" && (body as any).assistant_id.trim() ? (body as any).assistant_id.trim() : "") ||
        (typeof (body as any)?.assistantId === "string" && (body as any).assistantId.trim() ? (body as any).assistantId.trim() : "") ||
        (typeof (body as any)?.config?.configurable?.assistant_id === "string" && (body as any).config.configurable.assistant_id.trim()
          ? (body as any).config.configurable.assistant_id.trim()
          : "") ||
        (typeof (body as any)?.config?.configurable?.agent_id === "string" && (body as any).config.configurable.agent_id.trim()
          ? (body as any).config.configurable.agent_id.trim()
          : "")

      let assistantPublicId = assistantFromPayload
      let streamUserId = "admin"
      try {
        if (threadId) {
          const loaded = await _fetchThreadAsTrusted(langGraphApiUrl, apiKey, threadId)
          if (!loaded.thread) {
            return NextResponse.json({ error: "thread_not_found" }, { status: 404 })
          }
          const authErr = authorizeEmbedThreadAccess(request, loaded.thread?.metadata)
          if (authErr) return authErr
          streamUserId = loaded.userId
          const fromMeta = String(loaded.thread?.metadata?.assistant_id || loaded.thread?.metadata?.agent_id || "").trim()
          if (fromMeta) assistantPublicId = fromMeta
          if (!metadataHasEmbedSessionBinding(loaded.thread?.metadata) && !getEmbedAgentIdFromRequest(request)) {
            console.log("[EmbedProxy] Legacy embed thread stream without session binding:", threadId)
          }
        }
      } catch {
        // best-effort; fall back to payload
      }
      headers.set("X-User-ID", streamUserId)

      if (assistantPublicId) {
        const pwErr = await _requireEmbedPasswordIfConfigured(request, assistantPublicId)
        if (pwErr) return pwErr
      }

      // Resolve Synapse assistant UUID for execution if the public id refers to a distribution channel.
      // Keep the public id in thread metadata for ACL/password checks, but execute using the Synapse assistant UUID.
      try {
        if (assistantPublicId && !isBBotAssistantId(assistantPublicId)) {
          const resolved = await _resolveSynapseAssistantIdFromDistributionChannel(assistantPublicId)
          if (resolved) {
            ;(body as any).assistant_id = resolved
            if ((body as any).config && typeof (body as any).config === "object") {
              ;(body as any).config.configurable = (body as any).config.configurable || {}
              if (typeof (body as any).config.configurable === "object") {
                ;(body as any).config.configurable.assistant_id = resolved
                ;(body as any).config.configurable.agent_id = assistantPublicId
              }
            }
          }
        }
      } catch {
        // best-effort; continue even if resolution fails
      }

      // Synapse's dedicated B-Bot stream proxy is the stable browser-facing
      // path for all public embeds. The raw LangGraph stream route returns
      // 404 for public channel UUIDs such as Rocket.
      if (pathSegments.length >= 4) {
        streamTargetPath = `bbot/threads/${pathSegments[1]}/runs/stream`
      }

      const url = new URL(`${langGraphApiUrl}/${streamTargetPath}`)
      const searchParams = new URLSearchParams(request.nextUrl.search)
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.append(key, value)
      }
      console.log("[EmbedProxy] Routing stream directly to LangGraph:", url);
      
      // Make the streaming request directly to LangGraph
      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      
      console.log("[EmbedProxy] LangGraph stream response status:", response.status);
      
      // Handle streaming responses
      if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
        console.log("[EmbedProxy] Detected streaming response, setting up pass-through stream");
        
        if (!response.body) {
          return new Response("No stream", { status: 500 });
        }
        
        // Return the stream directly (no per-chunk logging/decoding which slows streaming a lot)
        return new Response(response.body, {
          status: response.status,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-store, must-revalidate, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", // Disable Nginx buffering
            // CORS headers
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*",
          },
        });
      } else {
        // For non-streaming responses from LangGraph
        const data = await response.json();
        return Response.json(data, { status: response.status });
      }
    }
    
    // Handle history requests in embed mode
    if (isHistoryRequest) {
      console.log("[EmbedProxy] Handling history request for embed mode");
      // Route directly to LangGraph API, bypassing MainAPI user authentication
      const langGraphApiUrl = process.env.LANGGRAPH_API_URL || "https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app"
      const url = new URL(`${langGraphApiUrl}/${targetPath}`)
      console.log("[EmbedProxy] Routing history directly to LangGraph:", url);

      // Enforce password + session binding based on thread metadata.
      let historyUserId = "admin"
      try {
        const threadId = pathSegments[1]
        if (threadId) {
          const loaded = await _fetchThreadAsTrusted(langGraphApiUrl, apiKey, threadId)
          if (!loaded.thread) {
            return NextResponse.json({ error: "thread_not_found" }, { status: 404 })
          }
          const authErr = authorizeEmbedThreadAccess(request, loaded.thread?.metadata)
          if (authErr) return authErr
          historyUserId = loaded.userId
          const assistantId = String(loaded.thread?.metadata?.assistant_id || loaded.thread?.metadata?.agent_id || "").trim()
          if (assistantId) {
            const pwErr = await _requireEmbedPasswordIfConfigured(request, assistantId)
            if (pwErr) return pwErr
          }
        }
      } catch {
        // ignore and continue
      }
      
      // Copy query parameters
      const searchParams = new URLSearchParams(request.nextUrl.search)
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.append(key, value)
      }
      
      // Only send headers LangGraph needs. Forwarded browser/proxy headers such as
      // Expect/Connection can make undici fail before the final history refresh.
      const headers = createLangGraphJsonHeaders(apiKey, historyUserId)
      
      // Get request body for history request
      let body = null
      try {
        body = await request.json()
        if (STREAM_DEBUG) console.log("[EmbedProxy] History request body:", JSON.stringify(body, null, 2));
      } catch (error) {
        console.log("[EmbedProxy] Error parsing history request body:", error);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
      }
      
      // Make the history request directly to LangGraph
      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      
      console.log("[EmbedProxy] LangGraph history response status:", response.status);
      
      // Handle the response
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[EmbedProxy] History request failed:", errorText);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: response.status });
      }
      
      const historyData = await response.json();
      console.log("[EmbedProxy] Successfully fetched history");
      return Response.json(historyData, { status: response.status });
    }
    
    // For other requests, set up the target URL
    let url: URL
    if (isAssistantByIdRequest) {
      // In embed mode, treat assistant-id lookups as "public distribution channel id"
      // first. This avoids false "agent not found" for public channel UUIDs.
      const requestedId = String(pathSegments[1] || "").trim()
      if (!requestedId) {
        return NextResponse.json({ error: "assistant_id_required" }, { status: 400 })
      }

      try {
        const dcUrl = new URL(`${MAIN_API_URL}/v3/public/distribution-channels/${encodeURIComponent(requestedId)}`)
        const dcResponse = await fetch(dcUrl.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
          },
          redirect: "manual",
        })

        if (dcResponse.ok) {
          const distributionChannel = await dcResponse.json().catch(() => null)
          if (distributionChannel) {
            return NextResponse.json(distributionChannel, {
              status: 200,
              headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                Pragma: "no-cache",
              },
            })
          }
        }

        // If MainAPI answered with a non-404 error, don't silently mask it as "not found".
        if (dcResponse.status !== 404) {
          const details = await dcResponse.text().catch(() => "")
          console.log("[EmbedProxy] Distribution channel lookup non-404 failure:", dcResponse.status, details)
          return NextResponse.json(
            { error: "distribution_channel_lookup_failed", status: dcResponse.status },
            { status: 502 },
          )
        }
      } catch (error) {
        console.log("[EmbedProxy] Distribution channel lookup failed, trying assistant fallback:", error)
      }

      // Fallback for direct Synapse assistant UUIDs (non-public IDs).
      try {
        const assistant = await _fetchAssistantForEmbedCheck(requestedId)
        if (assistant) {
          const cfg = _extractEmbedPasswordConfig(assistant)
          if (cfg.protected) {
            try {
              assistant.metadata = assistant.metadata || {}
              assistant.metadata.distributionChannel = assistant.metadata.distributionChannel || {}
              assistant.metadata.distributionChannel.config = assistant.metadata.distributionChannel.config || {}
              assistant.metadata.distributionChannel.config.password_protected = true
            } catch {}
          }
          return NextResponse.json(_stripEmbedPasswordSecrets(assistant), { status: 200 })
        }
      } catch (error) {
        console.log("[EmbedProxy] Assistant fallback lookup failed:", error)
      }
      return NextResponse.json({ error: `Assistant '${requestedId}' not found` }, { status: 404 })
    } else {
      // Handle other requests through MainAPI proxy to LangGraph  
      url = new URL(`${MAIN_API_URL}/v2/${targetPath}`)
      console.log("[EmbedProxy] Routing through MainAPI to LangGraph:", url);
    }
    
    // Copy query parameters
    const searchParams = new URLSearchParams(request.nextUrl.search)
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }

    const headers = new Headers()
    headers.set("Content-Type", "application/json")

    // Configure headers for all proxied requests
    console.log("[EmbedProxy] Using Admin API Key as X-API-Key header for embed request");
    headers.set("X-API-Key", apiKey);

    // Forward any existing Authorization header if present (for authenticated embed users)
    const authHeader = request.headers.get("Authorization")
    if (authHeader) {
      console.log("[EmbedProxy] Forwarding Authorization header for authenticated embed user");
      headers.set("Authorization", authHeader);
    }

    // Optionally, log forwarded headers for debugging
    console.log("[EmbedProxy] Forwarding headers:", {
      "Admin-API-Key": isAssistantByIdRequest ? "none" : "***HIDDEN***",
      "X-API-Key": isAssistantByIdRequest ? "***HIDDEN***" : "none",
      "Authorization": authHeader ? "***PRESENT***" : "none",
      "X-User-ID": headers.get("X-User-ID"),
    });

    // Log the final target URL
    console.log("[EmbedProxy] Final target URL:", url.toString());

    // Get the request body and handle special cases
    let body = null
    let requestMethod = method
    
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await request.json()
        body = applyDefaultBbotModel(body)
        body = injectGeminiApiKey(body)

        // If this is a streaming request to /threads/{threadId}/runs/stream
        // Format the payload according to the expected structure
        if (targetPath.includes("/runs/stream")) {
          // Extract the input and config from the request body
          const { input, config } = body
          // This is an SSE response; request payload is still JSON.
          headers.set("Accept", "text/event-stream");
          console.log("[EmbedProxy] Streaming request detected");
          const assistantIdCandidate =
            (typeof body?.assistant_id === "string" && body.assistant_id.trim() ? body.assistant_id.trim() : "") ||
            (typeof body?.assistantId === "string" && body.assistantId.trim() ? body.assistantId.trim() : "") ||
            (typeof config?.configurable?.assistant_id === "string" && config.configurable.assistant_id.trim()
              ? config.configurable.assistant_id.trim()
              : "") ||
            (typeof config?.configurable?.agent_id === "string" && config.configurable.agent_id.trim()
              ? config.configurable.agent_id.trim()
              : "")
          // Create the properly formatted payload
          const formattedBody = {
            input,
            config,
            stream_mode: body.stream_mode || ["messages", "updates"], // Use messages/updates for proper event streaming
            // Enable subgraph streaming to get namespace detection like B-Bot Hub
            stream_subgraphs: true,
            subgraphs: true,
            on_disconnect: body.on_disconnect || "cancel",
            assistant_id: assistantIdCandidate || undefined
          }

          body = formattedBody
        }
      } catch (error) {
        console.log("[EmbedProxy] Error parsing request body:", error);
        // Silent error handling for body parsing
      }
    }

    // Always remove Content-Length if body is changed
    headers.delete("Content-Length");

    // Make the request through MainAPI which proxies to LangGraph
    const response = await fetch(url.toString(), {
      method: requestMethod,
      headers,
      body: body ? JSON.stringify(body) : null,
    })

    // Handle streaming responses
    if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
      console.log("[EmbedProxy] Detected streaming response, setting up pass-through stream");
      
      if (!response.body) {
        return new Response("No stream", { status: 500 });
      }
      
      // Return the stream with comprehensive headers for real-time streaming
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store, must-revalidate, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no", // Disable Nginx buffering
          // CORS headers
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    }

    // For non-streaming responses, handle the JSON
    const data = await response.json();
    console.log("[EmbedProxy] Response status:", response.status);
    console.log("[EmbedProxy] Response data type:", typeof data);
    console.log("[EmbedProxy] Response data length:", Array.isArray(data) ? data.length : "not an array");
    console.log("[EmbedProxy] Response data:", JSON.stringify(data, null, 2));
    
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.log("[EmbedProxy] Error:", error);
    return NextResponse.json({ error: "Embed proxy error" }, { status: 500 })
  }
} 