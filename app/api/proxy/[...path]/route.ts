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
    const langGraphApiUrl = process.env.LANGGRAPH_API_URL || "https://api.b-bot.space/api/v2"

    // Get the API key from environment variables (server-side only)
    const apiKey = process.env.ADMIN_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 })
    }

    // Construct the target URL
    const targetPath = pathSegments.join("/")
    const url = new URL(`${langGraphApiUrl}/${targetPath}`)
    console.log("[Proxy] URL :", url);
    // Copy query parameters
    const searchParams = new URLSearchParams(request.nextUrl.search)
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }

    // Prepare headers: copy all incoming headers
    const headers = new Headers(request.headers);

    // Always set Content-Type to application/json (or preserve original if needed)
    headers.set("Content-Type", "application/json");

    // Always set the API key headers (override if present)
    headers.set("X-API-Key", apiKey);
    headers.set("Admin-API-Key", apiKey);

    // Optionally, log forwarded headers for debugging
    console.log("[Proxy] Forwarding headers:", {
      "Admin-API-Key": headers.get("Admin-API-Key"),
      "X-User-ID": headers.get("X-User-ID"),
      "Authorization": headers.get("Authorization"),
    });

    // Forward the Authorization header if present
    const authHeader = request.headers.get("Authorization")
    if (authHeader) {
      console.log("[Proxy] Forwarding Authorization header:", authHeader);
      headers.set("Authorization", authHeader)
    }

    console.log("[Proxy] targetPath:", targetPath);
    console.log("[Proxy] headers:", Object.fromEntries(headers.entries()));

    // Get the request body if it's not a GET request
    let body = null
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await request.json()

        // If this is a streaming request to /threads/{threadId}/runs/stream
        // Format the payload according to the expected structure
        if (targetPath.includes("/runs/stream")) {
          // Extract the input and config from the request body
          const { input, config } = body
          headers.set("Content-Type", "text/event-stream");
          headers.set("Accept", "text/event-stream");
          console.log("[Proxy] Streaming request detected");
          // Create the properly formatted payload
          const formattedBody = {
            input,
            config,
            stream_mode: body.stream_mode || ["values", "messages", "updates"],
            stream_subgraphs: body.stream_subgraphs !== false,
            subgraphs: body.subgraphs !== false,
            on_disconnect: body.on_disconnect || "cancel",
            assistant_id: config?.agent_id || body.assistant_id
          }

          body = formattedBody
        }
      } catch (error) {
        console.log("[Proxy] Error parsing request body:", error);
        // Silent error handling for body parsing
      }
    }

    // Always remove Content-Length if body is changed
    headers.delete("Content-Length");

    // Make the request to the LangGraph API
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    })

    // Handle streaming responses
    if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
      console.log("[Proxy] Detected streaming response, setting up pass-through stream");
      
      if (!response.body) {
        return new Response("No stream", { status: 500 });
      }
      
      // Direct pass-through streaming without buffering
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Log chunk for debugging
          try {
            const chunkStr = new TextDecoder().decode(chunk);
            console.log(`[Proxy][Stream][${new Date().toISOString()}] Passing through chunk:`, chunkStr.slice(0, 100));
          } catch (e) {
            console.log(`[Proxy][Stream][${new Date().toISOString()}] Passing through binary chunk:`, chunk.length, 'bytes');
          }
          
          // Pass through immediately without any processing
          controller.enqueue(chunk);
        }
      });

      // Pipe the response body through our transform stream
      const transformedStream = response.body.pipeThrough(transformStream);

      // Return the stream with comprehensive headers for real-time streaming
      return new Response(transformedStream, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no", // Disable Nginx buffering
          "Transfer-Encoding": "chunked",
          // CORS headers
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "*",
        },
      });
    }

    // For non-streaming responses, return the JSON
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.log("[Proxy] Error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 })
  }
}
