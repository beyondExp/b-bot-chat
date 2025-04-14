import { type NextRequest, NextResponse } from "next/server"
import { LangGraphService } from "@/lib/langgraph-service"

// Helper function to extract token from various sources
function extractToken(req: NextRequest): string | null {
  try {
    // Try to get token from request body first (like in Vue implementation)
    const body = req.body ? JSON.parse(req.body as string) : null

    // Check for synapseToken in body (matching Vue implementation)
    if (body?.synapseToken) {
      console.log("Using synapseToken from request body")
      return body.synapseToken
    }

    // Check for Authorization header
    const authHeader = req.headers.get("Authorization")
    if (authHeader) {
      console.log("Using Authorization header")
      return authHeader.replace("Bearer ", "")
    }

    // Check for token in body as fallback
    if (body?.token) {
      console.log("Using token from request body")
      return body.token
    }

    // Try to get token from Vercel's special header
    const vercelHeaders = req.headers.get("x-vercel-sc-headers")
    if (vercelHeaders) {
      try {
        const parsedHeaders = JSON.parse(vercelHeaders)
        if (parsedHeaders.Authorization) {
          console.log("Using token from x-vercel-sc-headers")
          return parsedHeaders.Authorization.replace("Bearer ", "")
        }
      } catch (e) {
        console.error("Error parsing x-vercel-sc-headers:", e)
      }
    }

    console.log("No token found in request")
    return null
  } catch (error) {
    console.error("Error extracting token:", error)
    return null
  }
}

// Handle thread-based chat
async function handleThreadBasedChat(req: NextRequest) {
  try {
    // Extract token from request
    const token = extractToken(req)

    if (!token) {
      console.error("No token available in request")
      return NextResponse.json({ error: "Authentication required", details: "No token available" }, { status: 401 })
    }

    // Parse request body
    const body = await req.json()
    console.log("Request body:", JSON.stringify(body, null, 2))

    // Initialize LangGraph service with token
    const langGraphService = new LangGraphService(token)

    // Extract parameters from request
    const { threadId, messages, assistantId, config } = body

    // Create thread if needed
    let effectiveThreadId = threadId
    if (!effectiveThreadId) {
      console.log("Creating new thread")
      const newThread = await langGraphService.createThread()
      effectiveThreadId = newThread.thread_id
      console.log("Created thread:", effectiveThreadId)
    }

    // Invoke graph with messages
    console.log(`Invoking graph for thread ${effectiveThreadId}`)
    const response = await langGraphService.invokeGraph(assistantId, effectiveThreadId, {
      messages,
      config,
    })

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error in thread-based chat:", error)
    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  return handleThreadBasedChat(req)
}
