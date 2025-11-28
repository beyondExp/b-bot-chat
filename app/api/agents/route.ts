import { NextResponse } from "next/server"

// Base URL for the API - use environment variable or fallback to localhost
const MAIN_API_URL = process.env.MAIN_API_URL || "http://localhost:5000"
const API_V3_BASE_URL = `${MAIN_API_URL}/api/v3`

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

    console.log("[Agents] Using API URL:", API_V3_BASE_URL);
    console.log("[Agents] Using API key:", apiKey === "your-super-secret-admin-key" ? "default key" : "custom key");

    // Forward the request to the actual API with the admin key
    const response = await fetch(`${API_V3_BASE_URL}/public/distribution-channels`, {
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

    // Filter to only show assistants with "Chat" distribution channel
    // Always include B-Bot standard expert
    const filteredData = Array.isArray(data) 
      ? data.filter((assistant: any) => {
          const distributionChannel = assistant?.metadata?.distributionChannel
          const channelType = distributionChannel?.type
          const assistantId = assistant?.id || assistant?.assistant_id
          const assistantName = assistant?.name || ''
          
          // Always include B-Bot standard expert
          const isBBot = assistantId === 'bbot' || 
                        assistantId === 'b-bot' || 
                        assistantName.toLowerCase() === 'b-bot' ||
                        assistantName.toLowerCase().includes('b-bot standard')
          
          if (isBBot) {
            console.log(`[Agents] Including B-Bot: ${assistantName} (standard expert)`)
            return true
          }
          
          // Only include assistants with "Chat" channel type
          if (channelType === "Chat") {
            console.log(`[Agents] Including assistant: ${assistantName} (Chat channel)`)
            return true
          } else {
            console.log(`[Agents] Excluding assistant: ${assistantName} (channel: ${channelType || 'none'})`)
            return false
          }
        })
      : []

    console.log(`[Agents] Filtered ${filteredData.length} out of ${Array.isArray(data) ? data.length : 0} assistants for Chat channel`)

    return NextResponse.json(filteredData)
  } catch (error) {
    console.error("Error in agents API route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
