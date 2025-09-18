import { NextResponse } from "next/server"

// Base URL for the API
const API_V3_BASE_URL = "https://api.b-bot.space/api/v3"

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
    // Get the API key from environment variables (server-side only)
    // Use the same default as MainAPI if not configured
    const apiKey = process.env.ADMIN_API_KEY || "your-super-secret-admin-key"

    console.log("[Agents] Using API key:", apiKey === "your-super-secret-admin-key" ? "default key" : "custom key");

    // Forward the request to the actual API with the admin key
    const response = await fetch(`${API_V3_BASE_URL}/public/assistants`, {
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
