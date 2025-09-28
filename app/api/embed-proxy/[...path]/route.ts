import { type NextRequest, NextResponse } from "next/server"

export const maxDuration = 60 // Set max duration to 60 seconds for streaming

// Helper function to create anonymous threads for embed mode
async function handleAnonymousThreadCreation() {
  console.log("[EmbedProxy] Creating anonymous thread for embed mode");
  
  try {
    // Create thread directly in LangGraph with admin authentication
    const langGraphApiUrl = process.env.LANGGRAPH_API_URL || "https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app"
    const apiKey = process.env.ADMIN_API_KEY || "your-super-secret-admin-key"
    
    // Set up headers for LangGraph API
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("X-User-ID", "anonymous-embed-user");
    headers.set("Admin-API-Key", apiKey);
    
    // Create thread payload
    const threadPayload = {
      metadata: {
        anonymous: true,
        distributionChannel: { type: "Embed" },
        user_id: "anonymous-embed-user"
      }
    };
    
    console.log("[EmbedProxy] Creating thread in LangGraph with payload:", threadPayload);
    
    // Make request to create thread in LangGraph
    const response = await fetch(`${langGraphApiUrl}/threads`, {
      method: "POST",
      headers,
      body: JSON.stringify(threadPayload),
    });
    
    console.log("[EmbedProxy] LangGraph thread creation response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[EmbedProxy] Failed to create thread in LangGraph:", errorText);
      
      // Fallback to local anonymous thread if LangGraph creation fails
      const fallbackThreadId = `embed-anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fallbackThread = {
        thread_id: fallbackThreadId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: "anonymous-embed-user",
        metadata: { 
          anonymous: true,
          distributionChannel: { type: "Embed" }
        },
        status: "idle",
        config: {},
        values: {}
      };
      
      console.log("[EmbedProxy] Using fallback anonymous thread:", fallbackThreadId);
      return Response.json(fallbackThread, { status: 201 });
    }
    
    const threadData = await response.json();
    console.log("[EmbedProxy] Successfully created thread in LangGraph:", threadData.thread_id);
    
    return Response.json(threadData, { status: 201 });
    
  } catch (error) {
    console.error("[EmbedProxy] Error creating anonymous thread:", error);
    
    // Fallback to local anonymous thread on any error
    const fallbackThreadId = `embed-anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fallbackThread = {
      thread_id: fallbackThreadId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: "anonymous-embed-user",
      metadata: { 
        anonymous: true,
        distributionChannel: { type: "Embed" }
      },
      status: "idle",
      config: {},
      values: {}
    };
    
    console.log("[EmbedProxy] Using fallback anonymous thread after error:", fallbackThreadId);
    return Response.json(fallbackThread, { status: 201 });
  }
}

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

const LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL || "https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

