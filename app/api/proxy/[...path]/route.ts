import { type NextRequest, NextResponse } from "next/server"
import { applyDefaultBbotModel } from "@/lib/bbot-default-model"

export const maxDuration = 60 // Set max duration to 60 seconds for streaming
const STREAM_DEBUG = process.env.STREAM_DEBUG === "1"

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

function injectGeminiApiKey(body: any) {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) return body

  const configurable =
    body?.config?.configurable ?? body?.configurable ?? body?.config?.configurable ?? body?.config?.configurable
  const modalities = configurable?.output_modalities
  if (!Array.isArray(modalities)) return body

  configurable.output_modalities = modalities.map((m: any) => {
    if (!m || m.type !== "tts") return m

    const modelName = (typeof m.model === "string" ? m.model : m.model_name) as any
    const isGoogle =
      m.provider === "google" ||
      (typeof modelName === "string" && modelName.startsWith("google/"))
    if (!isGoogle) return m

    if (!m.api_key) {
      return { ...m, api_key: geminiKey }
    }
    return m
  })

  return body
}

async function handleProxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  try {
    // Log the incoming headers for debugging
    const incomingAuthHeader = request.headers.get("Authorization");
    const incomingApiKeyHeader = request.headers.get("X-API-Key");
    console.log("[Proxy] Incoming Authorization header:", incomingAuthHeader);
    console.log("[Proxy] Incoming X-API-Key header:", incomingApiKeyHeader ? "***PRESENT***" : "none");
    
    // Special debugging for history requests
    if (pathSegments.some(segment => segment === 'history')) {
      console.log("[Proxy] HISTORY REQUEST - Method:", method);
      console.log("[Proxy] HISTORY REQUEST - Path:", pathSegments.join('/'));
      console.log("[Proxy] HISTORY REQUEST - All headers:", Object.fromEntries(request.headers.entries()));
    }

    // Get the LangGraph API URL from environment variables
    const langGraphApiUrl = process.env.LANGGRAPH_API_URL || process.env.SYNAPSE_URL || "http://localhost:2024"

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

    // This proxy is for authenticated main chat requests only
    const authHeader = request.headers.get("Authorization");
    const apiKeyHeader = request.headers.get("X-API-Key");

    if (authHeader) {
      // For authenticated main chat requests: use user's Authorization token
      console.log("[Proxy] Authenticated main chat request detected, forwarding Authorization header");
      headers.set("Authorization", authHeader);
      // Do NOT set Admin API Key for authenticated users - this ensures user isolation
    } else if (apiKeyHeader) {
      // LangGraph SDK sends Bearer token as X-API-Key, convert to Authorization header
      console.log("[Proxy] Detected X-API-Key header, converting to Authorization Bearer token");
      
      // Clean up the API key - handle potential duplicates and whitespace
      const cleanApiKey = apiKeyHeader.split(',')[0].trim();
      console.log("[Proxy] Original X-API-Key length:", apiKeyHeader.length, "Clean length:", cleanApiKey.length);
      
      headers.set("Authorization", `Bearer ${cleanApiKey}`);
      // Remove the X-API-Key header to avoid confusion
      headers.delete("X-API-Key");
    } else {
      // For unauthenticated main chat requests: reject (embed should use /api/embed-proxy)
      console.log("[Proxy] Unauthenticated main chat request, rejecting. Use /api/embed-proxy for embed requests.");
      return NextResponse.json({ error: "Authentication required. Use embed-proxy for anonymous requests." }, { status: 401 });
    }

    // Optionally, log forwarded headers for debugging
    console.log("[Proxy] Forwarding headers:", {
      "Authorization": headers.get("Authorization") ? "***PRESENT***" : "none",
      "X-API-Key": headers.get("X-API-Key") ? "***PRESENT***" : "none",
      "X-User-ID": headers.get("X-User-ID"),
    });

    console.log("[Proxy] targetPath:", targetPath);
    console.log("[Proxy] headers:", Object.fromEntries(headers.entries()));

    // Get the request body if it's not a GET request
    let body = null
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await request.json()
        // If the client accidentally sends a JSON-encoded string (e.g. "\"{...}\""),
        // parse it back into an object so upstream receives a dictionary.
        if (typeof body === "string") {
          try {
            const parsed = JSON.parse(body)
            body = parsed
          } catch {
            // keep as-is
          }
        }
        body = applyDefaultBbotModel(body)
        body = injectGeminiApiKey(body)

        // If this is a streaming request to /threads/{threadId}/runs/stream
        // Format the payload according to the expected structure
        if (targetPath.includes("/runs/stream")) {
          // Extract the input and config from the request body
          const { input, config } = body
          // This is an SSE *response*; the request payload is still JSON.
          headers.set("Accept", "text/event-stream");
          console.log("[Proxy] Streaming request detected");
          const assistantIdCandidate =
            (typeof body?.assistant_id === "string" && body.assistant_id.trim() ? body.assistant_id.trim() : "") ||
            (typeof body?.assistantId === "string" && body.assistantId.trim() ? body.assistantId.trim() : "") ||
            (typeof config?.configurable?.assistant_id === "string" && config.configurable.assistant_id.trim()
              ? config.configurable.assistant_id.trim()
              : "") ||
            (typeof config?.configurable?.agent_id === "string" && config.configurable.agent_id.trim()
              ? config.configurable.agent_id.trim()
              : "")
          // Create the properly formatted payload
          const formattedBody = {
            input,
            config,
            stream_mode: body.stream_mode || ["values", "messages", "updates"],
            stream_subgraphs: body.stream_subgraphs !== false,
            subgraphs: body.subgraphs !== false,
            on_disconnect: body.on_disconnect || "cancel",
            assistant_id: assistantIdCandidate || undefined
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
    const upstreamBody = body == null ? null : typeof body === "string" ? body : JSON.stringify(body)
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: upstreamBody,
    })

    // Handle streaming responses
    if (response.headers.get("Content-Type")?.includes("text/event-stream")) {
      console.log("[Proxy] Detected streaming response, setting up pass-through stream");
      
      if (!response.body) {
        return new Response("No stream", { status: 500 });
      }

      // Return the stream with comprehensive headers for real-time streaming
      if (STREAM_DEBUG) console.log("[Proxy] Streaming pass-through enabled");
      return new Response(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-store, must-revalidate, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no", // Disable Nginx buffering
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
