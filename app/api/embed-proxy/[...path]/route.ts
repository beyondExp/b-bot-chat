import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { applyDefaultBbotModel, isBBotAssistantId } from "@/lib/bbot-default-model"

export const maxDuration = 60 // Set max duration to 60 seconds for streaming
const STREAM_DEBUG = process.env.STREAM_DEBUG === "1"

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

// Helper function to create anonymous threads for embed mode
async function handleAnonymousThreadCreation(request: NextRequest) {
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
    
    // Try to extract assistant/agent and expert from the embed context
    let agentId: string | undefined = undefined;
    let expertId: string | undefined = undefined;
    try {
      // Prefer explicit headers if provided
      const headerAgent = request.headers.get('x-embed-agent-id') || request.headers.get('x-assistant-id');
      const headerExpert = request.headers.get('x-embed-expert-id') || request.headers.get('x-expert-id');

      // Fallback to referer URL query params
      const referer = request.headers.get('referer') || '';
      if (referer) {
        const refUrl = new URL(referer);
        const qpAgent = refUrl.searchParams.get('agent') || refUrl.searchParams.get('assistantId') || undefined;
        const qpExpert = refUrl.searchParams.get('expertId') || undefined;
        agentId = (headerAgent || qpAgent || undefined) as string | undefined;
        expertId = (headerExpert || qpExpert || undefined) as string | undefined;
      } else {
        agentId = headerAgent || undefined;
        expertId = headerExpert || undefined;
      }
    } catch (e) {
      console.log('[EmbedProxy] Failed to parse embed context for agent/expert:', e);
    }

    // Create thread payload
    const threadPayload: any = {
      metadata: {
        anonymous: true,
        distributionChannel: { type: "Embed" },
        user_id: "anonymous-embed-user"
      }
    };

    // Enrich metadata when available so Hub can later filter by expert_id
    if (agentId) {
      // Enforce password protection (if configured) before creating threads.
      const pwErr = await _requireEmbedPasswordIfConfigured(request, agentId)
      if (pwErr) return pwErr
      threadPayload.metadata.assistant_id = agentId;
      threadPayload.metadata.agent_id = agentId;
      threadPayload.metadata.entity_id = `anonymoususer_${agentId}`;
    }
    if (expertId) {
      threadPayload.metadata.expert_id = isNaN(Number(expertId)) ? expertId : Number(expertId);
    }
    
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

const LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL || ""
const MAIN_API_URL = process.env.MAIN_API_URL || process.env.MAIN_API_PUBLIC_URL || ""
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || ""

function _sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(String(s || ""), "utf8").digest("hex")
}

function _getEmbedPasswordFromRequest(req: NextRequest): string | null {
  const h = req.headers.get("x-embed-password") || req.headers.get("X-Embed-Password")
  const pw = (h || "").trim()
  return pw ? pw : null
}

async function _fetchAssistantForEmbedCheck(assistantId: string) {
  const langGraphApiUrl = LANGGRAPH_API_URL
  const apiKey = ADMIN_API_KEY
  const url = new URL(`${langGraphApiUrl}/assistants/${assistantId}`)
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-User-ID": "admin",
      "Admin-API-Key": apiKey,
    },
  })
  if (!res.ok) return null
  return (await res.json().catch(() => null)) as any
}

function _extractEmbedPasswordConfig(assistant: any): { protected: boolean; salt?: string; hash?: string } {
  try {
    const meta = assistant?.metadata
    const dc = meta?.distributionChannel
    const cfg = dc?.config
    const salt = typeof cfg?.embed_password_salt === "string" ? cfg.embed_password_salt : ""
    const hash = typeof cfg?.embed_password_hash === "string" ? cfg.embed_password_hash : ""
    const protFlag = cfg?.password_protected === true || Boolean(salt && hash)
    if (protFlag && salt && hash) return { protected: true, salt, hash }
    if (protFlag) return { protected: true }
    return { protected: false }
  } catch {
    return { protected: false }
  }
}

function _stripEmbedPasswordSecrets(assistant: any) {
  try {
    const clone = assistant && typeof assistant === "object" ? JSON.parse(JSON.stringify(assistant)) : assistant
    const cfg = clone?.metadata?.distributionChannel?.config
    if (cfg && typeof cfg === "object") {
      delete cfg.embed_password_salt
      delete cfg.embed_password_hash
    }
    // expose only a boolean
    if (cfg && typeof cfg === "object") {
      cfg.password_protected = Boolean(cfg?.password_protected || false)
    }
    clone.password_protected = Boolean(cfg?.password_protected || false)
    return clone
  } catch {
    return assistant
  }
}

