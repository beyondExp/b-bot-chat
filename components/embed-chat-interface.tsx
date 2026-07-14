"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { ChatInput } from "./chat-input"
import { EnhancedChatMessages } from "./enhanced-chat-messages"
// Temporarily remove tool response handling to avoid type conflicts  
// import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses"
import { EmbedChatHeader } from "./embed-chat-header"
import { ChatHistorySidebar } from "./chat-history-sidebar"
import { getAuthToken, isLocallyAuthenticated } from "@/lib/api"
import { LANGGRAPH_AUDIENCE } from "@/lib/api"
import { useAgents } from "@/lib/agent-service"
import { useRouter } from 'next/router'
import { useStream } from "@langchain/langgraph-sdk/react"
import type { Message } from "@langchain/langgraph-sdk"
import { ChatHistoryManager, ChatSession } from "@/lib/chat-history"
import { messageMetadataManager, type ChatMessage, type MessageMetadata } from "@/lib/message-metadata"
import { useAppAuth } from "@/lib/app-auth"
import { buildSystemMessageWithUserProfile, loadChatUserProfile } from "@/lib/chat-user-profile"
import { useI18n } from "@/lib/i18n"

interface EmbedChatInterfaceProps {
  initialAgent?: string
  embedUserId?: string | null
  embedId?: string
}

type ChatStreamMessage = {
  id?: string
  type?: string
  content?: unknown
}

