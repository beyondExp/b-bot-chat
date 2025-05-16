import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60 // Set max duration to 60 seconds for streaming

export async function GET(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleProxyRequest(request, params.path, "GET");
}

export async function POST(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleProxyRequest(request, params.path, "POST");
}

export async function PUT(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleProxyRequest(request, params.path, "PUT");
}

export async function DELETE(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleProxyRequest(request, params.path, "DELETE");
}

export async function PATCH(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleProxyRequest(request, params.path, "PATCH");
}

async function handleProxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  try {
    // Log the Authorization header for debugging
    const incomingAuthHeader = request.headers.get("Authorization");
    console.log("[Proxy] Incoming Authorization header:", incomingAuthHeader);

    // Get the LangGraph API URL from environment variables
    const langGraphApiUrl = process.env.LANGGRAPH_API_URL || "https://api-staging.b-bot.space/api/v2"

    // Get the API key from environment variables (server-side only)
    const apiKey = process.env.ADMIN_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    // Construct the target URL
    const targetPath = pathSegments.join("/")
    const url = new URL(`${langGraphApiUrl}/${targetPath}`)

    // Copy query parameters
    const searchParams = new URLSearchParams(request.nextUrl.search)
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }

    // Prepare headers
    const headers = new Headers()
    headers.set("Content-Type", "application/json")

    // Add the API key header
    headers.set("bbot-api-key", apiKey)

    // Forward the Authorization header if present
    const authHeader = request.headers.get("Authorization")
    if (authHeader) {
      console.log("[Proxy] Forwarding Authorization header:", authHeader);
      headers.set("Authorization", authHeader)
    }

    // Get the request body if it's not a GET request
    let body = null
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await request.json()

        // If this is a streaming request to /threads/{threadId}/runs/stream
        // Format the payload according to the expected structure
        if (targetPath.includes("/threads/") && targetPath.includes("/runs/stream")) {
          // Extract the input and config from the request body
          const { input, config } = body

          // Create the properly formatted payload
          const formattedBody = {
            input,
            config,
            stream_mode: body.stream_mode || ["values", "messages", "updates"],
            stream_subgraphs: body.stream_subgraphs !== false,
            subgraphs: body.subgraphs !== false,
            on_disconnect: body.on_disconnect || "cancel",
          }

          body = formattedBody
        }
      } catch (error) {
        // Silent error handling for body parsing
      }
    }

    // Make the request to the LangGraph API
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    })

    // Handle streaming responses
    if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
      if (!response.body) {
        return new Response("No stream", { status: 500 });
      }
      const { readable, writable } = new TransformStream();
      const reader = response.body.getReader();
      const writer = writable.getWriter();
      (async () => {
        const encoder = new TextEncoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            await writer.write(value);
            await writer.write(encoder.encode("\n")); // helps flush in some environments
          }
        }
        await writer.close();
      })();
      // Use the native Response, not NextResponse
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // For non-streaming responses, return the JSON
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: "Proxy error" }, { status: 500 })
  }
}
