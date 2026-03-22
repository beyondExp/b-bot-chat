import { NextResponse } from "next/server"

function _joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "")
  const p = (path || "").replace(/^\/+/, "")
  return `${b}/${p}`
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

    // Return the data without any filtering
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in agents API route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