export function EmbedChatInterface({ initialAgent, embedUserId, embedId }: EmbedChatInterfaceProps) {
  const { t } = useI18n()
  // Normalize agent id: treat 'b-bot' and 'bbot' as the same
  const normalizedAgent = (!initialAgent || initialAgent === "b-bot" || initialAgent === "bbot") ? "bbot" : initialAgent;
  const [selectedAgent] = useState<string>(normalizedAgent);
  const [tokensUsed, setTokensUsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const initialScrollDoneRef = useRef(false)
  const [input, setInput] = useState("")
  const [replyContext, setReplyContext] = useState<{ name: string; preview: string } | null>(null)
  const [agentValid, setAgentValid] = useState<boolean>(false)
  const [agentError, setAgentError] = useState<string>("")
  const { getAgent } = useAgents()
  const [agentObj, setAgentObj] = useState<any>(null);
  const [toolEvents, setToolEvents] = useState<any[]>([])
  const [embedPassword, setEmbedPassword] = useState<string>("")
  const embedPasswordKey = useMemo(() => `bbot.embed.pw.${selectedAgent}`, [selectedAgent])

  // Add tool event handling like B-Bot Hub
  const handleToolEvent = (event: any) => {
    console.log("Tool event received:", event);
    if (Array.isArray(event)) {
      setToolEvents(prev => [...prev, ...event]);
    } else {
      setToolEvents(prev => [...prev, event]);
    }
  };
  const [showHistory, setShowHistory] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [waitingForEditResponse, setWaitingForEditResponse] = useState<{messageIndex: number, originalContent: string} | null>(null);
  const [branchRefreshKey, setBranchRefreshKey] = useState(0);
  const lastStreamLoadingRef = useRef(false);
  const lastFallbackErrorKeyRef = useRef<string | null>(null);

  const buildReplyPreview = useCallback((content: any): string => {
    try {
      if (typeof content === "string") return content
      if (Array.isArray(content)) {
        const texts = content
          .filter((b: any) => b && typeof b === "object" && b.type === "text" && typeof b.text === "string")
          .map((b: any) => String(b.text || ""))
        if (texts.length) return texts.join(" ")
        return "[media]"
      }
      if (content == null) return ""
      return String(content)
    } catch {
      return ""
    }
  }, [])

  const normalizePreview = useCallback((text: string, maxLen = 160) => {
    const oneLine = String(text || "").replace(/\s+/g, " ").trim()
    if (!oneLine) return ""
    return oneLine.length > maxLen ? oneLine.slice(0, maxLen - 1) + "…" : oneLine
  }, [])

  const handleSwipeReply = useCallback(
    (message: ChatMessage) => {
      const isUser = message?.role === "user" || message?.type === "human"
      const name = isUser ? t("common.you") : (agentObj?.name || "B-Bot")
      const preview = normalizePreview(buildReplyPreview((message as any)?.content))
      if (!preview) return
      setReplyContext({ name, preview })
    },
    [agentObj?.name, buildReplyPreview, normalizePreview, t],
  )

  // Get streaming, color, and dark mode from query params
  let streaming = true;
  let userColor = '#2563eb'; // default blue
  let darkMode = false;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('streaming')) {
      streaming = params.get('streaming') !== 'false';
    }
    if (params.has('color')) {
      userColor = params.get('color') || userColor;
    }
    // Only enable dark mode if explicitly passed as 'true' or '1'
    if (params.has('dark')) {
      const darkValue = params.get('dark');
      darkMode = darkValue === 'true' || darkValue === '1';
    }
  }
  
  // Apply dark mode class to root element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const html = document.documentElement;
      if (darkMode) {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }
  }, [darkMode]);

  const { isAuthenticated, getAccessTokenSilently, user } = useAppAuth()

  const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY;

  // Get auth token for API calls
  const getApiKey = async () => {
    try {
      // For embed mode with admin API key
    if (embedUserId && ADMIN_API_KEY) {
        return ADMIN_API_KEY;
      }

      // For authenticated users
      if (isAuthenticated) {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: LANGGRAPH_AUDIENCE,
          },
        });
        return token;
      }

      // For locally authenticated users
      if (isLocallyAuthenticated()) {
        return getAuthToken();
      }

      // For B-Bot without authentication
      if (selectedAgent === "bbot") {
        return null;
      }

      return null;
    } catch (error) {
      console.error("Failed to get auth token:", error);
      return null;
    }
  };

  // Get the headers for embed requests - embed-proxy handles Admin API Key automatically
  const getHeaders = async () => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // For embed mode with specific user ID
    if (embedUserId) {
      return {
        ...baseHeaders,
        "X-User-ID": embedUserId,
      };
    }

    // For authenticated users
    if (isAuthenticated) {
      try {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: LANGGRAPH_AUDIENCE,
            },
        });
        return {
          ...baseHeaders,
          "Authorization": `Bearer ${token}`,
        };
      } catch (error) {
        console.error("Failed to get auth token:", error);
      }
    }

    // For locally authenticated users
        if (isLocallyAuthenticated()) {
      const token = getAuthToken();
          if (token) {
        return {
          ...baseHeaders,
          "Authorization": `Bearer ${token}`,
        };
      }
    }

    // For anonymous embed users - embed-proxy will add Admin API Key automatically
    return baseHeaders;
  };

  // Get the API URL for LangGraph - use the embed-proxy endpoint
  const getApiUrl = () => {
    // Use the embed-proxy endpoint which handles Admin API Key for embeds
    // Need to construct absolute URL for LangGraph client
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/embed-proxy`;
    }
    // Fallback for server-side rendering
    return '/api/embed-proxy';
  };

  // Force embed mode to stay on embed-proxy for thread endpoints and inject
  // X-Embed-Password for protected embeds. This prevents accidental direct
  // /api/v2/threads/* calls that fail for anonymous/public embeds.
  useEffect(() => {
    if (typeof window === "undefined") return
    const originalFetch = window.fetch
    window.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      try {
        const urlString =
          typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url

        // Rewrite protected MainAPI thread routes to embed-proxy equivalents.
        // Example: /api/v2/threads/{id}/state -> /api/embed-proxy/threads/{id}/state
        let rewritten = urlString
        rewritten = rewritten.replace(/\/api\/v2\/threads\//g, "/api/embed-proxy/threads/")

        const shouldInjectEmbedPassword = rewritten.includes("/api/embed-proxy/") && Boolean(embedPassword)
        if (rewritten !== urlString || shouldInjectEmbedPassword) {
          // Preserve method/body when the SDK passes a Request object.
          const requestBase =
            url instanceof Request
              ? new Request(rewritten, url)
              : rewritten

          const existingHeaders = new Headers(
            options?.headers ?? (url instanceof Request ? url.headers : undefined),
          )
          if (shouldInjectEmbedPassword) {
            existingHeaders.set("X-Embed-Password", embedPassword as string)
          }

          return originalFetch(requestBase, {
            ...(options || {}),
            headers: existingHeaders,
          })
        }
      } catch {
        // ignore
      }
      return originalFetch(url, options)
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [embedPassword])

  const getEmbedDistributionChannel = useCallback(() => {
    const raw = (agentObj && typeof agentObj === "object") ? (agentObj as any) : null
    const meta = raw?.metadata || {}
    const rawMeta = raw?.rawData?.metadata || {}
    const dc =
      meta?.distributionChannel ||
      meta?.distribution_channel ||
      rawMeta?.distributionChannel ||
      rawMeta?.distribution_channel ||
      null
    const cfg = dc?.config || dc?.configuration || null
    return {
      type: "Embed",
      ...(cfg && typeof cfg === "object" ? { config: cfg } : {}),
    }
  }, [agentObj])

  const embedChannelConfig = useMemo(() => {
    const raw = (agentObj && typeof agentObj === "object") ? (agentObj as any) : null
    const meta = raw?.metadata || {}
    const rawMeta = raw?.rawData?.metadata || {}
    const dc =
      meta?.distributionChannel ||
      meta?.distribution_channel ||
      rawMeta?.distributionChannel ||
      rawMeta?.distribution_channel ||
      null
    const cfg = dc?.config || dc?.configuration || null
    return cfg && typeof cfg === "object" ? cfg : {}
  }, [agentObj])

  const showEmbedToolCalls = embedChannelConfig?.showToolCalls === true

  // Function to set thread metadata
  const setThreadMetadata = async (threadId: string) => {
    try {
      console.log(`Setting metadata for thread ${threadId}`);
      
      const userId = embedUserId || user?.sub || "anonymous-user";
      const agentId = selectedAgent;
      const expertId = agentObj?.metadata?.expert_id;
      
      if (!expertId) {
        console.log("No expert_id found, skipping thread metadata update");
        console.log("Agent metadata:", agentObj?.metadata);
        return;
      }

      const metadata = {
        expert_id: expertId,
        user_id: userId,
        agent_id: agentId,
        entity_id: getEntityId(),
        knowledge_entity_id: getKnowledgeEntityId(),
        distributionChannel: getEmbedDistributionChannel()
      };

      const headers = await getHeaders();
      const apiUrl = getApiUrl();
      
      const response = await fetch(`${apiUrl}/threads/${threadId}`, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify({
          metadata: metadata
        })
      });

      if (response.ok) {
        console.log(`Successfully set thread metadata for ${threadId}:`, metadata);
        
        // Verify the metadata was actually set by fetching the thread
        try {
          const verifyResponse = await fetch(`${apiUrl}/threads/${threadId}`, {
            method: 'GET',
            headers: headers
          });
          if (verifyResponse.ok) {
            const threadData = await verifyResponse.json();
            console.log(`Verification - Thread metadata after PATCH:`, threadData.metadata);
          }
        } catch (verifyError) {
          console.error("Failed to verify thread metadata:", verifyError);
        }
      } else {
        const responseText = await response.text();
        console.error(`Failed to set thread metadata: ${response.status} - ${responseText}`);
      }
    } catch (error) {
      console.error("Error setting thread metadata:", error);
    }
  };

  // Helper function to check if a string is a valid UUID
  const isValidUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // In embed mode, `selectedAgent` is typically a public distribution-channel id.
  // When the channel payload includes a Synapse assistant UUID, prefer that for runs.
  const resolvedSynapseAssistantId = useMemo(() => {
    try {
      const raw = (agentObj && typeof agentObj === "object") ? agentObj : null
      const meta = raw?.metadata || {}
      const candidate =
        raw?.assistant_id ||
        raw?.assistantId ||
        raw?.synapse_assistant_id ||
        meta?.synapseAssistantId ||
        meta?.synapse_assistant_id ||
        meta?.assistant_id ||
        meta?.assistantId
      const resolved = String(candidate || "").trim()
      return resolved ? resolved : null
    } catch {
      return null
    }
  }, [agentObj])

  // Get the assistant ID - only use it if it's a valid UUID, otherwise use a default
  const getAssistantId = () => {
    const resolved = resolvedSynapseAssistantId || selectedAgent
    if (resolved && isValidUUID(String(resolved))) {
      return String(resolved)
    }
    // For non-UUID agent IDs like "bbot", return the agent name directly
    // The API accepts specific registered graphs: indexer, retrieval_graph, bbot, open_deep_research
    return String(resolved || "bbot"); // Use the actual agent name or default to bbot
  };

  // State for API key (can be undefined since proxy handles auth)
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);

  const _sanitizeUserId = useCallback((raw: string) => {
    return String(raw || "").replace(/[|\-]/g, "")
  }, [])

  // Get entity ID for state management
  const getEntityId = () => {
    const userId = embedUserId || user?.sub || "anonymous-user";
    const meta = (agentObj && typeof agentObj === "object") ? (agentObj as any).metadata : null
    const dcMeta = meta?.distributionChannel || meta?.distribution_channel || null
    const cfg = dcMeta?.config || dcMeta?.configuration || null
    const candidate = meta?.expert_id ?? meta?.expertId ?? cfg?.expert_id ?? cfg?.expertId
    const expertId = Number(candidate)
    const suffix = Number.isFinite(expertId) && expertId > 0 ? String(expertId) : String(selectedAgent || "bbot")
    return _sanitizeUserId(userId) + '_' + suffix;
  };

  const getKnowledgeEntityId = () => {
    try {
      const meta = (agentObj && typeof agentObj === "object") ? (agentObj as any).metadata : null
      const top = (agentObj && typeof agentObj === "object") ? (agentObj as any) : null
      const dcMeta = meta?.distributionChannel || meta?.distribution_channel || null
      const cfg = dcMeta?.config || dcMeta?.configuration || null
      const expertCandidate = meta?.expert_id ?? meta?.expertId ?? cfg?.expert_id ?? cfg?.expertId
      const expertId = Number(expertCandidate)
      if (!Number.isFinite(expertId) || expertId <= 0) return null

      const ownerCandidate =
        top?.owner ??
        top?.owner_id ??
        top?.ownerId ??
        top?.user_id ??
        top?.userId ??
        top?.user?.id ??
        top?.created_by ??
        top?.createdBy ??
        meta?.owner ??
        meta?.owner_id ??
        meta?.ownerId ??
        dcMeta?.owner ??
        dcMeta?.owner_id ??
        dcMeta?.ownerId ??
        cfg?.owner ??
        cfg?.owner_id ??
        cfg?.ownerId
      const ownerId = String(ownerCandidate || "").trim()
      if (!ownerId) return null

      return _sanitizeUserId(ownerId) + "_" + String(expertId)
    } catch {
      return null
    }
  }

  // Get stored thread ID or use current session thread ID
  const getThreadId = () => {
    return currentSession?.threadId || ChatHistoryManager.getCurrentThreadId(embedId);
  };

  const resetBrokenThread = useCallback(() => {
    try {
      ChatHistoryManager.clearCurrentThreadId(embedId)
    } catch {}
    setCurrentSession(null)
    setThreadMetadataSet(null)
    setStreamingMessages([])
  }, [embedId])

  const buildFriendlyStreamErrorMessage = useCallback((details?: string): Message => {
    const text = String(details || "").toLowerCase()
    const providerUnavailable =
      text.includes("503") ||
      text.includes("service unavailable") ||
      text.includes("timeout") ||
      text.includes("fetch failed") ||
      text.includes("socket")

    return {
      id: `stream-error-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "ai",
      content: providerUnavailable
        ? "Entschuldigung, ich konnte gerade keine Antwort erzeugen, weil der KI-Dienst kurzzeitig nicht erreichbar war. Bitte versuche es gleich noch einmal."
        : "Entschuldigung, beim Erzeugen der Antwort ist etwas schiefgelaufen. Bitte versuche es gleich noch einmal.",
    } as Message
  }, [])

  const appendFriendlyStreamErrorMessage = useCallback((details?: string) => {
    const key = `${ChatHistoryManager.getCurrentThreadId(embedId) || "no-thread"}:${String(details || "stream-error").slice(0, 120)}`
    if (lastFallbackErrorKeyRef.current === key) return
    lastFallbackErrorKeyRef.current = key

    const fallbackMessage = buildFriendlyStreamErrorMessage(details)
    setStreamingMessages(prev => {
      const list = Array.isArray(prev) ? prev : []
      return [...list, fallbackMessage]
    })

    try {
      const currentConversation = messageMetadataManager.getCurrentConversation()
      if (currentConversation.length > 0) {
        messageMetadataManager.setBaseConversation([
          ...currentConversation,
          {
            id: String(fallbackMessage.id),
            role: "assistant",
            type: "ai",
            content: String(fallbackMessage.content || ""),
          },
        ])
        setBranchRefreshKey(prev => prev + 1)
      }
    } catch {}
  }, [buildFriendlyStreamErrorMessage, embedId])

  // State to track if we've set thread metadata
  const [threadMetadataSet, setThreadMetadataSet] = useState<string | null>(null);

  // Initialize the useStream hook - proxy handles authentication
  const thread = useStream<{ messages: Message[]; entity_id?: string; user_id?: string; agent_id?: string }>({
    apiUrl: getApiUrl(),
    apiKey: undefined, // Proxy handles authentication
    assistantId: getAssistantId(), // Only set if valid UUID, otherwise use default
    threadId: getThreadId(),
    messagesKey: "messages",
    onError: (error: unknown) => {
      console.error("Stream error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // For anonymous users, don't show balance-related errors as they shouldn't be charged
      const userId = embedUserId || user?.sub || "anonymous-user";
      const isAnonymousUser = !embedUserId && !user?.sub;
      
      if (isAnonymousUser && errorMessage.toLowerCase().includes('insufficient')) {
        console.log("Ignoring balance error for anonymous user");
        return;
      }

      // Dead/stale stream threads can get stuck in a retry loop in embed mode.
      // Drop the current thread so the next message starts a fresh run.
      const lower = errorMessage.toLowerCase()
      if (
        lower.includes("fetch failed") ||
        lower.includes("socket") ||
        lower.includes("504") ||
        lower.includes("timeout")
      ) {
        console.warn("Resetting broken embed thread after stream transport failure")
        resetBrokenThread()
      }
      
      appendFriendlyStreamErrorMessage(errorMessage);
      setAgentError("");
    },
    onFinish: (state: { values?: { messages?: ChatStreamMessage[] } }) => {
      console.log("Stream finished");
      const finalMessages = state.values?.messages
      saveCurrentSession(Array.isArray(finalMessages) ? finalMessages : undefined);
    },
    onThreadId: async (threadId: string) => {
      console.log("Thread ID received:", threadId);
      ChatHistoryManager.setCurrentThreadId(threadId, embedId);
      setCanonicalThreadMessages(null)
      
      // Set thread metadata if we haven't already and we have the agent data
      if (threadId && threadId !== threadMetadataSet && agentObj?.metadata?.expert_id) {
        await setThreadMetadata(threadId);
        setThreadMetadataSet(threadId);
      }
    },
    // TODO: LangGraph SDK useStream doesn't support onToolEvent directly  
    // Tool events need to be extracted from the message stream based on metadata/namespace
    // onToolEvent: handleToolEvent,
  });

  // Workaround state for SDK bug - manually track streaming messages  
  const [streamingMessages, setStreamingMessages] = useState<Message[]>([]);
  const [canonicalThreadMessages, setCanonicalThreadMessages] = useState<Message[] | null>(null)
  const pendingPostStreamReconcileRef = useRef(false)
  const reconcileInFlightRef = useRef(false)

  const reconcileThreadState = useCallback(
    async (threadId: string | undefined | null): Promise<Message[] | null> => {
      const tid = String(threadId || "").trim()
      if (!tid) return null
      if (reconcileInFlightRef.current) return null
      reconcileInFlightRef.current = true
      try {
        const headers = await getHeaders()
        const apiUrl = getApiUrl()
        const response = await fetch(`${apiUrl}/threads/${tid}/state`, {
          method: "GET",
          headers,
          credentials: "include",
        })
        if (!response.ok) return null
        const state = await response.json()
        const messages = state?.values?.messages
        if (Array.isArray(messages)) {
          setCanonicalThreadMessages(messages)
          return messages as Message[]
        }
        return null
      } catch (e) {
        console.warn("[Embed] Failed to reconcile thread state:", e)
        return null
      } finally {
        reconcileInFlightRef.current = false
      }
    },
    [getApiUrl, getHeaders],
  )

  // Scroll to the latest message once after history loads (on first render with messages).
  useEffect(() => {
    if (initialScrollDoneRef.current) return
    if (thread.isLoading) return
    const rawMessages = canonicalThreadMessages ?? (streamingMessages.length > 0 ? streamingMessages : thread.messages) ?? []
    const messageCount = rawMessages.length || 0
    if (messageCount === 0) return

    initialScrollDoneRef.current = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" })
      })
    })
  }, [thread.isLoading, thread.messages?.length, streamingMessages.length, canonicalThreadMessages])

  // Extract tool events from message stream (since LangGraph SDK doesn't support onToolEvent directly)
  useEffect(() => {
    const sourceMessages = canonicalThreadMessages ?? thread.messages
    if (sourceMessages && sourceMessages.length > 0) {
      // Find tool messages and convert them to tool events
      const toolMessages = sourceMessages.filter(msg => msg.type === "tool");
      const newToolEvents = toolMessages.map(msg => ({
        id: msg.id,
        tool_name: (msg as any).name || "reason_about",
        content: msg.content,
        status: "success",
        type: "tool_response"
      }));
      
      if (newToolEvents.length !== toolEvents.length) {
        console.log("Extracted tool events from message stream:", newToolEvents);
        setToolEvents(newToolEvents);
      }
    }
  }, [canonicalThreadMessages, thread.messages, toolEvents.length]);
  
  // Debug logging for thread state changes
  useEffect(() => {
    console.log("Thread state changed:", {
      messagesLength: thread.messages?.length || 0,
      streamingMessagesLength: streamingMessages.length,
      isLoading: thread.isLoading,
      values: thread.values,
      firstMessage: thread.messages?.[0],
      lastMessage: thread.messages?.[thread.messages.length - 1]
    });
  }, [thread.messages, thread.isLoading, thread.values, streamingMessages]);

  // Additional detailed message logging  
  useEffect(() => {
    if (thread.messages && thread.messages.length > 0) {
      console.log("SDK Messages array updated:", thread.messages.map((msg, idx) => ({
        index: idx,
        type: msg.type,
        content: typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : msg.content
      })));
    }
  }, [thread.messages]);

  // Save current session to chat history (only once per thread)
  const saveCurrentSession = useCallback((messagesOverride?: ChatStreamMessage[]) => {
    const messages = (messagesOverride ||
      canonicalThreadMessages ||
      (streamingMessages.length > 0 ? streamingMessages : thread.messages) ||
      []) as ChatStreamMessage[];
    if (!messages || messages.length === 0) return;

    const userMessage = messages.find(msg => msg.type === 'human');
    const aiMessage = messages.find(msg => msg.type === 'ai');
    
    // Only save if we have both a user message and an AI response (complete exchange)
    if (!userMessage || !aiMessage) return;

    const userId = embedUserId || user?.sub;
    const threadId = ChatHistoryManager.getCurrentThreadId(embedId);
    
    if (!threadId) return;

    // Check if this thread already exists in chat history
    const existingSessions = ChatHistoryManager.getChatSessions(embedId);
    const existingSession = existingSessions.find(session => 
      session.threadId === threadId && 
      session.agentId === selectedAgent &&
      (userId ? session.userId === userId : !session.userId)
    );

    const session: ChatSession = {
      id: existingSession?.id || currentSession?.id || `${threadId}-${Date.now()}`,
      threadId: threadId,
      agentId: selectedAgent,
      title: existingSession?.title || currentSession?.title || ChatHistoryManager.generateChatTitle(
        typeof userMessage.content === 'string' ? userMessage.content : 'New Chat'
      ),
      lastMessage: aiMessage && typeof aiMessage.content === 'string' 
        ? aiMessage.content.substring(0, 100) + (aiMessage.content.length > 100 ? '...' : '')
        : 'No response yet',
      timestamp: Date.now(), // Always update timestamp to show latest activity
      userId: userId
    };

    ChatHistoryManager.saveChatSession(session, embedId);
    setCurrentSession(session);
  }, [canonicalThreadMessages, streamingMessages, thread.messages, currentSession, selectedAgent, embedUserId, user?.sub, embedId]);

  // Update streaming messages when SDK finally updates and handle branch management
  useEffect(() => {
    if (thread.messages && thread.messages.length > 0) {
      const newMessages = thread.messages;
      setStreamingMessages(newMessages);
      
      // Update base conversation in metadata manager for branch tracking
      const chatMessages = convertMessages(newMessages);
      messageMetadataManager.setBaseConversation(chatMessages);
      
      // Check if we received an AI response to an edited message
      if (waitingForEditResponse) {
        const expectedIndex = waitingForEditResponse.messageIndex;
        
        // Look for a new AI response - prioritize responses that are different from the original
        let newAIResponse = null;
        let actualResponseIndex = expectedIndex;
        
        // First, check if there's a new response at the end (most recent)
        for (let i = chatMessages.length - 1; i >= expectedIndex; i--) {
          if (chatMessages[i].role === "assistant" && 
              chatMessages[i].content !== waitingForEditResponse.originalContent) {
            newAIResponse = chatMessages[i];
            actualResponseIndex = i;
            console.log(`Found new AI response at index ${i}: "${newAIResponse.content.substring(0, 50)}..."`);
            break;
          }
        }
        
        // If we found a truly new response, create the branch with that content
        if (newAIResponse) {
          console.log(`New AI response detected at index ${actualResponseIndex}. Original: "${waitingForEditResponse.originalContent.substring(0, 50)}...", New: "${newAIResponse.content.substring(0, 50)}..."`);
          
          // Create a branch for the AI response using the new content
          messageMetadataManager.createBranchAtIndex(
            expectedIndex, 
            waitingForEditResponse.originalContent, 
            newAIResponse.content,
            false // Don't auto-link, we'll do it manually
          );
          
          // Explicitly link the user message and AI response branches
          if (expectedIndex > 0) {
            messageMetadataManager.linkBranchPoints(expectedIndex - 1, expectedIndex);
          }
          
          // Clear the waiting flag
          setWaitingForEditResponse(null);
        } else if (expectedIndex < chatMessages.length && chatMessages[expectedIndex].role === "assistant") {
          // Fallback: if no new response found, but there's a response at expected index
          const responseAtExpectedIndex = chatMessages[expectedIndex];
          console.log(`AI response content unchanged, but creating branch for consistency. Content: "${responseAtExpectedIndex.content.substring(0, 50)}..."`);
          
          // Only create branch if we haven't already created one for this edit
          if (!messageMetadataManager.hasMultipleBranches(responseAtExpectedIndex.id)) {
            // Create a branch for consistency
            messageMetadataManager.createBranchAtIndex(
              expectedIndex, 
              waitingForEditResponse.originalContent, 
              responseAtExpectedIndex.content,
              false // Don't auto-link, we'll do it manually
            );
            
            // Explicitly link the user message and AI response branches
            if (expectedIndex > 0) {
              messageMetadataManager.linkBranchPoints(expectedIndex - 1, expectedIndex);
            }
          }
          
          // Don't clear the waiting flag yet - keep waiting for a different response
          // Only clear if the stream has finished and we're sure this is the final response
          if (!thread.isLoading) {
            console.log("Stream finished, clearing waiting flag even though no new response was found");
            setWaitingForEditResponse(null);
          }
        }
      }
    }
  }, [thread.messages, waitingForEditResponse]);

  // Start a new chat
  const handleNewChat = () => {
    ChatHistoryManager.clearCurrentThreadId(embedId);
    setCurrentSession(null);
    setReplyContext(null)
    setStreamingMessages([]);
    messageMetadataManager.clear(); // Clear all branch data
    // The thread will automatically create a new thread ID on next message
    window.location.reload(); // Simple way to reset the chat state
  };

  // Select a chat from history
  const handleSelectChat = (session: ChatSession) => {
    setCurrentSession(session);
    ChatHistoryManager.setCurrentThreadId(session.threadId, embedId);
    setReplyContext(null)
    // Reload to load the selected thread
    window.location.reload();
  };

  // Prevent page-level scrolling by setting body/html overflow
  useEffect(() => {
    // Set body and html styles to prevent page scrolling
    const body = document.body;
    const html = document.documentElement;
    
    const originalBodyOverflow = body.style.overflow;
    const originalHtmlOverflow = html.style.overflow;
    
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    
    // Cleanup function to restore original styles
    return () => {
      body.style.overflow = originalBodyOverflow;
      html.style.overflow = originalHtmlOverflow;
    };
  }, []);



  // Load agent information
  useEffect(() => {
    const loadAgent = async () => {
      try {
        setAgentError("");
        // Use allowAnonymous option for embed mode to avoid authentication requirements
        let agentData: any = null
        // Small retry window to survive transient deploy/cache races without
        // falling back to insecure or fake assistant objects.
        for (let attempt = 0; attempt < 2; attempt++) {
          agentData = await getAgent(selectedAgent, { allowAnonymous: true })
          if (agentData) break
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
        }

        if (agentData) {
          setAgentObj(agentData);
          // Password-protected embeds: prompt once and store in sessionStorage
          try {
            const protectedFlag =
              agentData?.metadata?.distributionChannel?.config?.password_protected === true ||
              agentData?.rawData?.metadata?.distributionChannel?.config?.password_protected === true ||
              agentData?.rawData?.password_protected === true
            if (protectedFlag) {
              const existing = (typeof sessionStorage !== "undefined" ? sessionStorage.getItem(embedPasswordKey) : "") || ""
              const initial = existing.trim()
              if (initial) {
                setEmbedPassword(initial)
              } else {
                const pw = window.prompt("This embed is password-protected. Please enter the password:") || ""
                const next = pw.trim()
                if (!next) {
                  setAgentError("Password required for this embed.")
                  setAgentValid(false)
                  return
                }
                try {
                  sessionStorage.setItem(embedPasswordKey, next)
                } catch {}
                setEmbedPassword(next)
              }
            } else {
              setEmbedPassword("")
              try {
                sessionStorage.removeItem(embedPasswordKey)
              } catch {}
            }
          } catch {
            // ignore
          }

          setAgentValid(true);
        } else {
          setAgentError(`Agent '${selectedAgent}' not found`);
          setAgentValid(false);
        }
      } catch (error) {
        console.error("Error loading agent:", error);
        setAgentError(`Failed to load agent: ${error}`);
        setAgentValid(false);
      }
    };

    if (selectedAgent) {
      loadAgent();
    }
  }, [selectedAgent, getAgent]);

  // Set thread metadata when agent data becomes available
  useEffect(() => {
    const currentThreadId = ChatHistoryManager.getCurrentThreadId(embedId);
    if (agentObj?.metadata?.expert_id && currentThreadId && currentThreadId !== threadMetadataSet) {
      setThreadMetadata(currentThreadId);
      setThreadMetadataSet(currentThreadId);
    }
  }, [agentObj, embedId, threadMetadataSet]);

  // Handle sending a message
  const handleSendMessage = async (messageContent: string) => {
    setToolEvents([]); // Clear previous tool events
    if (!messageContent.trim()) return;
    setCanonicalThreadMessages(null)
    pendingPostStreamReconcileRef.current = true

    try {
      const userId = embedUserId || user?.sub || "anonymous-user";
      const agentId = selectedAgent;
      const entityId = getEntityId();
      const knowledgeEntityId = getKnowledgeEntityId()

      // Merge assistant apps with user apps (user apps take precedence)
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };
      const hasMergedApps = Object.keys(mergedApps).length > 0
      const config = agentObj?.rawData?.config || agentObj?.rawData?.metadata?.config || {}
      const userProfile = loadChatUserProfile(user?.sub || "anonymous")
      const baseSystemMessage =
        (typeof (config as any)?.system_message === "string" && (config as any).system_message.trim()
          ? (config as any).system_message.trim()
          : "") || "Be helpful and concise."
      const system_message = buildSystemMessageWithUserProfile(baseSystemMessage, userProfile)
      
      // Add manual blacklist to apps if in Embed mode (in addition to automatic blacklisting)
      // This allows for custom blacklist overrides per app
      // Example: mergedApps["knowledge_companyinfoludemedia"].blacklist = ["edit_line_knowledge_companyinfoludemedia"]
      // Note: Automatic blacklisting for Embed mode is already handled by the backend

      const replyQuote = replyContext?.preview ? `> ${replyContext.preview}\n\n` : ""
      const finalMessageContent = replyQuote ? `${replyQuote}${messageContent}` : messageContent

      // Create the new message
      const newMessage: Message = {
        type: "human",
        content: finalMessageContent,
      };

      // Get expert_id from assistant metadata if available
      const expertId = agentObj?.metadata?.expert_id;

      // Submit using LangGraph's useStream
      thread.submit(
        { 
          messages: [newMessage],
          entity_id: entityId,  // Required in main payload for LangGraph
          ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
          user_id: userId,      // Also add these for compatibility
          agent_id: agentId,
          ...(hasMergedApps ? { apps: mergedApps } : {}),
        },
        {
        config: {
            configurable: {
          agent_id: agentId,
          user_id: userId,
              entity_id: entityId,
              ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
          temperature: 0.7,
          max_tokens: 1024,
          top_p: 1.0,
          instructions: "Be helpful and concise.",
          system_message,
          ...(hasMergedApps ? { apps: mergedApps } : {}),
              distribution_channel: getEmbedDistributionChannel(), // Pass to backend for security filtering
            }
          },
          streamMode: ["messages", "updates"], // Use messages/updates for proper event streaming like B-Bot Hub
          metadata: {
            expert_id: expertId,
            user_id: userId,
            agent_id: agentId,
            assistant_id: agentId,
            entity_id: entityId,
            ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
            distributionChannel: getEmbedDistributionChannel()
          },
          optimisticValues: (prev) => ({
            ...prev,
            messages: [
              ...(prev.messages ?? []),
              newMessage,
            ],
            entity_id: entityId,
            user_id: userId,
            agent_id: agentId,
            expert_id: expertId,
            ...(hasMergedApps ? { apps: mergedApps } : {}),
          }),
        }
      );

      setInput("");
      if (replyContext) setReplyContext(null)
    } catch (error) {
      console.error("Error sending message:", error);
      setAgentError(`Failed to send message: ${error}`);
    }
  };

  // Handle form submission for ChatInput compatibility
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>, messageContent: string) => {
    e.preventDefault();
    handleSendMessage(messageContent);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setTimeout(() => {
      handleSendMessage(suggestion);
    }, 100);
  };

  // Convert messages from LangGraph format to ChatMessage format
  const convertMessages = (messages: Message[]): ChatMessage[] => {
    const isAnonymousUser = !embedUserId && !user?.sub;
    
    return messages
      .filter(msg => {
        if (!showEmbedToolCalls && msg.type === "tool") {
          return false;
        }

        // Filter out empty AI messages that only contain tool_calls (trigger messages)
        if (msg.type === "ai" && (!msg.content || (msg.content as string).trim() === "") && (msg as any).tool_calls && (msg as any).tool_calls.length > 0) {
          console.log("🚫 [convertMessages] Filtering out empty AI message with tool_calls:", msg.id);
          return false;
        }

        if (!showEmbedToolCalls && msg.type === "ai" && (msg as any).tool_calls && (msg as any).tool_calls.length > 0) {
          console.log("🚫 [convertMessages] Hiding AI message with tool_calls in embed:", msg.id);
          return false;
        }

        return true;
      })
      .map(msg => {
        let content = msg.content as string;
        
        // FIXME: Client-side workaround for server-side balance checking issue
        if (isAnonymousUser && 
            msg.type === "ai" && 
            content.toLowerCase().includes('insufficient') && 
            content.toLowerCase().includes('balance')) {
          content = "I'm here to help! Feel free to ask me any questions and I'll do my best to assist you.";
        }
        
        return {
          id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: msg.type as "human" | "ai" | "tool", // Support tool messages!
          role: msg.type === "human" ? "user" : msg.type === "tool" ? "tool_response" : "assistant",
          content: content,
          // Pass through tool call properties for proper inline display
          tool_calls: (msg as any).tool_calls,
          tool_call_id: (msg as any).tool_call_id,
          name: (msg as any).name
        };
      });
  };

  // Some stream failures end cleanly from the transport perspective but never produce an AI answer.
  // In that case, add a visible assistant apology instead of leaving the user with no response.
  useEffect(() => {
    const wasLoading = lastStreamLoadingRef.current
    lastStreamLoadingRef.current = !!thread.isLoading
    if (!wasLoading || thread.isLoading) return

    if (pendingPostStreamReconcileRef.current) {
      pendingPostStreamReconcileRef.current = false
      const tid = getThreadId()
      void reconcileThreadState(tid).then((reconciled) => {
        const rawMessages = (reconciled || (canonicalThreadMessages ?? (streamingMessages.length > 0 ? streamingMessages : thread.messages)) || []) as Message[]
        const converted = convertMessages(rawMessages)
        if (!converted.length) return

        let lastHumanIndex = -1
        for (let i = converted.length - 1; i >= 0; i -= 1) {
          if (converted[i]?.role === "user" || converted[i]?.type === "human") {
            lastHumanIndex = i
            break
          }
        }
        if (lastHumanIndex === -1) return

        const hasAssistantAfter = converted.slice(lastHumanIndex + 1).some((msg) => {
          const content = String(msg?.content || "").trim()
          return (msg?.role === "assistant" || msg?.type === "ai") && content.length > 0
        })
        if (hasAssistantAfter) return

        appendFriendlyStreamErrorMessage("stream ended without an assistant answer")
      })
      return
    }

    const rawMessages = (canonicalThreadMessages ?? (streamingMessages.length > 0 ? streamingMessages : thread.messages) ?? []) as Message[]
    const converted = convertMessages(rawMessages)
    if (!converted.length) return

    let lastHumanIndex = -1
    for (let i = converted.length - 1; i >= 0; i -= 1) {
      if (converted[i]?.role === "user" || converted[i]?.type === "human") {
        lastHumanIndex = i
        break
      }
    }
    if (lastHumanIndex === -1) return

    const hasAssistantAfter = converted.slice(lastHumanIndex + 1).some((msg) => {
      const content = String(msg?.content || "").trim()
      return (msg?.role === "assistant" || msg?.type === "ai") && content.length > 0
    })
    if (hasAssistantAfter) return

    appendFriendlyStreamErrorMessage("stream ended without an assistant answer")
  }, [thread.isLoading, thread.messages, streamingMessages, canonicalThreadMessages, appendFriendlyStreamErrorMessage, reconcileThreadState, getThreadId])

  // Handle message editing
  const handleMessageEdit = async (messageId: string, newContent: string, parentCheckpoint?: string) => {
    try {
      console.log(`Editing message ${messageId} with content: ${newContent}`);
      
      // Get current conversation state
      const currentMessages = streamingMessages.length > 0 ? streamingMessages : thread.messages;
      const currentChatMessages = convertMessages(currentMessages);
      
      // Set the base conversation to the state before editing to capture the original structure
      messageMetadataManager.setBaseConversation(currentChatMessages);
      
      // Find the message to edit
      const messageIndex = currentChatMessages.findIndex(msg => msg.id === messageId);
      
      if (messageIndex === -1) {
        console.error("Message not found for editing");
        return;
      }

      const originalMessage = currentChatMessages[messageIndex];
      
      // Create branch for this edit (don't auto-link for user messages)
      messageMetadataManager.createBranchAtIndex(messageIndex, originalMessage.content, newContent, false);
      
      // Set flag to track that we're waiting for an AI response to this edit
      if (originalMessage.role === "user") {
        const nextAIIndex = messageIndex + 1;
        const originalAIResponse = nextAIIndex < currentChatMessages.length ? currentChatMessages[nextAIIndex] : null;
        setWaitingForEditResponse({
          messageIndex: nextAIIndex,
          originalContent: originalAIResponse?.content || ""
        });
      }
      
      // For user message edits, we need to truncate at the edit point and regenerate everything after
      const messagesUpToEdit = currentChatMessages.slice(0, messageIndex);
      
      // Add the edited message
      const editedMessage = {
        ...originalMessage,
        content: newContent
      };
      
      const conversationForSubmission = [...messagesUpToEdit, editedMessage];
      
      // Convert back to LangGraph Message format and update
      const langGraphMessages = conversationForSubmission.map(msg => ({
        id: msg.id,
        type: msg.type as "human" | "ai",
        content: msg.content
      }));
      
      setStreamingMessages(langGraphMessages);
      
      // Clear any tool events from after the edit point
      setToolEvents([]); // Clear previous tool events

      // Get the entity info for the request
      const userId = embedUserId || user?.sub || "anonymous-user";
      const agentId = selectedAgent;
      const entityId = getEntityId();
      const knowledgeEntityId = getKnowledgeEntityId()

      // Get expert_id from assistant metadata if available
      const expertId = agentObj?.metadata?.expert_id;

      // Merge assistant apps with user apps
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };
      const hasMergedApps = Object.keys(mergedApps).length > 0
      const config = agentObj?.rawData?.config || agentObj?.rawData?.metadata?.config || {}
      const userProfile = loadChatUserProfile(user?.sub || "anonymous")
      const baseSystemMessage =
        (typeof (config as any)?.system_message === "string" && (config as any).system_message.trim()
          ? (config as any).system_message.trim()
          : "") || "Be helpful and concise."
      const system_message = buildSystemMessageWithUserProfile(baseSystemMessage, userProfile)

      // Submit the conversation from edit point to regenerate AI response
      setCanonicalThreadMessages(null)
      pendingPostStreamReconcileRef.current = true
      thread.submit(
        { 
          messages: langGraphMessages,
          entity_id: entityId,  // Required in main payload for LangGraph
          ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
          user_id: userId,      // Also add these for compatibility
          agent_id: agentId,
          ...(hasMergedApps ? { apps: mergedApps } : {}),
        },
        {
          config: {
            configurable: {
              agent_id: agentId,
              user_id: userId,
              entity_id: entityId,
              ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
              temperature: 0.7,
              max_tokens: 1024,
              top_p: 1.0,
              instructions: "Be helpful and concise.",
              system_message,
              ...(hasMergedApps ? { apps: mergedApps } : {}),
              distribution_channel: getEmbedDistributionChannel(), // Pass to backend for security filtering
            }
          },
          metadata: {
            expert_id: expertId,
            user_id: userId,
            agent_id: agentId,
            assistant_id: agentId,
            entity_id: entityId,
            ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
            distributionChannel: getEmbedDistributionChannel()
          },
          optimisticValues: (prev) => ({
            ...prev,
            messages: langGraphMessages,
            entity_id: entityId,
            ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
            user_id: userId,
            agent_id: agentId,
            expert_id: expertId,
            ...(hasMergedApps ? { apps: mergedApps } : {}),
          }),
        }
      );

    } catch (error) {
      console.error("Error editing message:", error);
    }
  };

  // Handle message regeneration
  const handleMessageRegenerate = async (messageId: string, parentCheckpoint?: string) => {
    try {
      console.log(`Regenerating message ${messageId}`);
      
      // Get current conversation state
      const currentMessages = streamingMessages.length > 0 ? streamingMessages : thread.messages;
      const currentChatMessages = convertMessages(currentMessages);
      
      // Update base conversation in metadata manager
      messageMetadataManager.setBaseConversation(currentChatMessages);
      
      // Find the AI message to regenerate
      const messageIndex = currentChatMessages.findIndex(msg => msg.id === messageId);
      
      if (messageIndex === -1) {
        console.error("Message not found for regeneration");
        return;
      }

      const originalMessage = currentChatMessages[messageIndex];
      
      // Create branch for this regeneration with placeholder content
      messageMetadataManager.createBranchAtIndex(messageIndex, originalMessage.content, "Regenerating...", true);
      
      // Get conversation up to the message being regenerated
      const conversationUpToRegen = currentChatMessages.slice(0, messageIndex);
      
      // Convert back to LangGraph Message format
      const langGraphMessages = conversationUpToRegen.map(msg => ({
        id: msg.id,
        type: msg.type as "human" | "ai",
        content: msg.content
      }));
      
      setStreamingMessages(langGraphMessages);
      
      // Clear any tool events from after the regeneration point
      setToolEvents([]); // Clear previous tool events

      // Get the entity info for the request
      const userId = embedUserId || user?.sub || "anonymous-user";
      const agentId = selectedAgent;
      const entityId = getEntityId();
      const knowledgeEntityId = getKnowledgeEntityId()

      // Get expert_id from assistant metadata if available
      const expertId = agentObj?.metadata?.expert_id;

      // Merge assistant apps with user apps
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };
      const hasMergedApps = Object.keys(mergedApps).length > 0
      const config = agentObj?.rawData?.config || agentObj?.rawData?.metadata?.config || {}
      const userProfile = loadChatUserProfile(user?.sub || "anonymous")
      const baseSystemMessage =
        (typeof (config as any)?.system_message === "string" && (config as any).system_message.trim()
          ? (config as any).system_message.trim()
          : "") || "Be helpful and concise."
      const system_message = buildSystemMessageWithUserProfile(baseSystemMessage, userProfile)

      // Submit the conversation up to the regeneration point
      setCanonicalThreadMessages(null)
      pendingPostStreamReconcileRef.current = true
      thread.submit(
        { 
          messages: langGraphMessages,
          entity_id: entityId,  // Required in main payload for LangGraph
          ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
          user_id: userId,      // Also add these for compatibility
          agent_id: agentId,
          ...(hasMergedApps ? { apps: mergedApps } : {}),
        },
        {
          config: {
            configurable: {
              agent_id: agentId,
              user_id: userId,
              entity_id: entityId,
              ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
              temperature: 0.7,
              max_tokens: 1024,
              top_p: 1.0,
              instructions: "Be helpful and concise.",
              system_message,
              ...(hasMergedApps ? { apps: mergedApps } : {}),
              distribution_channel: getEmbedDistributionChannel(), // Pass to backend for security filtering
            }
          },
          metadata: {
            expert_id: expertId,
            user_id: userId,
            agent_id: agentId,
            assistant_id: agentId,
            entity_id: entityId,
            ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
            distributionChannel: getEmbedDistributionChannel()
          },
          optimisticValues: (prev) => ({
            ...prev,
            messages: langGraphMessages,
            entity_id: entityId,
            ...(knowledgeEntityId ? { knowledge_entity_id: knowledgeEntityId } : {}),
            user_id: userId,
            agent_id: agentId,
            expert_id: expertId,
            ...(hasMergedApps ? { apps: mergedApps } : {}),
          }),
        }
      );

    } catch (error) {
      console.error("Error regenerating message:", error);
    }
  };

  // Handle branch selection
  const handleBranchSelect = (messageId: string, direction: 'prev' | 'next') => {
    console.log(`Switching branch ${direction} for message ${messageId}`);
    messageMetadataManager.debugState();
    
    const success = messageMetadataManager.handleBranchSelect(messageId, direction);
    
    if (success) {
      console.log(`Successfully switched to branch ${direction} for message ${messageId}`);
      messageMetadataManager.debugState();
      
      // Force re-render to show the updated branch content
      setBranchRefreshKey(prev => prev + 1);
    } else {
      console.log(`Failed to switch branch ${direction} for message ${messageId}`);
    }
  };

  // Get metadata for a message
  const getMessageMetadata = (message: ChatMessage): MessageMetadata | undefined => {
    return messageMetadataManager.getMessageMetadata(message);
  };

  const filterVisibleEmbedMessages = useCallback((messages: ChatMessage[]): ChatMessage[] => {
    if (showEmbedToolCalls) return messages;
    return messages.filter((msg) => {
      if (msg.role === "tool_response" || msg.role === "tool_call" || msg.type === "tool") {
        return false;
      }
      if ((msg as any).tool_calls && Array.isArray((msg as any).tool_calls) && (msg as any).tool_calls.length > 0) {
        return false;
      }
      return true;
    });
  }, [showEmbedToolCalls]);

  return (
    <div className="fixed inset-0 flex flex-col bg-background embedded-chat overflow-hidden">
      <EmbedChatHeader
        agentName={agentObj?.name}
        onNewChat={handleNewChat}
        onShowHistory={() => setShowHistory(true)}
        userColor={userColor}
        headerIcon={agentObj?.metadata?.headerIcon || 'bot'}
      />
      
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <EnhancedChatMessages
            messages={useMemo(() => {
              // Always use the branch manager as the source of truth when it has data
              const currentConversation = messageMetadataManager.getCurrentConversation();
              
              // If branch manager has content, use it
              if (currentConversation.length > 0) {
                console.log("📋 Using branch manager conversation:", currentConversation.length, "messages");
                return filterVisibleEmbedMessages(currentConversation);
              }
              
              // Fallback to canonical/streaming/thread messages
              const rawMessages = (canonicalThreadMessages ?? (streamingMessages.length > 0 ? streamingMessages : thread.messages) ?? []) as Message[];
              const convertedMessages = convertMessages(rawMessages);
              
              console.log("📋 Converting messages for display:");
              console.log("- Raw messages:", rawMessages?.length || 0);
              console.log("- Converted messages:", convertedMessages.length);
              rawMessages?.forEach((msg, idx) => {
                const contentStr = typeof msg.content === 'string' ? msg.content : 
                  Array.isArray(msg.content) ? JSON.stringify(msg.content) : String(msg.content || '');
                const toolCallsCount = (msg as any).tool_calls?.length || 0;
                console.log(`  ${idx}: ${msg.type} - "${contentStr.substring(0, 50)}..." - tool_calls: ${toolCallsCount}`);
              });
              
              return filterVisibleEmbedMessages(convertedMessages);
            }, [canonicalThreadMessages, streamingMessages, thread.messages, branchRefreshKey, filterVisibleEmbedMessages])}
              messagesEndRef={messagesEndRef}
              selectedAgent={selectedAgent}
              agents={agentObj ? [agentObj] : []}
            userColor={userColor}
            isLoading={thread.isLoading}
            onSwipeReply={handleSwipeReply}
            onSuggestionClick={handleSuggestionClick}
            onMessageEdit={handleMessageEdit}
            onMessageRegenerate={handleMessageRegenerate}
            onBranchSelect={handleBranchSelect}
            getMessageMetadata={getMessageMetadata}
            toolEvents={showEmbedToolCalls ? toolEvents : []}
              suggestions={
                agentObj && agentObj.templates && agentObj.templates.length > 0
                  ? agentObj.templates.map((t: any) =>
                      t.template_text || (t.attributes && t.attributes.template_text) || t.text || t
                    )
                  : undefined
              }
          />
        </div>
        
        <div className="embed-input-wrapper flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
          <ChatInput
            onSubmit={handleFormSubmit}
            isLoading={thread.isLoading}
            selectedAgent={selectedAgent}
            agentName={agentObj?.name}
            userColor={userColor}
            draft={input}
            onDraftChange={setInput}
            replyContext={replyContext}
            onClearReplyContext={() => setReplyContext(null)}
          />
        </div>
      </div>
      
      {agentError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 m-4 rounded">
          {agentError}
        </div>
      )}

      <ChatHistorySidebar
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectChat={handleSelectChat}
        currentThreadId={getThreadId() || undefined}
        agentId={selectedAgent}
        userId={embedUserId || user?.sub}
        embedId={embedId}
      />
    </div>
  );
}
