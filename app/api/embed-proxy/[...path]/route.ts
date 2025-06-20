import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60 // Set max duration to 60 seconds for streaming

export async function GET(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleEmbedProxyRequest(request, params.path, "GET");
}

export async function POST(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleEmbedProxyRequest(request, params.path, "POST");
}

export async function PUT(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleEmbedProxyRequest(request, params.path, "PUT");
}

export async function DELETE(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleEmbedProxyRequest(request, params.path, "DELETE");
}

export async function PATCH(request: NextRequest, contextPromise: Promise<{ params: { path: string[] } }>) {
  const { params } = await contextPromise;
  return handleEmbedProxyRequest(request, params.path, "PATCH");
}

async function handleEmbedProxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  try {
    console.log("[EmbedProxy] Processing embed request");

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
    console.log("[EmbedProxy] URL :", url);
    
    // Copy query parameters
    const searchParams = new URLSearchParams(request.nextUrl.search)
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }

    // Prepare headers: copy all incoming headers
    const headers = new Headers(request.headers);

    // Always set Content-Type to application/json (or preserve original if needed)
    headers.set("Content-Type", "application/json");

    // For embed requests: always use Admin API Key (this proxy is dedicated to embeds)
    console.log("[EmbedProxy] Using Admin API Key for embed request");
    headers.set("X-API-Key", apiKey);
    headers.set("Admin-API-Key", apiKey);

    // Forward any Authorization header if present (for authenticated embed users)
    const authHeader = request.headers.get("Authorization")
    if (authHeader) {
      console.log("[EmbedProxy] Forwarding Authorization header for authenticated embed user");
      headers.set("Authorization", authHeader);
    }

    // Optionally, log forwarded headers for debugging
    console.log("[EmbedProxy] Forwarding headers:", {
      "Admin-API-Key": "***HIDDEN***",
      "X-User-ID": headers.get("X-User-ID"),
      "Authorization": authHeader ? "***PRESENT***" : "none",
    });

    console.log("[EmbedProxy] targetPath:", targetPath);

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
          console.log("[EmbedProxy] Streaming request detected");
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
        console.log("[EmbedProxy] Error parsing request body:", error);
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
      console.log("[EmbedProxy] Detected streaming response, setting up pass-through stream");
      
      if (!response.body) {
        return new Response("No stream", { status: 500 });
      }
      
      // Direct pass-through streaming without buffering
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Log chunk for debugging
          try {
            const chunkStr = new TextDecoder().decode(chunk);
            console.log(`[EmbedProxy][Stream][${new Date().toISOString()}] Passing through chunk:`, chunkStr.slice(0, 100));
          } catch (e) {
            console.log(`[EmbedProxy][Stream][${new Date().toISOString()}] Passing through binary chunk:`, chunk.length, 'bytes');
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
    console.log("[EmbedProxy] Error:", error);
    return NextResponse.json({ error: "Embed proxy error" }, { status: 500 })
  }
} 