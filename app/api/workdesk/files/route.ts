import { NextResponse } from "next/server"

function _joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "")
  const p = (path || "").replace(/^\/+/, "")
  return `${b}/${p}`
}

function _mainApiEndpoint(base: string, pathUnderApi: string) {
  const b = (base || "").replace(/\/+$/, "")
  const p = (pathUnderApi || "").replace(/^\/+/, "")
  const root = b.endsWith("/api") ? b : `${b}/api`
  return `${root}/${p}`
}

function _authHeader(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization")
  return h && h.trim() ? h.trim() : null
}

export async function GET(req: Request) {
  try {
    const mainApiUrl = process.env.MAIN_API_URL || process.env.MAIN_API_PUBLIC_URL || ""
    if (!mainApiUrl) {
      return NextResponse.json({ error: "MAIN_API_URL not configured" }, { status: 500 })
    }

    const auth = _authHeader(req)
    if (!auth) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 })
    }

    const url = new URL(req.url)
    const threadId = (url.searchParams.get("thread_id") || "").trim()
    if (!threadId) {
      return NextResponse.json({ error: "thread_id required" }, { status: 400 })
    }

    const upstreamUrl = new URL(_mainApiEndpoint(mainApiUrl, "/v0/thread/files"))
    upstreamUrl.searchParams.set("thread_id", threadId)

    const upstream = await fetch(upstreamUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
    })

    const text = await upstream.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }

    return NextResponse.json(data, { status: upstream.status })
  } catch (e) {
    console.error("Error in workdesk files API route (GET):", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

