/**
 * Per-browser embed session capability.
 *
 * The token is stored in sessionStorage (tab-scoped) and sent as
 * `X-Embed-Session` on every embed-proxy request. The proxy binds new
 * threads to a hash of this token so knowing only a thread UUID is not
 * enough to read or continue another visitor's conversation.
 */

const SESSION_PREFIX = "bbot.embed.session.v1"

function storageKey(channelId: string, embedId?: string): string {
  const channel = String(channelId || "unknown").trim() || "unknown"
  const scope = String(embedId || "").trim()
  return scope ? `${SESSION_PREFIX}.${channel}.${scope}` : `${SESSION_PREFIX}.${channel}`
}

function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
}

export function getOrCreateEmbedSessionToken(channelId: string, embedId?: string): string {
  if (typeof window === "undefined") return ""
  const key = storageKey(channelId, embedId)
  try {
    const existing = (sessionStorage.getItem(key) || "").trim()
    if (existing && existing.length >= 32) return existing
    const next = randomToken()
    sessionStorage.setItem(key, next)
    return next
  } catch {
    return randomToken()
  }
}

export function clearEmbedSessionToken(channelId: string, embedId?: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(storageKey(channelId, embedId))
  } catch {
    // ignore
  }
}
