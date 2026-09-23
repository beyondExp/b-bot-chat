import { NextResponse } from "next/server"
import { mainApiBase } from "@/lib/main-api"

/**
 * Proxies the authenticated user's subscription quota status from MainAPI
 * (plan, monthly runs used/limit). Used by the account page and upgrade UX.
 */
export async function GET(request: Request) {
  const mainApiUrl = mainApiBase()
  if (!mainApiUrl) {
    return NextResponse.json({ error: "MAIN_API_URL not configured" }, { status: 500 })
  }

  const auth = request.headers.get("Authorization") || ""
  if (!auth) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }

  try {
    const res = await fetch(`${mainApiUrl}/quota/status`, {
      headers: { Authorization: auth },
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error("Quota status fetch failed:", error)
    return NextResponse.json({ error: "quota_unavailable" }, { status: 502 })
  }
}
