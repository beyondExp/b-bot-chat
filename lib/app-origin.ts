import type { NextRequest } from "next/server"

function configuredOrigin(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (!value) continue
    try {
      const url = new URL(value)
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin
    } catch {
      // Try the next configured value.
    }
  }
  return ""
}

/** Resolve an internal loopback origin for server-to-server calls inside the chat container. */
export function appOrigin(request: NextRequest): string {
  const configured = configuredOrigin(process.env.CHAT_INTERNAL_URL)
  if (configured) return configured
  if (process.env.NODE_ENV === "production") {
    const port = String(process.env.PORT || "8080").replace(/[^\d]/g, "") || "8080"
    return `http://127.0.0.1:${port}`
  }
  return request.nextUrl.origin
}

/** Resolve the canonical public origin advertised in HTML and A2A Agent Cards. */
export function publicAppOrigin(request?: NextRequest): string {
  const configured = configuredOrigin(
    process.env.CHAT_PUBLIC_URL,
    process.env.NEXT_PUBLIC_CHAT_URL,
  )
  if (configured) return configured
  if (process.env.NODE_ENV === "production") return "https://swiss-chat.ch"
  return request?.nextUrl.origin || "http://localhost:3000"
}
