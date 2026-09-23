import { NextResponse } from "next/server"
import { mainApiBase } from "@/lib/main-api"

/**
 * Starts the 15-day trial subscription for a freshly signed-up chat user by
 * forwarding to MainAPI's auto-trial endpoint (Stripe trial, no payment
 * method required). Idempotency/duplicate protection lives in MainAPI; the
 * client additionally only calls this when the resolved plan is "free".
 */
export async function POST(request: Request) {
  const mainApiUrl = mainApiBase()
  if (!mainApiUrl) {
    return NextResponse.json({ error: "MAIN_API_URL not configured" }, { status: 500 })
  }

  const auth = request.headers.get("Authorization") || ""
  if (!auth) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  try {
    const res = await fetch(`${mainApiUrl}/v1/subscriptions/auto-trial`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        region: String(body?.region || "unknown"),
        industry: String(body?.industry || "chat"),
        plan: String(body?.plan || "starter"),
        interval: String(body?.interval || "monthly"),
      }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error("Auto-trial request failed:", error)
    return NextResponse.json({ error: "auto_trial_unavailable" }, { status: 502 })
  }
}
