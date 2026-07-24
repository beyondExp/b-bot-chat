import crypto from "crypto"
import type { NextRequest } from "next/server"

export const EMBED_SESSION_HEADER = "x-embed-session"
export const EMBED_AGENT_HEADER = "x-embed-agent-id"
export const EMBED_EXPERT_HEADER = "x-embed-expert-id"

/** Allow legacy threads (no session hash) during migration. Default on. */
export function legacyEmbedThreadAccessEnabled(): boolean {
  const raw = String(process.env.LEGACY_EMBED_THREAD_ACCESS ?? "1").trim().toLowerCase()
  return raw === "" || raw === "1" || raw === "true" || raw === "yes" || raw === "on"
}

export function hashEmbedSessionToken(token: string): string {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex")
}

export function getEmbedSessionTokenFromRequest(req: NextRequest): string {
  const raw =
    req.headers.get(EMBED_SESSION_HEADER) ||
    req.headers.get("X-Embed-Session") ||
    ""
  return String(raw).trim()
}

export function getEmbedAgentIdFromRequest(req: NextRequest): string {
  const raw =
    req.headers.get(EMBED_AGENT_HEADER) ||
    req.headers.get("x-assistant-id") ||
    req.headers.get("X-Assistant-Id") ||
    ""
  return String(raw).trim()
}

export function getEmbedOriginFromRequest(req: NextRequest): string {
  try {
    const origin = (req.headers.get("origin") || "").trim()
    if (origin) return origin
    const referer = (req.headers.get("referer") || "").trim()
    if (referer) return new URL(referer).origin
  } catch {
    // ignore
  }
  return ""
}

export function metadataHasEmbedSessionBinding(meta: Record<string, unknown> | null | undefined): boolean {
  if (!meta || typeof meta !== "object") return false
  const hash = meta.embed_session_hash
  return typeof hash === "string" && hash.trim().length >= 32
}

/**
 * Authorize a browser request against thread metadata.
 * Returns null when allowed, or an error Response.
 */
export function authorizeEmbedThreadAccess(
  req: NextRequest,
  meta: Record<string, unknown> | null | undefined,
): Response | null {
  const safeMeta = meta && typeof meta === "object" ? meta : {}
  const boundHash = typeof safeMeta.embed_session_hash === "string" ? safeMeta.embed_session_hash.trim() : ""
  const presentedToken = getEmbedSessionTokenFromRequest(req)

  if (boundHash) {
    if (!presentedToken) {
      return Response.json({ error: "embed_session_required" }, { status: 403 })
    }
    const presentedHash = hashEmbedSessionToken(presentedToken)
    try {
      const a = Buffer.from(boundHash, "utf8")
      const b = Buffer.from(presentedHash, "utf8")
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return Response.json({ error: "embed_session_mismatch" }, { status: 403 })
      }
    } catch {
      return Response.json({ error: "embed_session_mismatch" }, { status: 403 })
    }

    // Synapse often rewrites thread.metadata.assistant_id to the execution UUID
    // after a run, while the client keeps sending the public channel id (e.g. "bbot")
    // in X-Embed-Agent-Id. Accept either agent_id or assistant_id.
    const boundChannelIds = [safeMeta.agent_id, safeMeta.assistant_id]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
    const presentedChannel = getEmbedAgentIdFromRequest(req)
    if (
      boundChannelIds.length > 0 &&
      presentedChannel &&
      !boundChannelIds.includes(presentedChannel)
    ) {
      return Response.json({ error: "embed_channel_mismatch" }, { status: 403 })
    }

    const boundOrigin = typeof safeMeta.embed_origin === "string" ? safeMeta.embed_origin.trim() : ""
    const presentedOrigin = getEmbedOriginFromRequest(req)
    if (boundOrigin && presentedOrigin && boundOrigin !== presentedOrigin) {
      return Response.json({ error: "embed_origin_mismatch" }, { status: 403 })
    }
    return null
  }

  // Legacy threads created before session binding.
  if (legacyEmbedThreadAccessEnabled()) {
    return null
  }
  return Response.json({ error: "embed_session_required" }, { status: 403 })
}
