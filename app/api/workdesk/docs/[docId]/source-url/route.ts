import { NextResponse } from "next/server"

function _joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "")
  const p = (path || "").replace(/^\/+/, "")
  return `${b}/${p}`
}

function _authHeader(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization")
  return h && h.trim() ? h.trim() : null
}

export async function GET(req: Request, ctx: { params: { docId: string } }) {
  try {
    const mainApiUrl = process.env.MAIN_API_URL || process.env.MAIN_API_PUBLIC_URL || ""
    if (!mainApiUrl) {
      return NextResponse.json({ error: "MAIN_API_URL not configured" }, { status: 500 })
    }

    const auth = _authHeader(req)
    if (!auth) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 })
    }

    const { docId } = ctx.params
    const url = new URL(req.url)
    const containerId = (url.searchParams.get("container_id") || "").trim()
    const expiresSeconds = (url.searchParams.get("expires_seconds") || "").trim()

    if (!containerId) {
      return NextResponse.json({ error: "container_id required" }, { status: 400 })
    }

    const upstreamUrl = new URL(_joinUrl(mainApiUrl, `/v3/workdesk/docs/${encodeURIComponent(docId)}/source-url`))
    upstreamUrl.searchParams.set("container_id", containerId)
    if (expiresSeconds) upstreamUrl.searchParams.set("expires_seconds", expiresSeconds)

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
    console.error("Error in workdesk source-url API route (GET):", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