async function _requireEmbedPasswordIfConfigured(req: NextRequest, assistantId: string): Promise<Response | null> {
  try {
    const assistant = await _fetchAssistantForEmbedCheck(assistantId)
    if (!assistant) return null
    const cfg = _extractEmbedPasswordConfig(assistant)
    if (!cfg.protected) return null
    const pw = _getEmbedPasswordFromRequest(req)
    if (!pw || !cfg.salt || !cfg.hash) {
      return NextResponse.json({ error: "embed_password_required" }, { status: 401 })
    }
    const got = _sha256Hex(String(cfg.salt) + pw)
    if (got !== cfg.hash) {
      return NextResponse.json({ error: "embed_password_invalid" }, { status: 401 })
    }
    return null
  } catch {
    return NextResponse.json({ error: "embed_password_check_failed" }, { status: 401 })
  }
}

// Helper to check for valid UUID
function isValidUUID(uuid: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

async function handleEmbedProxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  try {
    console.log("[EmbedProxy] Processing embed request");

    if (!MAIN_API_URL) {
      return NextResponse.json({ error: "MAIN_API_URL not configured" }, { status: 500 })
    }
    if (!LANGGRAPH_API_URL) {
      return NextResponse.json({ error: "LANGGRAPH_API_URL not configured" }, { status: 500 })
    }

    // Get the API key from environment variables (server-side only)
    // Use the same default as MainAPI if not configured
    const apiKey = ADMIN_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "ADMIN_API_KEY not configured" }, { status: 500 })
    }

    console.log("[EmbedProxy] Using API key:", "***PRESENT***")

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
      return handleAnonymousThreadCreation(request);
    }

    if (isThreadMetadataUpdateRequest) {
      console.log('[EMBED-PROXY] Handling thread metadata update request:', pathSegments.join('/'));
      const targetUrl = `${LANGGRAPH_API_URL}/${pathSegments.join('/')}${request.nextUrl.search}`;
      
      const headers = new Headers(request.headers);
      // Synapse expects Admin-API-Key for admin auth
      headers.set('Admin-API-Key', apiKey);
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
      let streamTargetPath = targetPath
      
      // Use a minimal header set for upstream streaming.
      // Forwarding browser hop-by-hop headers can destabilize the SSE transport.
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("X-User-ID", "anonymous-embed-user");
      headers.set("Admin-API-Key", apiKey);
      const requestId = request.headers.get("x-request-id") || request.headers.get("x-requestid")
      if (requestId) headers.set("X-Request-ID", requestId);
      
      // Get request body for streaming
      let body = null
      try {
        body = await request.json()
        body = applyDefaultBbotModel(body)
        body = injectGeminiApiKey(body)
        if (STREAM_DEBUG) console.log("[EmbedProxy] Stream request body:", JSON.stringify(body, null, 2));
      } catch (error) {
        console.log("[EmbedProxy] Error parsing stream request body:", error);
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
      }

      // Enforce password protection for the target assistant
      const assistantId =
        (typeof (body as any)?.assistant_id === "string" && (body as any).assistant_id.trim() ? (body as any).assistant_id.trim() : "") ||
        (typeof (body as any)?.assistantId === "string" && (body as any).assistantId.trim() ? (body as any).assistantId.trim() : "") ||
        (typeof (body as any)?.config?.configurable?.assistant_id === "string" && (body as any).config.configurable.assistant_id.trim()
          ? (body as any).config.configurable.assistant_id.trim()
          : "") ||
        (typeof (body as any)?.config?.configurable?.agent_id === "string" && (body as any).config.configurable.agent_id.trim()
          ? (body as any).config.configurable.agent_id.trim()
          : "")
      if (assistantId) {
        const pwErr = await _requireEmbedPasswordIfConfigured(request, assistantId)
        if (pwErr) return pwErr
      }

      // B-Bot has a dedicated stream proxy in Synapse that is more stable than
      // the raw /threads/{id}/runs/stream path for browser streaming.
      if (isBBotAssistantId(assistantId) && pathSegments.length >= 4) {
        streamTargetPath = `bbot/threads/${pathSegments[1]}/runs/stream`
      }

      const url = new URL(`${langGraphApiUrl}/${streamTargetPath}`)
      const searchParams = new URLSearchParams(request.nextUrl.search)
      for (const [key, value] of searchParams.entries()) {
        url.searchParams.append(key, value)
      }
      console.log("[EmbedProxy] Routing stream directly to LangGraph:", url);
      
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
        
        // Return the stream directly (no per-chunk logging/decoding which slows streaming a lot)
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

      // Enforce password based on thread metadata assistant_id (best-effort).
      try {
        const threadId = pathSegments[1]
        if (threadId) {
          const tRes = await fetch(`${langGraphApiUrl}/threads/${encodeURIComponent(threadId)}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "X-User-ID": "admin",
              "Admin-API-Key": apiKey,
            },
          })
          if (tRes.ok) {
            const tData: any = await tRes.json().catch(() => null)
            const assistantId = String(tData?.metadata?.assistant_id || tData?.metadata?.agent_id || "").trim()
            if (assistantId) {
              const pwErr = await _requireEmbedPasswordIfConfigured(request, assistantId)
              if (pwErr) return pwErr
            }
          }
        }
      } catch {
        // ignore and continue
      }
      
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
        if (STREAM_DEBUG) console.log("[EmbedProxy] History request body:", JSON.stringify(body, null, 2));
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
    if (isAssistantByIdRequest) {
      // For individual assistant requests, fetch directly from LangGraph to also reveal password protection
      // (but never expose password hash/salt).
      try {
        const assistantId = String(pathSegments[1] || "").trim()
        if (assistantId) {
          const assistant = await _fetchAssistantForEmbedCheck(assistantId)
          if (assistant) {
            const cfg = _extractEmbedPasswordConfig(assistant)
            if (cfg.protected) {
              try {
                assistant.metadata = assistant.metadata || {}
                assistant.metadata.distributionChannel = assistant.metadata.distributionChannel || {}
                assistant.metadata.distributionChannel.config = assistant.metadata.distributionChannel.config || {}
                assistant.metadata.distributionChannel.config.password_protected = true
              } catch {}
            }
            return NextResponse.json(_stripEmbedPasswordSecrets(assistant), { status: 200 })
          }
        }
      } catch {
        // fall back below
      }
      url = new URL(`${MAIN_API_URL}/v3/public/distribution-channels/${pathSegments[1]}`)
      console.log("[EmbedProxy] Routing assistant by ID request to distribution channels endpoint:", url);
    } else {
      // Handle other requests through MainAPI proxy to LangGraph  
      url = new URL(`${MAIN_API_URL}/v2/${targetPath}`)
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
    console.log("[EmbedProxy] Using Admin API Key as X-API-Key header for embed request");
    headers.set("X-API-Key", apiKey);

    // Forward any existing Authorization header if present (for authenticated embed users)
    const authHeader = request.headers.get("Authorization")
    if (authHeader) {
      console.log("[EmbedProxy] Forwarding Authorization header for authenticated embed user");
      headers.set("Authorization", authHeader);
    }

    // Optionally, log forwarded headers for debugging
    console.log("[EmbedProxy] Forwarding headers:", {
      "Admin-API-Key": isAssistantByIdRequest ? "none" : "***HIDDEN***",
      "X-API-Key": isAssistantByIdRequest ? "***HIDDEN***" : "none",
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
        body = applyDefaultBbotModel(body)
        body = injectGeminiApiKey(body)

        // If this is a streaming request to /threads/{threadId}/runs/stream
        // Format the payload according to the expected structure
        if (targetPath.includes("/runs/stream")) {
          // Extract the input and config from the request body
          const { input, config } = body
          // This is an SSE response; request payload is still JSON.
          headers.set("Accept", "text/event-stream");
          console.log("[EmbedProxy] Streaming request detected");
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
            stream_mode: body.stream_mode || ["messages", "updates"], // Use messages/updates for proper event streaming
            // Enable subgraph streaming to get namespace detection like B-Bot Hub
            stream_subgraphs: true,
            subgraphs: true,
            on_disconnect: body.on_disconnect || "cancel",
            assistant_id: assistantIdCandidate || undefined
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
      
      // Return the stream with comprehensive headers for real-time streaming
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