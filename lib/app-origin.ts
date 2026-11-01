import type { NextRequest } from "next/server"

/** Resolve this deployment's own origin without trusting a caller-controlled Host header. */
export function appOrigin(request: NextRequest): string {
  const configured =
    process.env.CHAT_PUBLIC_URL ||
    process.env.AUTH0_BASE_URL ||
    process.env.NEXT_PUBLIC_CHAT_URL ||
    ""
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin
    } catch {
      // Fall back to the request origin for local and legacy deployments.
    }
  }
  return request.nextUrl.origin
}
