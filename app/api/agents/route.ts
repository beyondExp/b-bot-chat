import { NextResponse } from "next/server"

function _joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "")
  const p = (path || "").replace(/^\/+/, "")
  return `${b}/${p}`
}

function _getDistConfig(item: any): { companyOnly: boolean; companyId: string } {
  const metadata = item?.metadata || {}
  const dist = metadata?.distributionChannel || metadata?.distribution_channel || {}
  const cfg = dist?.config || {}
  const companyOnly = !!cfg?.company_only
  const companyId = cfg?.company_id != null ? String(cfg.company_id).trim() : ""
  return { companyOnly, companyId }
}

async function _getMyCompanyIds(mainApiUrl: string, accessToken: string): Promise<Set<string>> {
  try {
    const res = await fetch(_joinUrl(mainApiUrl, "/v0/users/me/companies"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })
    if (!res.ok) return new Set()
    const json = await res.json()
    const ids = Array.isArray(json?.company_ids) ? json.company_ids : []
    return new Set(ids.map((x: any) => String(x).trim()).filter(Boolean))
  } catch {
    return new Set()
  }
}

// Handle both GET and POST methods
export async function GET(req: Request) {
  return handleRequest(req)
}

export async function POST(req: Request) {
  return handleRequest(req)
}

// Shared handler function for both GET and POST
async function handleRequest(req: Request) {
  try {
    // This endpoint is server-side only and uses an admin key to list public distribution channels.
    // It must point to our MainAPI instance (not api.b-bot.space).
    const mainApiUrl = process.env.MAIN_API_URL || process.env.MAIN_API_PUBLIC_URL || ""
    if (!mainApiUrl) {
      return NextResponse.json({ error: "MAIN_API_URL not configured" }, { status: 500 })
    }

    const apiKey = process.env.ADMIN_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ADMIN_API_KEY not configured" }, { status: 500 })
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || ""
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : ""
    const myCompanyIds = bearer ? await _getMyCompanyIds(mainApiUrl, bearer) : new Set<string>()

    // Forward the request to the actual API with the admin key
    const response = await fetch(_joinUrl(mainApiUrl, "/v3/public/distribution-channels"), {
      method: "GET", // Always use GET for the upstream API
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      // No body or filters sent with the request
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API error (${response.status}): ${errorText}`)
      return NextResponse.json(
        { error: `API error: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const data = await response.json()

    // Filter out company-only agents unless the caller belongs to that company.
    const list = Array.isArray(data) ? data : []
    const filtered = list.filter((item: any) => {
      const { companyOnly, companyId } = _getDistConfig(item)
      if (!companyOnly) return true
      if (!companyId) return false
      return myCompanyIds.has(companyId)
    })
    return NextResponse.json(filtered)
  } catch (error) {
    console.error("Error in agents API route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
