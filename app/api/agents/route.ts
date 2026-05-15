import { NextResponse } from "next/server"

function _joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "")
  const p = (path || "").replace(/^\/+/, "")
  return `${b}/${p}`
}

type UnknownRecord = Record<string, unknown>

function _asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {}
}

function _getDistConfig(item: unknown): { companyOnly: boolean; companyId: string } {
  const metadata = _asRecord(_asRecord(item).metadata)
  const dist = _asRecord(metadata.distributionChannel || metadata.distribution_channel)
  const cfg = _asRecord(dist.config)
  const companyOnly = !!cfg?.company_only
  const companyId = cfg?.company_id != null ? String(cfg.company_id).trim() : ""
  return { companyOnly, companyId }
}

async function _getMyCompanyAccess(mainApiUrl: string, accessToken: string): Promise<{
  companyIds: Set<string>
  swissChatCompanyIds: Set<string>
  hasIndividualSwissChat: boolean
}> {
  try {
    const res = await fetch(_joinUrl(mainApiUrl, "/v0/users/me/companies"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })
    if (!res.ok) return { companyIds: new Set(), swissChatCompanyIds: new Set(), hasIndividualSwissChat: false }
    const json = await res.json()
    const ids = Array.isArray(json?.company_ids) ? json.company_ids : []
    const entitlements = Array.isArray(json?.entitlements?.companies) ? json.entitlements.companies : []
    const individualProducts = Array.isArray(json?.entitlements?.individual_products)
      ? json.entitlements.individual_products
      : []
    const swissChatIds = entitlements
      .filter((item: unknown) => {
        const record = _asRecord(item)
        return Array.isArray(record.products) && record.products.includes("swiss_chat")
      })
      .map((item: unknown) => String(_asRecord(item).company_id).trim())
      .filter(Boolean)
    return {
      companyIds: new Set(ids.map((x: unknown) => String(x).trim()).filter(Boolean)),
      swissChatCompanyIds: new Set(swissChatIds),
      hasIndividualSwissChat: individualProducts.includes("swiss_chat"),
    }
  } catch {
    return { companyIds: new Set(), swissChatCompanyIds: new Set(), hasIndividualSwissChat: false }
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
    const myCompanyAccess = bearer
      ? await _getMyCompanyAccess(mainApiUrl, bearer)
      : { companyIds: new Set<string>(), swissChatCompanyIds: new Set<string>(), hasIndividualSwissChat: false }

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

    // Filter out company-only agents unless the caller has a Swiss-Chat seat for that company.
    const list = Array.isArray(data) ? data : []
    const filtered = list.filter((item: unknown) => {
      const { companyOnly, companyId } = _getDistConfig(item)
      if (!companyOnly) return true
      if (!companyId) return myCompanyAccess.hasIndividualSwissChat
      return myCompanyAccess.companyIds.has(companyId) && myCompanyAccess.swissChatCompanyIds.has(companyId)
    })
    return NextResponse.json(filtered)
  } catch (error) {
    console.error("Error in agents API route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
