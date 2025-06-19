import { NextRequest, NextResponse } from "next/server"

// Helper to get Auth0 Management API token
async function getAuth0ManagementToken() {
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    }),
  })
  if (!res.ok) throw new Error("Failed to get Auth0 management token")
  const data = await res.json()
  return data.access_token
}

export async function POST(req: NextRequest) {
  try {
    const { userId, newTokenBudget } = await req.json()
    if (!userId || typeof newTokenBudget !== "number") {
      return NextResponse.json({ error: "Missing userId or newTokenBudget" }, { status: 400 })
    }
    const managementToken = await getAuth0ManagementToken()
    const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${managementToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_metadata: {
          token_budget: newTokenBudget
        }
      })
    })
    if (!res.ok) {
      const error = await res.text()
      return NextResponse.json({ error: "Failed to update user metadata", details: error }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
  }
} 