// Helper to check for valid UUID
function isValidUUID(uuid: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

async function handleEmbedProxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  try {
    console.log("[EmbedProxy] Processing embed request");

    // Add detailed logging to check for the environment variable
    console.log(`[EmbedProxy] Checking for ADMIN_API_KEY. Is it set? ${!!process.env.ADMIN_API_KEY}`);

    // Get the API key from environment variables (server-side only)
    // Use the same default as MainAPI if not configured
    const apiKey = process.env.ADMIN_API_KEY || "your-super-secret-admin-key"

    console.log("[EmbedProxy] Using API key:", apiKey === "your-super-secret-admin-key" ? "default key" : "custom key");

    // Construct the target path
    const targetPath = pathSegments.join("/")
    console.log("[EmbedProxy] Target path:", targetPath);

    // Special handling for different request types in embed mode
    const isAssistantByIdRequest = targetPath.match(/^assistants\/([^\/]+)$/) && method === "GET"
    const isThreadCreationRequest = targetPath === "threads" && method === "POST"
    // Match any stream request (embed mode should handle all streaming anonymously)
    const isStreamRequest = targetPath.match(/^threads\/[^\/]+\/runs\/stream$/) && method === "POST"
    // Match history requests (embed mode should handle these anonymously too)
    const isHistoryRequest = targetPath.match(/^threads\/[^\/]+\/history$/) && method === "POST"
    const isThreadMetadataUpdateRequest = method === 'PATCH' && pathSegments.length === 2 && pathSegments[0] === 'threads' && isValidUUID(pathSegments[1]);
    
    // Handle thread creation early return
    if (isThreadCreationRequest) {
      // For thread creation in embed mode, create anonymous threads locally
      console.log("[EmbedProxy] Handling anonymous thread creation for embed mode");
      return handleAnonymousThreadCreation();
    }

    if (isThreadMetadataUpdateRequest) {
      console.log('[EMBED-PROXY] Handling thread metadata update request:', pathSegments.join('/'));
      const targetUrl = `${LANGGRAPH_API_URL}/${pathSegments.join('/')}${request.nextUrl.search}`;
      
      const headers = new Headers(request.headers);
      headers.set('x-api-key', ADMIN_API_KEY);
      headers.delete('host');
      headers.delete('authorization');

      console.log('[EMBED-PROXY] Forwarding metadata update to LangGraph:', targetUrl);

      try {
        const response = await fetch(targetUrl, {
          method: method,
          headers: headers,
          body: await request.text(),
          redirect: 'manual',
        });

        return response;
      } catch (error) {
        console.error('[EMBED-PROXY] Error forwarding metadata update request to LangGraph:', error);
        return new Response(JSON.stringify({ message: 'Error forwarding request' }), { status: 502 });
      }
    }
    
    // Handle streaming requests in embed mode
    if (isStreamRequest) {
      console.log("[EmbedProxy] Handling stream request for embed mode");
      // Route directly to LangGraph API, bypassing MainAPI user authentication
      const langGraphApiUrl = process.env.LANGGRAPH_API_URL || "https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app"
      const url = new URL(`${langGraphApiUrl}/${targetPath}`)
      console.log("[EmbedProxy] Routing stream directly to LangGraph:", url);
      
      // Copy query parameters
      const searchParams = new URLSearchParams(request.nextUrl.search)
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.append(key, value)
      }
      
      // Set up headers for direct LangGraph access
      const headers = new Headers(request.headers);
      headers.set("Content-Type", "application/json");
      
      // Use a system/admin token for anonymous embed requests
      // This bypasses individual user authentication
      headers.set("X-User-ID", "anonymous-embed-user");
      headers.set("Admin-API-Key", apiKey);
      
      // Get request body for streaming
      let body = null
      try {
        body = await request.json()
        console.log("[EmbedProxy] Stream request body:", JSON.stringify(body, null, 2));
      } catch (error) {
        console.log("[EmbedProxy] Error parsing stream request body:", error);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
      }
      
      // Make the streaming request directly to LangGraph
      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      
      console.log("[EmbedProxy] LangGraph stream response status:", response.status);
      
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
      } else {
        // For non-streaming responses from LangGraph
        const data = await response.json();
        return Response.json(data, { status: response.status });
      }
    }
    
    // Handle history requests in embed mode
    if (isHistoryRequest) {
      console.log("[EmbedProxy] Handling history request for embed mode");
      // Route directly to LangGraph API, bypassing MainAPI user authentication
      const langGraphApiUrl = process.env.LANGGRAPH_API_URL || "https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app"
      const url = new URL(`${langGraphApiUrl}/${targetPath}`)
      console.log("[EmbedProxy] Routing history directly to LangGraph:", url);
      
      // Copy query parameters
      const searchParams = new URLSearchParams(request.nextUrl.search)
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.append(key, value)
      }
      
      // Set up headers for direct LangGraph access
      const headers = new Headers(request.headers);
      headers.set("Content-Type", "application/json");
      
      // Use admin token for anonymous embed requests
      headers.set("X-User-ID", "anonymous-embed-user");
      headers.set("Admin-API-Key", apiKey);
      
      // Get request body for history request
      let body = null
      try {
        body = await request.json()
        console.log("[EmbedProxy] History request body:", JSON.stringify(body, null, 2));
      } catch (error) {
        console.log("[EmbedProxy] Error parsing history request body:", error);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
      }
      
      // Make the history request directly to LangGraph
      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      
      console.log("[EmbedProxy] LangGraph history response status:", response.status);
      
      // Handle the response
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[EmbedProxy] History request failed:", errorText);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: response.status });
      }
      
      const historyData = await response.json();
      console.log("[EmbedProxy] Successfully fetched history");
      return Response.json(historyData, { status: response.status });
    }
    
    // For other requests, set up the target URL
    let url: URL
    const mainApiUrl = process.env.LANGGRAPH_API_URL || "https://api.b-bot.space/api"
    url = new URL(`${mainApiUrl}/v2/${targetPath}`)
    if (isAssistantByIdRequest) {
      console.log("[EmbedProxy] Routing assistant by ID request to single assistant endpoint:", url);
    } else {
      console.log("[EmbedProxy] Routing through MainAPI to LangGraph:", url);
    }
    
    // Copy query parameters
    const searchParams = new URLSearchParams(request.nextUrl.search)
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.append(key, value)
    }

    // Prepare headers: copy all incoming headers
    const headers = new Headers(request.headers);

    // Always set Content-Type to application/json (or preserve original if needed)
    headers.set("Content-Type", "application/json");

    // Configure headers for all proxied requests
    console.log("[EmbedProxy] Using Admin API Key as adminapikey header for embed request");
    headers.set("adminapikey", apiKey);

    // Forward any existing Authorization header if present (for authenticated embed users)
    const authHeader = request.headers.get("Authorization")
    if (authHeader) {
      console.log("[EmbedProxy] Forwarding Authorization header for authenticated embed user");
      headers.set("Authorization", authHeader);
    }

    // Optionally, log forwarded headers for debugging
    console.log("[EmbedProxy] Forwarding headers:", {
      "adminapikey": "***HIDDEN***",
      "Authorization": authHeader ? "***PRESENT***" : "none",
      "X-User-ID": headers.get("X-User-ID"),
    });

    // Log the final target URL
    console.log("[EmbedProxy] Final target URL:", url.toString());

    // Get the request body and handle special cases
    let body = null
    let requestMethod = method
    
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
            stream_mode: body.stream_mode || ["messages", "updates"], // Use messages/updates for proper event streaming
            // Enable subgraph streaming to get namespace detection like B-Bot Hub
            stream_subgraphs: true,
            subgraphs: true,
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

    // Make the request through MainAPI which proxies to LangGraph
    const response = await fetch(url.toString(), {
      method: requestMethod,
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

    // For non-streaming responses, handle the JSON
    const data = await response.json();
    console.log("[EmbedProxy] Response status:", response.status);
    console.log("[EmbedProxy] Response data type:", typeof data);
    console.log("[EmbedProxy] Response data length:", Array.isArray(data) ? data.length : "not an array");
    console.log("[EmbedProxy] Response data:", JSON.stringify(data, null, 2));
    
    return Response.json(data, { status: response.status });
  } catch (error) {
    console.log("[EmbedProxy] Error:", error);
    return NextResponse.json({ error: "Embed proxy error" }, { status: 500 })
  }
} 