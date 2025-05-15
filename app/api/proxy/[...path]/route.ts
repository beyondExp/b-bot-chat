import { type NextRequest, NextResponse } from "next/server"

// Define a constant for the B-Bot API key - use the non-public version
const BBOT_API_KEY = process.env.ADMIN_API_KEY || ""

// Define the LangGraph API URL
const LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL || "https://api.langgraph.com"

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params.path, "GET")
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params.path, "POST")
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params.path, "PUT")
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return handleRequest(request, params.path, "DELETE")
}

async function handleRequest(request: NextRequest, pathSegments: string[], method: string) {
  try {
    // Construct the target URL
    const path = pathSegments.join("/")
    const url = new URL(`${LANGGRAPH_API_URL}/${path}`)

    // Copy query parameters
    const searchParams = new URLSearchParams(request.nextUrl.search)
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Add the B-Bot API key from server-side environment variable
    if (BBOT_API_KEY) {
      headers["bbot-api-key"] = BBOT_API_KEY
    }

    // Get the authorization header from the request
    const authHeader = request.headers.get("authorization")
    if (authHeader) {
      headers["Authorization"] = authHeader
    }

    // Get request body if it exists
    let body = null
    if (method !== "GET" && method !== "HEAD") {
      const contentType = request.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        body = await request.json()
      } else {
        body = await request.text()
      }
    }

    // Make the request to the LangGraph API
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    })

    // Handle streaming responses
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      return new NextResponse(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    // Handle regular JSON responses
    const responseData = await response.json()
    return NextResponse.json(responseData, { status: response.status })
  } catch (error) {
    console.error("Error in proxy:", error)
    return NextResponse.json({ error: "An error occurred while processing your request" }, { status: 500 })
  }
}
