import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { appOrigin } from "@/lib/app-origin"

type A2AContext = {
  params: Promise<{ agent: string }>
}

function jsonRpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/a2a+json",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return ""
  return parts
    .filter(
      (part) =>
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof part.text === "string",
    )
    .map((part) => String(part.text))
    .join("\n")
    .trim()
}

function callerSession(request: NextRequest, agent: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const caller = forwarded || request.headers.get("x-real-ip") || "unknown"
  const day = new Date().toISOString().slice(0, 10)
  const secret = process.env.ADMIN_API_KEY || process.env.A2A_SESSION_SECRET || "bbot-a2a-public"
  return crypto
    .createHmac("sha256", secret)
    .update(`${agent}:${caller}:${day}`)
    .digest("hex")
}

export async function POST(request: NextRequest, context: A2AContext) {
  const { agent: rawAgent } = await context.params
  const agent = String(rawAgent || "").trim()
  if (!agent || agent.length > 200) {
    return jsonRpcError(null, -32602, "Invalid agent id", 400)
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return jsonRpcError(null, -32700, "Invalid JSON payload", 400)
  }

  const id = payload?.id ?? null
  if (payload?.jsonrpc !== "2.0" || typeof payload?.method !== "string") {
    return jsonRpcError(id, -32600, "Invalid request", 400)
  }
  if (payload.method !== "SendMessage") {
    return jsonRpcError(id, -32601, "Method not found")
  }

  const message = payload?.params?.message
  const question = textFromParts(message?.parts)
  if (!question) {
    return jsonRpcError(id, -32602, "message.parts must contain text")
  }

  const metadata =
    payload?.params?.metadata && typeof payload.params.metadata === "object"
      ? payload.params.metadata
      : {}
  const pageUrl = String(metadata.pageUrl || metadata.page_url || "").slice(0, 2_000)
  const language = String(metadata.language || "").slice(0, 35)

  try {
    const queryResponse = await fetch(`${appOrigin(request)}/api/agent-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent,
        question,
        language,
        pageUrl,
        sessionToken: callerSession(request, agent),
      }),
      cache: "no-store",
    })
    const result = await queryResponse.json().catch(() => null)
    if (!queryResponse.ok) {
      const code = queryResponse.status === 429 ? -32005 : -32603
      return jsonRpcError(id, code, result?.message || "Agent query failed")
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id,
        result: {
          message: {
            messageId: crypto.randomUUID(),
            role: "ROLE_AGENT",
            parts: [
              { text: result.answer, mediaType: "text/plain" },
              {
                data: {
                  requestId: result.requestId,
                  generatedAt: result.generatedAt,
                  context: result.context,
                },
                mediaType: "application/json",
              },
            ],
            metadata: {
              provider: "Beyond-Bot.ai",
              readOnly: true,
            },
          },
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/a2a+json",
          "X-Content-Type-Options": "nosniff",
        },
      },
    )
  } catch (error) {
    console.error("[A2A] SendMessage failed:", error)
    return jsonRpcError(id, -32603, "Internal error")
  }
}
