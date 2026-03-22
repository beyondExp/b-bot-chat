"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import type { Message } from "@/types/chat"
import { useStream } from "@langchain/langgraph-sdk/react"
import { Client } from "@langchain/langgraph-sdk"
import { calculateTokenCost } from "@/lib/stripe"
import { ChatHistoryManager, type ChatSession } from "@/lib/chat-history"
import { ChatInput } from "./chat-input"
import { ChatHeader } from "./chat-header"
import { EnhancedChatMessages } from "./enhanced-chat-messages"
import { MessageSearch } from "./message-search"
import { WorkdeskDrawer, type QueuedWorkdeskFile } from "./workdesk-drawer"
// Temporarily remove tool response handling to avoid type conflicts
// import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses"
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses"
import { MainChatSidebar } from "./main-chat-sidebar"
import { PaymentRequiredModal } from "./payment-required-modal"
import { AutoRechargeNotification } from "./auto-recharge-notification"
import { DiscoverPage } from "./discover-page"
import { ContactsPage } from "./contacts-page"
import { VoiceCallView } from "./voice-call-view"
import { AgentSelector } from "./agent-selector"
import { useAgents } from "@/lib/agent-service"
import { useAuthenticatedFetch, isLocallyAuthenticated, getAuthToken } from "@/lib/api"
import { ThreadService, type Thread } from "@/lib/thread-service"
import { convertToWav } from "@/lib/audio-converter"
import { useAppAuth } from "@/lib/app-auth"
import { createContactsStore } from "@/lib/contacts-store"
import { fetchBranding, type Branding } from "@/lib/branding"
import { useI18n } from "@/lib/i18n"
import { buildSystemMessageWithUserProfile, loadChatUserProfile } from "@/lib/chat-user-profile"

// Import the LANGGRAPH_AUDIENCE constant
import { LANGGRAPH_AUDIENCE } from "@/lib/api"

interface ChatInterfaceProps {
  initialAgent?: string | null
}

export function ChatInterface({ initialAgent }: ChatInterfaceProps) {
  const { user, isAuthenticated, getAccessTokenSilently, provider } = useAppAuth()
  const { t, locale } = useI18n()
  const [agents, setAgents] = useState<any[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [branding, setBranding] = useState<Branding | null>(null)
  const contactsStore = useMemo(() => createContactsStore(user?.sub), [user?.sub])
  const [contactAgentIds, setContactAgentIds] = useState<string[]>([])
  const [recentAgents, setRecentAgents] = useState<string[]>([])

  // Prevent page-level scrolling; the chat should scroll inside the messages pane only.
  // This avoids the "second scrollbar" + growing blank space below the sticky input.
  useEffect(() => {
    const body = document.body
    const html = document.documentElement

    const originalBodyOverflow = body.style.overflow
    const originalHtmlOverflow = html.style.overflow
    const originalBodyHeight = body.style.height
    const originalHtmlHeight = html.style.height

    body.style.overflow = "hidden"
    html.style.overflow = "hidden"
    body.style.height = "100%"
    html.style.height = "100%"

    return () => {
      body.style.overflow = originalBodyOverflow
      html.style.overflow = originalHtmlOverflow
      body.style.height = originalBodyHeight
      html.style.height = originalHtmlHeight
    }
  }, [])
  // Initialize selectedAgent from initialAgent, currentSession, or saved thread data
  const getInitialAgent = (): string | null => {
    // First priority: initialAgent prop
    if (initialAgent) return initialAgent
    
    // Second priority: check if we have a current session with agent info
    const savedThreadId = ChatHistoryManager.getCurrentThreadId(MAIN_CHAT_ID)
    if (savedThreadId) {
      const allSessions = ChatHistoryManager.getChatSessions(MAIN_CHAT_ID)
      const session = allSessions.find(s => s.threadId === savedThreadId)
      if (session?.agentId) {
        console.log('[Chat] Restoring agent from saved session:', session.agentId)
        return session.agentId
      }
    }
    
    return null
  }
  
  const [selectedAgent, setSelectedAgent] = useState<string | null>(getInitialAgent())
  const [showContactsPage, setShowContactsPage] = useState(false)
  const [showVoiceCall, setShowVoiceCall] = useState(false)
  const [showMessageSearch, setShowMessageSearch] = useState(false)
  const [workdeskOpen, setWorkdeskOpen] = useState(false)
  const [workdeskAutoPick, setWorkdeskAutoPick] = useState(false)
  const [queuedWorkdeskFiles, setQueuedWorkdeskFiles] = useState<QueuedWorkdeskFile[]>([])
  const queuedWorkdeskFilesRef = useRef<Record<string, string>>({})
  const localWorkspaceFilesRef = useRef<Record<string, string>>({})
  const [localWorkspaceFilesVersion, setLocalWorkspaceFilesVersion] = useState(0)
  const processedWorkspaceFileMessageIdsRef = useRef<Set<string>>(new Set())

  const normalizeWorkspacePath = useCallback((p: string) => {
    return (p || "").toString().replace(/^\/+/, "").trim()
  }, [])

  const mergeLocalWorkspaceFiles = useCallback(
    (incoming: Record<string, string>) => {
      const next = incoming && typeof incoming === "object" ? incoming : {}
      let changed = false
      for (const [rawPath, rawContent] of Object.entries(next)) {
        const path = normalizeWorkspacePath(rawPath)
        if (!path) continue
        const content = typeof rawContent === "string" ? rawContent : String(rawContent ?? "")
        if (localWorkspaceFilesRef.current[path] !== content) {
          localWorkspaceFilesRef.current[path] = content
          changed = true
        }
      }
      if (changed) setLocalWorkspaceFilesVersion((v) => v + 1)
    },
    [normalizeWorkspacePath],
  )

  const localWorkspaceEntries = useMemo(() => {
    const out: Array<{ name: string; path: string; size?: number | null; source?: string }> = []
    const files = localWorkspaceFilesRef.current || {}
    for (const [path, content] of Object.entries(files)) {
      const p = normalizeWorkspacePath(path)
      if (!p) continue
      out.push({
        name: p.split("/").filter(Boolean).pop() || p,
        path: p,
        size: typeof content === "string" ? content.length : null,
        source: "workspace",
      })
    }
    out.sort((a, b) => (a.path || "").localeCompare(b.path || ""))
    return out
  }, [localWorkspaceFilesVersion, normalizeWorkspacePath])

  const queueWorkspaceFile = useCallback((name: string, content: string, size: number) => {
    const key = String(name || "").trim()
    if (!key) return
    queuedWorkdeskFilesRef.current[key] = content
    mergeLocalWorkspaceFiles({ [key]: content })
    setQueuedWorkdeskFiles((prev) => {
      const next = prev.filter((x) => x.name !== key)
      next.push({ name: key, size })
      return next
    })
  }, [mergeLocalWorkspaceFiles])

  const removeQueuedWorkspaceFile = useCallback((name: string) => {
    const key = String(name || "").trim()
    if (!key) return
    try {
      delete queuedWorkdeskFilesRef.current[key]
    } catch {}
    try {
      const p = normalizeWorkspacePath(key)
      if (p && localWorkspaceFilesRef.current[p] !== undefined) {
        delete localWorkspaceFilesRef.current[p]
        setLocalWorkspaceFilesVersion((v) => v + 1)
      }
    } catch {}
    setQueuedWorkdeskFiles((prev) => prev.filter((x) => x.name !== key))
  }, [normalizeWorkspacePath])

  const takeQueuedWorkspaceFiles = useCallback((): Record<string, string> => {
    const out = queuedWorkdeskFilesRef.current
    queuedWorkdeskFilesRef.current = {}
    setQueuedWorkdeskFiles([])
    return out
  }, [])
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [remainingCredits, setRemainingCredits] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAutoRechargeNotification, setShowAutoRechargeNotification] = useState(false)
  const [autoRechargeAmount, setAutoRechargeAmount] = useState(0)
  const [toolEvents, setToolEvents] = useState<any[]>([])
  const [followUpSuggestions, setFollowUpSuggestions] = useState<any[]>([])
  const [followUpSuggestionsLoading, setFollowUpSuggestionsLoading] = useState(false)
  const pendingFollowUpsRef = useRef<any[] | null>(null)
  const [audioMap, setAudioMap] = useState<Record<string, string[]>>({}) // Store TTS audio chunks mapped to message IDs
  const [isLoadingOldConversation, setIsLoadingOldConversation] = useState(false) // Track if loading old conversation
  const [playedDuringCall, setPlayedDuringCall] = useState<Set<string>>(new Set()) // Track message IDs played during call
  const messagesRef = useRef<any[]>([]); // Ref to track messages for event handlers

  // Add tool event handling like B-Bot Hub
  const handleToolEvent = (event: any) => {
    console.log("Tool event received:", event);
    if (Array.isArray(event)) {
      setToolEvents(prev => [...prev, ...event]);
    } else {
      setToolEvents(prev => [...prev, event]);
    }
  };
  const [transcription, setTranscription] = useState("")
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [draftInput, setDraftInput] = useState("")
  
  // Main chat identifier to separate from embed storage
  const MAIN_CHAT_ID = "main-chat"
  
  // Initialize currentSession from saved thread data
  const getInitialSession = (): ChatSession | null => {
    const savedThreadId = ChatHistoryManager.getCurrentThreadId(MAIN_CHAT_ID)
    if (savedThreadId) {
      const allSessions = ChatHistoryManager.getChatSessions(MAIN_CHAT_ID)
      const session = allSessions.find(s => s.threadId === savedThreadId)
      if (session) {
        console.log('[Chat] Restoring session from saved data:', session)
        return session
      }
    }
    return null
  }
  
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(getInitialSession())

  // Initialize thread service with auth token getter
  const getAuthTokenForService = async (): Promise<string | null> => {
    try {
      if (isAuthenticated) {
        return await getAccessTokenSilently({
          authorizationParams: {
            audience: LANGGRAPH_AUDIENCE,
          },
        })
      }
      if (isLocallyAuthenticated()) {
        return getAuthToken()
      }
      return null
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
  }

  // Token for MainAPI calls (contacts persistence via proxy).
  const getAuthTokenForMainApi = async (): Promise<string | null> => {
    try {
      if (isAuthenticated) {
        // Zitadel: the OIDC client already mints the right access_token (no Auth0 audience param).
        if (provider === "zitadel") {
          return await getAccessTokenSilently()
        }
        // Auth0: request token for configured API audience (fallback to Synapse audience).
        const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE || LANGGRAPH_AUDIENCE
        return await getAccessTokenSilently({ authorizationParams: { audience } })
      }
      if (isLocallyAuthenticated()) {
        return getAuthToken()
      }
      return null
    } catch (error) {
      console.error("Failed to get MainAPI auth token:", error)
      return null
    }
  }

  // Tool events now handled directly through message stream as type: "tool"

  const threadService = new ThreadService(getAuthTokenForService)

  // Load agents
  const { getAgents } = useAgents()
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setAgentsLoading(true)
        const agentsData = await getAgents()
        setAgents(agentsData)
        setAgentsError(null)
      } catch (error) {
        console.error("Error loading agents:", error);
      } finally {
        setAgentsLoading(false)
      }
    };
    loadAgents();
  }, [getAgents]);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const b = await fetchBranding()
      if (mounted) setBranding(b)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setContactAgentIds(contactsStore.getIds())
  }, [contactsStore])

  // Sync contacts from Datacenter (via MainAPI proxy) when authenticated.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      // Anonymous users: keep local-only contacts
      if (!user?.sub) return
      try {
        const token = await getAuthTokenForMainApi()
        if (!token) return
        const res = await fetch("/api/contacts", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        const ids = Array.isArray(data?.ids) ? data.ids.map(String).map((s: string) => s.trim()).filter(Boolean) : []
        if (!mounted) return
        setContactAgentIds(ids)
        contactsStore.setIds(ids) // keep local cache in sync
      } catch (e) {
        console.warn("[Chat] Failed to sync contacts from server; using local cache", e)
      }
    })()
    return () => {
      mounted = false
    }
  }, [user?.sub, contactsStore])

  const handleToggleContact = useCallback(
    (agentId: string) => {
      const { ids } = contactsStore.toggle(agentId)
      setContactAgentIds(ids)
      if (user?.sub) {
        void (async () => {
          const token = await getAuthTokenForMainApi()
          if (!token) return
          await fetch("/api/contacts", {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids }),
          })
        })().catch(() => {})
      }
    },
    [contactsStore, user?.sub],
  )

  const handleRemoveContact = useCallback(
    (agentId: string) => {
      const ids = contactsStore.remove(agentId)
      setContactAgentIds(ids)
      if (user?.sub) {
        void (async () => {
          const token = await getAuthTokenForMainApi()
          if (!token) return
          await fetch("/api/contacts", {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids }),
          })
        })().catch(() => {})
      }
    },
    [contactsStore, user?.sub],
  )

  const contactsAgents = useMemo(() => {
    const byId = new Map<string, any>((agents || []).map((a: any) => [String(a.id), a]))
    const out: any[] = []
    for (const id of contactAgentIds || []) {
      const a = byId.get(String(id))
      if (a) out.push(a)
      else if (id === "bbot" || id === "b-bot") {
        out.push({ id, name: "B-Bot", profileImage: branding?.mainAgentLogoUrl })
      }
    }
    return out
  }, [agents, contactAgentIds, branding?.mainAgentLogoUrl])

  const computedWelcomeTitle = useMemo(() => {
    const appName = (branding?.appName || "Swiss Chat").toString()
    const raw = (branding?.welcomeTitle || "").trim()
    const defaultEn = `Welcome to ${appName}`
    if (raw && !(locale !== "en" && raw === defaultEn)) return raw
    return t("branding.welcomeTitle").replace("{appName}", appName)
  }, [branding?.welcomeTitle, branding?.appName, t, locale])

  const computedWelcomeSubtitle = useMemo(() => {
    const raw = (branding?.welcomeSubtitle || "").trim()
    const defaultEns = new Set([
      "Start a conversation by sending a message or try one of these suggestions:",
      "Start a conversation by sending a message or tap one of these suggestions:",
    ])
    if (raw && !(locale !== "en" && defaultEns.has(raw))) return raw
    return t("branding.welcomeSubtitle")
  }, [branding?.welcomeSubtitle, t, locale])

  // Get auth token for API calls
  const getApiKey = async () => {
    try {
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

  // Get the headers for authenticated requests only
  const getHeaders = async () => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

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

    // REMOVED: Admin API Key fallback - this should ONLY be used in embed interface
    // The main chat interface should require proper user authentication
    
    return baseHeaders;
  };

  // Get the API URL for LangGraph - use embed proxy for anonymous users, main proxy for authenticated
  const getApiUrl = () => {
    // For unauthenticated users, use embed proxy (which uses admin API key)
    // For authenticated users, use main proxy (which forwards user tokens)
    const proxyEndpoint = !isAuthenticated ? "/api/embed-proxy" : "/api/proxy"
    
    // Need to construct absolute URL for LangGraph client
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${proxyEndpoint}`;
    }
    // Fallback for server-side rendering
    return proxyEndpoint;
  };

  // Helper function to check if a string is a valid UUID
  const isValidUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Get the assistant ID - only use it if it's a valid UUID, otherwise use a default
  const getAssistantId = () => {
    if (selectedAgent && isValidUUID(selectedAgent)) {
      return selectedAgent;
    }
    // For non-UUID agent IDs like "bbot", return the agent name directly
    // The API accepts specific registered graphs: indexer, retrieval_graph, bbot, open_deep_research
    return selectedAgent || "bbot"; // Use the actual agent name or default to bbot
  };

  // State for API key - get auth token for proxy forwarding
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);

  // Initialize API key on mount and auth changes
  useEffect(() => {
    const initializeApiKey = async () => {
      console.log('[Chat] Initializing API key...');
      const token = await getApiKey();
      console.log('[Chat] Got API key:', token ? 'present' : 'null');
      setApiKey(token || undefined);
    };
    
    initializeApiKey();
  }, [isAuthenticated, user]); // Re-run when auth state changes

  // Debug logging for apiKey changes
  useEffect(() => {
    console.log('[Chat] API Key state changed:', apiKey ? 'present' : 'undefined');
  }, [apiKey]);

  // Get entity ID for state management
  const getEntityId = () => {
    const userId = user?.sub || "anonymous-user";
    const agentId = selectedAgent || "bbot";
    return userId.replace(/[|\-]/g, '') + '_' + agentId;
  };

  // Get current thread ID
  const getCurrentThreadId = () => {
    return currentSession?.threadId || ChatHistoryManager.getCurrentThreadId(MAIN_CHAT_ID) || undefined
  }

  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(() => getCurrentThreadId())

  const workdeskThreadId = useMemo(() => {
    const tid = activeThreadId || getCurrentThreadId()
    return tid && String(tid).trim() ? String(tid).trim() : null
  }, [activeThreadId, currentSession?.threadId])

  // Initialize the useStream hook with Bearer token authentication via apiKey
  console.log('[Chat] Initializing useStream with apiKey:', apiKey ? 'present' : 'undefined');
  console.log('[Chat] Current thread ID for useStream:', getCurrentThreadId());
  console.log('[Chat] isAuthenticated:', isAuthenticated);
  
  // For authenticated users, we must have apiKey before initializing useStream
  // For unauthenticated users, they can use embed proxy without apiKey
  const canInitializeStream = !isAuthenticated || (isAuthenticated && apiKey)
  
  console.log('[Chat] Can initialize stream:', canInitializeStream);
  console.log('[Chat] Authentication state - isAuthenticated:', isAuthenticated, 'apiKey present:', !!apiKey, 'selectedAgent:', selectedAgent);
  
  // Set up global fetch interceptor for LangGraph SDK internal requests
  useEffect(() => {
    // Only set up interceptor if we have an API key (authenticated users)
    if (!apiKey) return;
    
    const originalFetch = window.fetch;
    window.fetch = async (url: string | URL | Request, options?: RequestInit) => {
      // Check if this is a request to our proxy endpoints
      const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      
      if (urlString.includes('/api/proxy/') || urlString.includes('/api/embed-proxy/')) {
        console.log('[Chat] Intercepting fetch to proxy:', urlString);
        
        // Create headers object, being careful not to duplicate X-API-Key
        const existingHeaders = new Headers(options?.headers);
        
        // Remove any existing X-API-Key to prevent duplication
        existingHeaders.delete('X-API-Key');
        
        // Set our API key
        existingHeaders.set('X-API-Key', apiKey);
        
        const newOptions: RequestInit = {
          ...options,
          headers: existingHeaders,
        };
        return originalFetch(url, newOptions);
      }
      
      return originalFetch(url, options);
    };
    
    // Cleanup function
    return () => {
      window.fetch = originalFetch;
    };
  }, [apiKey]);
  
  const thread = useStream<{ messages: Message[]; entity_id?: string; user_id?: string; agent_id?: string }>({
    apiUrl: getApiUrl(),
    apiKey: canInitializeStream && isAuthenticated ? apiKey : undefined, // Only pass API key for authenticated users
    assistantId: canInitializeStream ? getAssistantId() : "bbot", // Use default if not initializing
    threadId: canInitializeStream ? (activeThreadId || getCurrentThreadId()) : undefined, // Only load thread if initializing
    messagesKey: "messages",
    onError: (error: unknown) => {
      console.error("Stream error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Chat error:", errorMessage);
    },
    onFinish: () => {
      console.log("Stream finished");
      try {
        const pending = pendingFollowUpsRef.current
        if (Array.isArray(pending) && pending.length > 0) {
          setFollowUpSuggestions(pending)
        }
      } catch {
        // ignore
      } finally {
        pendingFollowUpsRef.current = null
        setFollowUpSuggestionsLoading(false)
      }
      saveCurrentSession();
    },
    onThreadId: (threadId: string) => {
      console.log("[Chat] Thread ID received from LangGraph:", threadId);
      console.log("[Chat] Saving thread ID to localStorage");
      ChatHistoryManager.setCurrentThreadId(threadId, MAIN_CHAT_ID);
      setActiveThreadId(threadId)
      // Verify it was saved
      const savedId = ChatHistoryManager.getCurrentThreadId(MAIN_CHAT_ID);
      console.log("[Chat] Verified saved thread ID:", savedId);
    },
    onCustomEvent: (event: any) => {
      // 🔊 Handle TTS streaming audio chunks from 'custom' events
      if (event && event.audio_chunk) {
        console.log('[ChatInterface] 🎵 Received custom audio chunk:', event.audio_chunk.chunk_index);
        
        // Extract base64 data from URL if present
        let base64Data = '';
        if (event.audio_chunk.url && event.audio_chunk.url.startsWith('data:')) {
          base64Data = event.audio_chunk.url.split(',')[1];
        } else {
          base64Data = event.audio_chunk.data || '';
        }
        
        if (base64Data) {
          // Associate with the last AI message
          const messages = messagesRef.current;
          const lastMsg = messages[messages.length - 1] as any;
          
          // Check if we have a valid AI message to attach to
          if (lastMsg && (lastMsg.role === 'assistant' || lastMsg.type === 'ai') && lastMsg.id) {
            const msgId = lastMsg.id;
            setAudioMap(prev => ({
              ...prev,
              [msgId]: [...(prev[msgId] || []), base64Data]
            }));
          } else {
            console.warn('[ChatInterface] ⚠️ Received audio chunk but no valid AI message found to attach to');
          }
        }
      }

      // Workdesk / workspace files (Hub-style): merge any streamed virtual files into local list.
      try {
        const rawFiles =
          event?.files ||
          event?.data?.files ||
          event?.event?.files ||
          event?.payload?.files ||
          null
        if (rawFiles && typeof rawFiles === "object" && !Array.isArray(rawFiles)) {
          const out: Record<string, string> = {}
          for (const [k, v] of Object.entries(rawFiles as Record<string, unknown>)) {
            if (!k) continue
            if (typeof v === "string") out[k] = v
          }
          if (Object.keys(out).length) {
            mergeLocalWorkspaceFiles(out)
          }
        }
      } catch {
        // ignore
      }

      // Follow-up suggestions (post-response)
      try {
        const type = String(event?.type || event?.event?.type || "").trim()
        const isFollowups = type === "bbot_followups" || type === "followups" || type === "follow_up_suggestions"
        if (isFollowups) {
          const suggestions =
            (Array.isArray(event?.suggestions) && event.suggestions) ||
            (Array.isArray(event?.followups) && event.followups) ||
            (Array.isArray(event?.follow_up_suggestions) && event.follow_up_suggestions) ||
            (Array.isArray(event?.data?.suggestions) && event.data.suggestions) ||
            []
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            // Buffer and only render after stream finishes (onFinish)
            pendingFollowUpsRef.current = suggestions
          }
          setFollowUpSuggestionsLoading(false)
        }

        const isFollowupsLoading =
          type === "bbot_followups_loading" || type === "followups_loading" || type === "follow_up_suggestions_loading"
        if (isFollowupsLoading) {
          setFollowUpSuggestionsLoading(true)
        }
      } catch {
        // ignore
      }
    },
    // TODO: LangGraph SDK useStream doesn't support onToolEvent directly
    // Tool events need to be extracted from the message stream based on metadata/namespace
    // onToolEvent: handleToolEvent,
  });

  // Extract tool events from message stream (since LangGraph SDK doesn't support onToolEvent directly)
  useEffect(() => {
    // Sync messages ref for event handlers
    if (thread.messages) {
      messagesRef.current = thread.messages;
    }

    if (thread.messages && thread.messages.length > 0) {
      // Find tool messages and convert them to tool events
      const toolMessages = thread.messages.filter(msg => msg.type === "tool");
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
  }, [thread.messages, toolEvents.length]);

  useEffect(() => {
    const msgs: any[] = Array.isArray(thread.messages) ? thread.messages : []
    if (msgs.length === 0) return

    const extractFilesFromUnknown = (v: unknown): Record<string, string> | null => {
      if (!v || typeof v !== "object" || Array.isArray(v)) return null
      const r = v as Record<string, unknown>
      const files = r.files
      if (!files || typeof files !== "object" || Array.isArray(files)) return null
      const out: Record<string, string> = {}
      for (const [k, val] of Object.entries(files as Record<string, unknown>)) {
        if (!k) continue
        if (typeof val === "string") out[k] = val
      }
      return Object.keys(out).length ? out : null
    }

    const tryExtractFiles = (msg: any): Record<string, string> | null => {
      if (!msg || typeof msg !== "object") return null
      const direct =
        (msg.files && typeof msg.files === "object" ? msg.files : null) ||
        msg.additional_kwargs?.files ||
        msg.additional_kwargs?.kwargs?.files ||
        msg.tool_output?.files ||
        null

      if (direct && typeof direct === "object" && !Array.isArray(direct)) {
        const out: Record<string, string> = {}
        for (const [k, v] of Object.entries(direct as Record<string, unknown>)) {
          if (!k) continue
          if (typeof v === "string") out[k] = v
        }
        if (Object.keys(out).length) return out
      }

      const content = msg.content
      if (content && typeof content === "object") {
        const out = extractFilesFromUnknown(content)
        if (out) return out
      }

      if (typeof content === "string" && content.length < 200000 && content.includes('"files"')) {
        try {
          const parsed = JSON.parse(content)
          const out = extractFilesFromUnknown(parsed)
          if (out) return out
        } catch {
          // ignore
        }
      }

      return null
    }

    const slice = msgs.slice(Math.max(0, msgs.length - 25))
    for (const m of slice) {
      const id = m && (m.id || m.message_id) ? String(m.id || m.message_id) : ""
      if (!id) continue
      if (processedWorkspaceFileMessageIdsRef.current.has(id)) continue
      processedWorkspaceFileMessageIdsRef.current.add(id)

      const files = tryExtractFiles(m)
      if (files) mergeLocalWorkspaceFiles(files)
    }
  }, [thread.messages, mergeLocalWorkspaceFiles])

  // 🔊 Extract audio chunks from AI messages (TTS streaming fallback & history)
  useEffect(() => {
    if (thread.messages && thread.messages.length > 0) {
      thread.messages.forEach((msg: any) => {
        if (msg.type === "ai" && msg.id) {
          const additionalKwargs = msg.additional_kwargs;
          if (additionalKwargs && additionalKwargs.audio_chunks) {
            const chunks = additionalKwargs.audio_chunks;
            // Only update if we don't have these chunks yet (simple check)
            setAudioMap(prev => {
              if (prev[msg.id] && prev[msg.id].length >= chunks.length) return prev;
              return {
                ...prev,
                [msg.id]: chunks
              };
            });
          }
        }
      });
    }
  }, [thread.messages]);

  // Effect to clear chat when agent changes (but not on initial load/restore)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isSelectingChat, setIsSelectingChat] = useState(false)
  
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return // Don't clear session on initial load
    }
    
    // Don't clear session if we're currently selecting a chat from sidebar
    if (isSelectingChat) {
      console.log('[Chat] Agent changed during chat selection, skipping session clear')
      return
    }
    
    if (selectedAgent) {
      console.log('[Chat] Agent changed to:', selectedAgent, 'checking if session should be cleared')
      // Only clear if this is a manual agent change, not a restoration
      // Use the React state currentSession instead of localStorage to avoid timing issues
      if (!currentSession || currentSession.agentId !== selectedAgent) {
        console.log('[Chat] Clearing session due to agent change')
        setCurrentSession(null)
        ChatHistoryManager.clearCurrentThreadId(MAIN_CHAT_ID)
      } else {
        console.log('[Chat] Agent matches current session, keeping session')
      }
    }
  }, [selectedAgent, currentSession, isSelectingChat]);

  // Debug logging for thread state changes
  useEffect(() => {
    // Access thread ID from the hook's internal state
    const hookThreadId = (thread as any).threadId;
    console.log("[Chat] Messages:", thread.messages?.length || 0, "Loading:", thread.isLoading, "ThreadID:", hookThreadId || getCurrentThreadId() || 'none');
  }, [thread.messages?.length, thread.isLoading]);

  // Monitor thread ID changes for debugging
  const [lastThreadId, setLastThreadId] = useState<string | undefined>(undefined)
  
  useEffect(() => {
    const threadId = getCurrentThreadId()
    console.log("[Chat] Thread ID changed:", threadId, "Current session:", currentSession)
    
    // Just track the thread ID change for debugging, don't reload the page
    if (threadId && lastThreadId && threadId !== lastThreadId && !isInitialLoad) {
      console.log('[Chat] Thread changed from', lastThreadId, 'to', threadId, '- useStream should handle this automatically')
    }
    
    if (threadId) {
      setLastThreadId(threadId)
    }
  }, [currentSession, lastThreadId, isInitialLoad])

  // Additional detailed message logging  
  useEffect(() => {
    if (thread.messages && thread.messages.length > 0) {
      console.log("[Chat] Messages array updated:", thread.messages.map((msg, idx) => ({
        index: idx,
        type: msg.type,
        content: typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : msg.content
      })));
    }
  }, [thread.messages]);

  // Save current session to chat history (only once per thread)
  const saveCurrentSession = useCallback(() => {
    const messages = thread.messages;
    if (!messages || messages.length === 0) return;

    const userMessage = messages.find(msg => msg.type === 'human');
    const aiMessage = messages.find(msg => msg.type === 'ai');
    
    // Only save if we have both a user message and an AI response (complete exchange)
    if (!userMessage || !aiMessage) return;

    const userId = user?.sub || "anonymous-user";
    const threadId = getCurrentThreadId();
    
    if (!threadId) return;

    // Check if this thread already exists in chat history
    const existingSessions = ChatHistoryManager.getChatSessions(MAIN_CHAT_ID);
    const existingSession = existingSessions.find(session => 
      session.threadId === threadId && 
      session.agentId === selectedAgent &&
      (userId !== "anonymous-user" ? session.userId === userId : !session.userId || session.userId === "anonymous-user")
    );

    const session: ChatSession = {
      id: existingSession?.id || currentSession?.id || `${threadId}-${Date.now()}`,
      threadId: threadId,
      agentId: selectedAgent || "bbot",
      title: existingSession?.title || currentSession?.title || ChatHistoryManager.generateChatTitle(
        typeof userMessage.content === 'string' ? userMessage.content : 'New Chat'
      ),
      lastMessage: aiMessage && typeof aiMessage.content === 'string' 
        ? aiMessage.content.substring(0, 100) + (aiMessage.content.length > 100 ? '...' : '')
        : 'No response yet',
      timestamp: Date.now(), // Always update timestamp to show latest activity
      userId: userId !== "anonymous-user" ? userId : undefined // Don't store "anonymous-user" as userId
    };

    console.log('[Chat] Saving session to local storage:', session);
    ChatHistoryManager.saveChatSession(session, MAIN_CHAT_ID);
    setCurrentSession(session);
  }, [thread.messages, currentSession, selectedAgent, user?.sub]);

  // Function to handle sending a message with streaming
  const handleSendMessage = async (messageContent: string) => {
    setToolEvents([]); // Clear previous tool events
    setFollowUpSuggestions([])
    setFollowUpSuggestionsLoading(false)
    pendingFollowUpsRef.current = null
    console.log('[Chat] handleSendMessage called with:', messageContent)
    if (!messageContent.trim()) return

    try {
      const userId = user?.sub || "anonymous-user";
      const agentId = selectedAgent || "bbot";
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

          // Merge assistant apps with user apps (user apps take precedence)
          const agentObj = agents.find((a: any) => a.id === selectedAgent);
          const assistantApps = agentObj?.rawData?.config?.apps || {};
          const userApps = {};
          const mergedApps = { ...assistantApps, ...userApps };
          const config = agentObj?.rawData?.config || agentObj?.rawData?.metadata?.config || {};
          const userProfile = loadChatUserProfile(user?.sub || "anonymous")
          const baseSystemMessage =
            (typeof (config as any)?.system_message === "string" && (config as any).system_message.trim()
              ? (config as any).system_message.trim()
              : "") || "Be helpful and concise."
          const system_message = buildSystemMessageWithUserProfile(baseSystemMessage, userProfile)
          
          // Get output modalities directly from agent config
          const outputModalities = config.output_modalities || [];

          // Normal chat should NOT request TTS, even if an agent is configured with TTS.
          // TTS is reserved for Voice Call mode.
          const finalOutputModalities = Array.isArray(outputModalities)
            ? outputModalities.filter((m: any) => String(m?.type || "").toLowerCase() !== "tts")
            : [];

          // Create the new message
          const newMessage = {
            id: `msg-${Date.now()}`,
            role: "user" as const,
            content: messageContent,
          };

          // Get current conversation history and ensure tool calls have responses (like agent-chat-ui)
          const currentMessages = thread.messages || []
          
          // Ensure tool calls have responses before adding new message (like agent-chat-ui)
          const toolMessages: any[] = [] // ensureToolCallsHaveResponses(currentMessages)
          const allMessages = [...toolMessages, newMessage]

          console.log('[Chat] Submitting with message history:', allMessages.length, 'messages')
          console.log('[Chat] Current apiKey for submission:', apiKey ? 'present' : 'undefined')
          console.log('[Chat] Can initialize stream:', canInitializeStream)

          const queuedFiles = queuedWorkdeskFilesRef.current || {}
          const hasQueuedFiles = Object.keys(queuedFiles).length > 0

          // Submit using LangGraph's useStream (like agent-chat-ui)
          thread.submit(
            { 
              messages: allMessages,
              entity_id: entityId,
              user_id: userId,
              agent_id: agentId,
              ...(hasQueuedFiles ? { files: queuedFiles } : {}),
            },
            {
              config: {
                configurable: {
                  agent_id: agentId,
                  user_id: userId,
                  entity_id: entityId,
                  temperature: 0.7,
                  top_p: 1.0,
                  instructions: "Be helpful and concise.",
                  system_message,
                  apps: mergedApps,
                  distribution_channel: { type: "Chat" },
                  input_modalities: [],
                  output_modalities: finalOutputModalities, // Use configured or default BBot modalities
                }
              },
              streamMode: ["values", "messages", "updates", "custom"], // Full stream modes
              optimisticValues: (prev) => ({
                ...prev,
                messages: [
                  ...(prev.messages ?? []),
                  ...toolMessages,
                  newMessage,
                ] as any,
                entity_id: entityId,
                user_id: userId,
                agent_id: agentId,
              }),
            }
          );

          if (hasQueuedFiles) {
            takeQueuedWorkspaceFiles()
          }

      console.log('[Chat] Message submitted to stream');
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
    }
  };

  // Handle form submission for ChatInput compatibility
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>, messageContent: string) => {
    e.preventDefault();
    handleSendMessage(messageContent);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
        setTimeout(() => {
      handleSendMessage(suggestion);
    }, 100);
  };



  const handleTranscriptionComplete = (transcriptionText: string) => {
    setTranscription(transcriptionText)
    setIsTranscribing(false)
    // Auto-send the transcription
    handleSendMessage(transcriptionText)
  }

  // Handle voice message submission with audio modality
  const handleVoiceMessage = async (audioBlob: Blob, transcription: string, duration: number) => {
    setToolEvents([]); // Clear previous tool events
    setFollowUpSuggestions([])
    setFollowUpSuggestionsLoading(false)
    pendingFollowUpsRef.current = null
    console.log('[ChatInterface] Voice message received:', { 
      size: audioBlob.size, 
      type: audioBlob.type, 
      duration 
    })

    try {
      const userId = user?.sub || "anonymous-user";
      const agentId = selectedAgent || "bbot";
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

          // Merge assistant apps with user apps and get modalities
          const agentObj = agents.find((a: any) => a.id === selectedAgent);
          const assistantApps = agentObj?.rawData?.config?.apps || {};
          const userApps = {};
          const mergedApps = { ...assistantApps, ...userApps };
          const config = agentObj?.rawData?.config || agentObj?.rawData?.metadata?.config || {};
          const userProfile = loadChatUserProfile(user?.sub || "anonymous")
          const baseSystemMessage =
            (typeof (config as any)?.system_message === "string" && (config as any).system_message.trim()
              ? (config as any).system_message.trim()
              : "") || "Be helpful and concise."
          const system_message = buildSystemMessageWithUserProfile(baseSystemMessage, userProfile)
          
          // Get output modalities directly from agent config
          const outputModalities = config.output_modalities || [];

          // Voice messages should allow TTS so the agent can reply in text + voice.
          // If BBot has no modalities configured, default to Gemini Flash TTS for low latency.
          const isBBot = agentId === "bbot" || agentId === "b-bot"
          const defaultBBotTTS = [
            {
              type: "tts",
              model: "google/gemini-2.5-flash-preview-tts",
              model_name: "google/gemini-2.5-flash-preview-tts",
              voice: "Zephyr",
              auto_play: true,
            },
          ]
          const finalOutputModalities =
            isBBot && Array.isArray(outputModalities) && outputModalities.length === 0 ? defaultBBotTTS : outputModalities

          // Convert blob to base64 data URL (keep as webm)
      const reader = new FileReader();
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Create the new message with media type (audio/webm)
      const newMessage = {
        id: `msg-${Date.now()}`,
        role: "user" as const,
        type: "human" as const,
        content: [
          {
            type: "media",
            mime_type: "audio/webm",
            data: base64DataUrl // Full data URL with prefix
          }
        ]
      };

      // Get current conversation history
      const currentMessages = thread.messages || []
      const toolMessages: any[] = []
      const allMessages = [...toolMessages, newMessage]

      console.log('[ChatInterface] Submitting voice message as media modality:', {
        messageId: newMessage.id,
        audioSize: base64DataUrl.length,
        format: audioBlob.type,
        duration
      })

      const queuedFiles = queuedWorkdeskFilesRef.current || {}
      const hasQueuedFiles = Object.keys(queuedFiles).length > 0

          // Submit using LangGraph's useStream with audio modality
          // 🎤 Use audio-capable model for voice messages
          thread.submit(
            { 
              messages: allMessages,
              entity_id: entityId,
              user_id: userId,
              agent_id: agentId,
              ...(hasQueuedFiles ? { files: queuedFiles } : {}),
            },
            {
              config: {
                configurable: {
                  agent_id: agentId,
                  user_id: userId,
                  entity_id: entityId,
                  temperature: 0.7,
                  top_p: 1.0,
                  instructions: "Be helpful and concise.",
                  system_message,
                  apps: mergedApps,
                  distribution_channel: { type: "Chat" },
                  input_modalities: [], // No special input modalities needed (audio is in content)
                  output_modalities: finalOutputModalities, // Use configured or default BBot modalities
                }
              },
          streamMode: ["values", "messages", "updates", "custom"], // Full stream modes
          optimisticValues: (prev) => ({
            ...prev,
            messages: [
              ...(prev.messages ?? []),
              ...toolMessages,
              newMessage,
            ] as any,
            entity_id: entityId,
            user_id: userId,
            agent_id: agentId,
          }),
        }
      );

      if (hasQueuedFiles) {
        takeQueuedWorkspaceFiles()
      }

      console.log('[ChatInterface] Voice message submitted to stream');
    } catch (error) {
      console.error("Error in handleVoiceMessage:", error);
    }
  }

  // Sidebar handlers
  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar)
  }

  const handleSelectChat = async (session: ChatSession) => {
    console.log('[Chat] Selecting chat session:', session)
    
    // Set flag to prevent agent change useEffect from clearing session
    setIsSelectingChat(true)
    
    // Mark that we're loading an old conversation (don't auto-play audio)
    setIsLoadingOldConversation(true)
    
    // Set the current session and thread ID first
    setCurrentSession(session)
    ChatHistoryManager.setCurrentThreadId(session.threadId, MAIN_CHAT_ID)
    
    // Then set the agent
    setSelectedAgent(session.agentId)
    
    console.log('[Chat] Selected chat - agent:', session.agentId, 'thread:', session.threadId)
    
    // Try to load thread from server to get messages
    try {
      const threadWithMessages = await threadService.getThread(session.threadId)
      if (threadWithMessages && threadWithMessages.values?.messages) {
        console.log('[Chat] Loaded thread messages from server:', threadWithMessages.values.messages.length, 'messages')
      } else {
        console.log('[Chat] No messages found in thread on server')
      }
    } catch (error) {
      console.error('[Chat] Error loading thread from server:', error)
    } finally {
      // Clear the loading flag after messages are loaded (or failed to load)
      setTimeout(() => {
        setIsSelectingChat(false)
        // After conversation is loaded, reset the flag so new messages can auto-play
        setTimeout(() => {
          setIsLoadingOldConversation(false)
        }, 1000) // Give extra time for messages to render
      }, 300) // Small delay to ensure UI updates
    }
  }

  const handleSelectAgent = (agentId: string) => {
    console.log('[Chat] Selecting agent:', agentId)
    setSelectedAgent(agentId)
    // The useEffect will handle clearing the current session
  }

  const handleNewChat = () => {
    console.log('[Chat] Starting new chat')
    setCurrentSession(null)
    ChatHistoryManager.clearCurrentThreadId(MAIN_CHAT_ID)
    setIsLoadingOldConversation(false) // New chat should auto-play audio
    // No need to reload the page - useStream will start a new thread on next message
  }

  const handleToggleDiscover = () => {
    setSelectedAgent(null) // This will show the DiscoverPage
    setShowContactsPage(false)
  }

  const handleViewContacts = () => {
    setShowContactsPage(true)
  }

  const handleBackFromContacts = () => {
    setShowContactsPage(false)
  }

  const handleCloseDiscover = () => {
    // If there's a selected agent, go back to chat
    // Otherwise, go to contacts page
    if (selectedAgent) {
      // Already have an agent, just close discover (shouldn't happen)
      return
    }
    setShowContactsPage(true)
  }

  const handleSelectAgentFromContacts = (agentId: string) => {
    setSelectedAgent(agentId)
    setShowContactsPage(false)
    // Start a new chat with this agent
    handleNewChat()
  }

  const handleVoiceCall = () => {
    console.log('[Chat] Starting voice call')
    setShowVoiceCall(true)
  }

  const handleVideoCall = () => {
    console.log('[Chat] Video call not yet implemented')
    // For now, just start voice call (video can be added later)
    setShowVoiceCall(true)
  }

  const handleSearchMessages = () => {
    setShowMessageSearch(!showMessageSearch)
  }

  const handleSelectSearchResult = (messageIndex: number) => {
    // Scroll to the message (implementation can be enhanced)
    console.log('[Chat] Selected search result:', messageIndex)
    // TODO: Implement scrolling to specific message
  }

  // Track if we just left a call (to prevent auto-playing audio that was already heard)
  const [justLeftCall, setJustLeftCall] = useState(false);
  const callGreetingSentRef = useRef(false)
  
  // Callback when audio is played during call - mark message ID as played
  const handleAudioPlayedDuringCall = (messageIds: string[]) => {
    console.log('[Chat] Marking message IDs as played during call:', messageIds)
    setPlayedDuringCall(prev => {
      const newSet = new Set(prev)
      messageIds.forEach(id => newSet.add(id))
      return newSet
    })
  }
  
  const handleEndCall = () => {
    // Mark that we just left a call - audio should not auto-play
    setJustLeftCall(true)
    setShowVoiceCall(false)
    callGreetingSentRef.current = false
    // Messages will be shown in the chat view - don't auto-scroll so user sees full conversation
  }

  const handleCallConnected = useCallback(() => {
    // Trigger a one-time greeting run when the call is connected so the agent speaks first.
    if (callGreetingSentRef.current) return
    if (!selectedAgent) return

    callGreetingSentRef.current = true
    console.log("[Chat] Voice call connected; sending greeting run")

    try {
      const userId = user?.sub || "anonymous-user"
      const agentId = selectedAgent || "bbot"
      const entityId = userId.replace(/[|\-]/g, "") + "_" + agentId

      const agentObj = agents.find((a: any) => a.id === selectedAgent)
      const config = agentObj?.rawData?.config || agentObj?.rawData?.metadata?.config || {}
      const userProfile = loadChatUserProfile(user?.sub || "anonymous")
      const baseSystemMessage =
        (typeof (config as any)?.system_message === "string" && (config as any).system_message.trim()
          ? (config as any).system_message.trim()
          : "") || "You are speaking on a phone call. Keep it brief and natural."
      const system_message = buildSystemMessageWithUserProfile(baseSystemMessage, userProfile)
      const outputModalities = config.output_modalities || []

      // If BBot has no modalities configured, default to Gemini Flash TTS for low latency.
      const isBBot = selectedAgent === "bbot" || selectedAgent === "b-bot"
      const defaultBBotTTS = [
        {
          type: "tts",
          model: "google/gemini-2.5-flash-preview-tts",
          model_name: "google/gemini-2.5-flash-preview-tts",
          voice: "Zephyr",
          auto_play: true,
          streaming: true,
          provider: "google",
          speed: 1,
        },
      ]

      const finalOutputModalities = isBBot && outputModalities.length === 0 ? defaultBBotTTS : outputModalities

      const assistantApps = agentObj?.rawData?.config?.apps || {}
      const userApps = {}
      const mergedApps = { ...assistantApps, ...userApps }

      const greetingMessage: any = {
        id: `${DO_NOT_RENDER_ID_PREFIX}call-greeting-${Date.now()}`,
        role: "user",
        type: "human",
        content: "Start the call with one short friendly greeting sentence and ask how you can help.",
      }

      thread.submit(
        {
          messages: [greetingMessage],
          entity_id: entityId,
          user_id: userId,
          agent_id: agentId,
        },
        {
          config: {
            configurable: {
              agent_id: agentId,
              user_id: userId,
              entity_id: entityId,
              temperature: 0.4,
              top_p: 1.0,
              instructions: "You are speaking on a phone call. Keep it brief and natural.",
              system_message,
              apps: mergedApps,
              distribution_channel: { type: "Chat" },
              input_modalities: [],
              output_modalities: finalOutputModalities,
            },
          },
          streamMode: ["values", "messages", "updates", "custom"],
          optimisticValues: (prev) => ({
            ...prev,
            messages: [...(prev.messages ?? []), greetingMessage] as any,
            entity_id: entityId,
            user_id: userId,
            agent_id: agentId,
          }),
        },
      )
    } catch (e) {
      console.error("[Chat] Failed to send call greeting:", e)
      // Allow retry if something threw before submit.
      callGreetingSentRef.current = false
    }
  }, [agents, selectedAgent, thread, user?.sub])

  // Track if we're currently submitting audio to prevent double calls
  const isSubmittingAudioRef = useRef(false);
  
  const handleCallAudioData = async (audioBuffer: Float32Array, timestamp: number) => {
    // Prevent double submissions
    if (isSubmittingAudioRef.current) {
      console.log('[Chat] Already submitting audio, skipping duplicate call')
      return;
    }
    
    isSubmittingAudioRef.current = true;
    console.log('[Chat] Received audio from call, length:', audioBuffer.length)
    
    try {
      // Convert Float32Array to WAV Blob
      const wavBlob = await convertFloat32ToWav(audioBuffer)
      
      // Convert to base64 data URL using Promise instead of callback to avoid double-fire
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(wavBlob)
      });
      
      // Create message with audio modality (matching handleVoiceMessage format)
      const newMessage: any = {
        id: `msg-${Date.now()}`,
        role: 'user',
        type: 'human',
        content: [
          {
            type: "media",
            mime_type: "audio/wav",
            data: base64DataUrl
          }
        ]
      }

      console.log('[Chat] Submitting audio message:', newMessage.id)
      console.log('[Chat] Current thread messages before submit:', thread.messages?.length || 0)
      console.log('[Chat] Thread ID:', (thread as any).threadId || getCurrentThreadId() || 'new thread')

      // Get required IDs for LangGraph (same as handleSendMessage)
      const userId = user?.sub || "anonymous-user";
      const agentId = selectedAgent || "bbot";
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

      // Get agent configuration (same as handleSendMessage)
      const agentObj = agents.find((a: any) => a.id === selectedAgent)
      const config = agentObj?.rawData?.config || agentObj?.rawData?.metadata?.config || {}
      const userProfile = loadChatUserProfile(user?.sub || "anonymous")
      const baseSystemMessage =
        (typeof (config as any)?.system_message === "string" && (config as any).system_message.trim()
          ? (config as any).system_message.trim()
          : "") || "Be helpful and concise."
      const system_message = buildSystemMessageWithUserProfile(baseSystemMessage, userProfile)

      // Extract output modalities from agent config
      const outputModalities = config.output_modalities || []
      
      // EXCEPTION: For the BBot Platform assistant ("bbot" or "b-bot"), we ALWAYS enable TTS by default
      const isBBot = selectedAgent === 'bbot' || selectedAgent === 'b-bot';
      const defaultBBotTTS = [{
        type: "tts",
        // Send both keys for compatibility with Synapse (expects `model`) and UI (often uses `model_name`)
        model: "google/gemini-2.5-flash-preview-tts",
        model_name: "google/gemini-2.5-flash-preview-tts",
        voice: "Zephyr",
        auto_play: true,
        streaming: true,
        provider: "google",
        speed: 1
      }];
      
      const finalOutputModalities = (isBBot && outputModalities.length === 0) 
        ? defaultBBotTTS 
        : outputModalities;

      // Merge assistant apps with user apps as OBJECTS (not arrays!)
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const userApps = {};
      const mergedApps = { ...assistantApps, ...userApps };

      // Get the current thread ID to ensure we use the same thread
      const currentThreadId = getCurrentThreadId();
      console.log('[Chat] Submitting to thread:', currentThreadId || 'new thread will be created');
      
      // Submit to LangGraph stream with required entity_id
      thread.submit(
        { 
          messages: [newMessage],
          entity_id: entityId,
          user_id: userId,
          agent_id: agentId
        },
        {
          config: {
            configurable: {
              agent_id: agentId,
              user_id: userId,
              entity_id: entityId,
              temperature: 0.7,
              top_p: 1.0,
              instructions: "Be helpful and concise.",
              system_message,
              apps: mergedApps,
              distribution_channel: { type: "Chat" },
              input_modalities: [],
              output_modalities: finalOutputModalities,
            }
          },
          streamMode: ["values", "messages", "updates", "custom"],
          optimisticValues: (prev) => ({
            ...prev,
            messages: [
              ...(prev.messages ?? []),
              newMessage,
            ] as any,
            entity_id: entityId,
            user_id: userId,
            agent_id: agentId,
          }),
        }
      );
      
      console.log('[Chat] Voice call audio submitted to stream');
    } catch (error) {
      console.error('[Chat] Error submitting call audio:', error);
    } finally {
      // Reset the flag after a short delay to allow for next speech segment
      setTimeout(() => {
        isSubmittingAudioRef.current = false;
      }, 500);
    }
  }

  // Convert Float32Array to WAV Blob
  const convertFloat32ToWav = async (float32Array: Float32Array): Promise<Blob> => {
    const sampleRate = 16000 // VAD outputs at 16kHz
    const numChannels = 1
    const bitsPerSample = 16

    // Convert float32 to int16
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // Create WAV file
    const dataLength = int16Array.length * (bitsPerSample / 8)
    const buffer = new ArrayBuffer(44 + dataLength)
    const view = new DataView(buffer)

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + dataLength, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true)
    view.setUint16(32, numChannels * (bitsPerSample / 8), true)
    view.setUint16(34, bitsPerSample, true)
    writeString(36, 'data')
    view.setUint32(40, dataLength, true)

    // Write audio data
    const offset = 44
    for (let i = 0; i < int16Array.length; i++) {
      view.setInt16(offset + i * 2, int16Array[i], true)
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  // Load recent agents (prefer Synapse threads; fallback to local history).
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const canUseServer = Boolean(user?.sub) && (isAuthenticated || isLocallyAuthenticated())
        if (canUseServer) {
          const threads = await threadService.getThreads(user?.sub)
          if (mounted && Array.isArray(threads) && threads.length > 0) {
            const activity = new Map<string, number>()
            for (const th of threads) {
              const agentId = (th as any)?.metadata?.assistant_id || (th as any)?.config?.configurable?.agent_id
              if (!agentId) continue
              const ts = new Date((th as any).updated_at).getTime()
              const prev = activity.get(String(agentId)) || 0
              if (ts > prev) activity.set(String(agentId), ts)
            }
            const ids = Array.from(activity.entries())
              .sort(([, a], [, b]) => b - a)
              .map(([id]) => id)
              .slice(0, 5)
            setRecentAgents(ids)
            return
          }
        }
      } catch (e) {
        console.warn("[Chat] Failed to load recent agents from server; falling back to local history", e)
      }

      // Fallback: local chat history
      const allSessions = ChatHistoryManager.getChatSessions(MAIN_CHAT_ID)
      const userId = user?.sub
      const userSessions = allSessions.filter((session: ChatSession) => {
        return userId ? session.userId === userId : (!session.userId || session.userId === "anonymous-user")
      })
      const agentActivity = new Map<string, number>()
      userSessions.forEach((session: ChatSession) => {
        const agentId = session.agentId
        const currentLatest = agentActivity.get(agentId) || 0
        if (session.timestamp > currentLatest) agentActivity.set(agentId, session.timestamp)
      })
      if (mounted) {
        setRecentAgents(
          Array.from(agentActivity.entries())
            .sort(([, a], [, b]) => b - a)
            .map(([agentId]) => agentId)
            .slice(0, 5),
        )
      }
    })()
    return () => {
      mounted = false
    }
  }, [user?.sub, isAuthenticated])

  // Show voice call view
  if (showVoiceCall && selectedAgent) {
    const agentData = agents.find((a: any) => a.id === selectedAgent)
    return (
      <VoiceCallView
        agentName={agentData?.name || "B-Bot"}
        agentAvatar={
          agentData?.profileImage ||
          (selectedAgent === "bbot" || selectedAgent === "b-bot" ? branding?.mainAgentLogoUrl : undefined) ||
          (selectedAgent === "bbot" || selectedAgent === "b-bot"
            ? "https://beyond-bot.ai/logo-schwarz.svg"
            : "/helpful-robot.png")
        }
        onEndCall={handleEndCall}
        onAudioData={handleCallAudioData}
        onCallConnected={handleCallConnected}
        onAudioPlayed={handleAudioPlayedDuringCall}
        messages={thread.messages || []}
        audioMap={audioMap}
        isLoading={thread.isLoading}
      />
    )
  }

  // Show contacts page
  if (showContactsPage) {
    return (
      <ContactsPage
        contacts={contactsAgents}
        allAgents={agents}
        onSelectAgent={handleSelectAgentFromContacts}
        onSelectConversation={(session) => {
          handleSelectChat(session)
          setShowContactsPage(false)
        }}
        onDiscoverAgents={handleToggleDiscover}
        onBack={handleBackFromContacts}
        currentAgentId={selectedAgent || undefined}
        onRemoveContact={handleRemoveContact}
      />
    )
  }

  // Show discover page when no agent is selected
  if (!selectedAgent) {
    return (
      <DiscoverPage
        onSelectAgent={setSelectedAgent}
        onClose={handleCloseDiscover}
        recentAgents={recentAgents}
        contactAgentIds={contactAgentIds}
        onToggleContact={handleToggleContact}
      />
    )
  }

  // For authenticated users, wait for apiKey to be available before proceeding
  // Anonymous users can proceed immediately using embed proxy
  if (isAuthenticated && !apiKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-2">Authenticating...</p>
        </div>
      </div>
    )
  }

  const selectedAgentData = agents.find((a: any) => a.id === selectedAgent)
  
  // Debug: Log the full agent data structure
  if (selectedAgentData && selectedAgent) {
    console.log('[Audio Check] Selected agent:', selectedAgent)
    console.log('[Audio Check] Agent data structure:', {
      hasRawData: !!selectedAgentData.rawData,
      hasConfig: !!selectedAgentData.rawData?.config,
      hasMetadataConfig: !!selectedAgentData.rawData?.metadata?.config,
      configKeys: selectedAgentData.rawData?.config ? Object.keys(selectedAgentData.rawData.config) : [],
      metadataConfigKeys: selectedAgentData.rawData?.metadata?.config ? Object.keys(selectedAgentData.rawData.metadata.config) : [],
      fullAgent: selectedAgentData
    })
  }
  
  // Check if agent supports audio input (for voice recording and calls)
  const hasAudioInput = () => {
    // Default to true for B-Bot standard expert
    const isBBot = selectedAgent === 'bbot' || selectedAgent === 'b-bot'
    
    if (!selectedAgentData?.rawData) {
      console.log('[Audio Check] No rawData found for agent:', selectedAgent, '- defaulting to', isBBot)
      return isBBot // Default to true for B-Bot
    }
    
    // Check both possible locations: config and metadata.config
    const config = selectedAgentData.rawData.config || selectedAgentData.rawData.metadata?.config
    if (!config) {
      console.log('[Audio Check] No config found in rawData for agent:', selectedAgent, '- defaulting to', isBBot)
      return isBBot // Default to true for B-Bot
    }
    
    const inputModalities = config.input_modalities || []
    console.log('[Audio Check] Input modalities:', inputModalities)
    
    // If no modalities configured, default to true for B-Bot
    if (inputModalities.length === 0) {
      console.log('[Audio Check] No input modalities configured - defaulting to', isBBot)
      return isBBot
    }
    
    const hasInput = inputModalities.some((mod: any) => 
      mod.type === 'audio' || mod.type === 'stt' || mod.type === 'voice'
    )
    console.log('[Audio Check] Has audio input:', hasInput)
    return hasInput
  }
  
  // Check if agent supports audio output (for TTS and calls)
  const hasAudioOutput = () => {
    // Default to true for B-Bot standard expert
    const isBBot = selectedAgent === 'bbot' || selectedAgent === 'b-bot'
    
    if (!selectedAgentData?.rawData) {
      console.log('[Audio Check] No rawData found for agent:', selectedAgent, '- defaulting to', isBBot)
      return isBBot // Default to true for B-Bot
    }
    
    // Check both possible locations: config and metadata.config
    const config = selectedAgentData.rawData.config || selectedAgentData.rawData.metadata?.config
    if (!config) {
      console.log('[Audio Check] No config found in rawData for agent:', selectedAgent, '- defaulting to', isBBot)
      return isBBot // Default to true for B-Bot
    }
    
    const outputModalities = config.output_modalities || []
    console.log('[Audio Check] Output modalities:', outputModalities)
    
    // If no modalities configured, default to true for B-Bot
    if (outputModalities.length === 0) {
      console.log('[Audio Check] No output modalities configured - defaulting to', isBBot)
      return isBBot
    }
    
    const hasOutput = outputModalities.some((mod: any) => 
      mod.type === 'tts' || mod.type === 'audio' || mod.type === 'voice'
    )
    console.log('[Audio Check] Has audio output:', hasOutput)
    return hasOutput
  }
  
  // Agent supports voice calls if it has both audio input and output
  const supportsVoiceCalls = hasAudioInput() && hasAudioOutput()
  console.log('[Audio Check] Supports voice calls:', supportsVoiceCalls)

  const effectiveAgentAvatar =
    selectedAgentData?.profileImage ||
    (selectedAgent === "bbot" || selectedAgent === "b-bot" ? branding?.mainAgentLogoUrl : undefined) ||
    (selectedAgent === "bbot" || selectedAgent === "b-bot"
      ? "https://beyond-bot.ai/logo-schwarz.svg"
      : "/helpful-robot.png")

  return (
    <>
      <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
        <ChatHeader
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={showSidebar}
          onToggleDiscover={handleToggleDiscover}
          onViewContacts={handleViewContacts}
          onVoiceCall={supportsVoiceCalls ? handleVoiceCall : undefined}
          onSearchMessages={handleSearchMessages}
          onOpenWorkdesk={() => setWorkdeskOpen(true)}
          agentName={selectedAgentData?.name || "B-Bot"}
          agentAvatar={effectiveAgentAvatar}
          agentData={selectedAgentData}
          hasMessages={thread.messages && thread.messages.length > 0}
        />

        {/* Message Search Bar */}
        {showMessageSearch && (
          <MessageSearch
            messages={thread.messages || []}
            onClose={() => setShowMessageSearch(false)}
            onSelectMessage={handleSelectSearchResult}
          />
        )}

        <div className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
          {isSelectingChat ? (
            <div className="flex items-center justify-center h-full bg-background">
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
                </div>
                <p className="text-lg font-semibold text-foreground mb-2">{t("chat.loadingConversationTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("chat.loadingConversationSubtitle")}</p>
              </div>
            </div>
          ) : (
            <EnhancedChatMessages
              shouldAutoPlayAudio={!isLoadingOldConversation}
              playedMessageIds={playedDuringCall}
              messages={thread.messages?.filter((msg: any) => {
                // Filter out empty AI messages that only contain tool_calls (trigger messages)
                if (msg.type === "ai" && (!msg.content || msg.content.trim() === "") && msg.tool_calls && msg.tool_calls.length > 0) {
                  console.log("🚫 [ChatInterface] Filtering out empty AI message with tool_calls:", msg.id);
                  return false;
                }
                return true;
              }).map((msg: any) => ({
                id: msg.id || `msg-${Date.now()}-${Math.random()}`,
                role: msg.role || (msg.type === 'human' ? 'user' : msg.type === 'tool' ? 'tool_response' : 'assistant'),
                content: msg.content, // ✅ Keep content as-is (string or array) for multimodality support
                type: msg.type,
                // Pass through tool call properties for proper inline display
                tool_calls: msg.tool_calls,
                tool_call_id: msg.tool_call_id,
                name: msg.name
              })) || []}
              messagesEndRef={messagesEndRef}
              selectedAgent={selectedAgent}
              agents={agents}
              onSuggestionClick={handleSuggestionClick}
              suggestions={
                (() => {
                  const brandingSuggestions = Array.isArray(branding?.welcomeSuggestions)
                    ? branding!.welcomeSuggestions.map((x) => String(x ?? "").trim()).filter(Boolean)
                    : []

                  const isBBot =
                    !selectedAgent ||
                    selectedAgent === "bbot" ||
                    selectedAgent === "b-bot" ||
                    agents.find((a: any) => a.id === selectedAgent)?.name?.toLowerCase?.() === "b-bot" ||
                    agents.find((a: any) => a.id === selectedAgent)?.name?.toLowerCase?.() === "bbot"

                  const raw = agents
                    .find((a: any) => a.id === selectedAgent)
                    ?.templates?.map((t: any) => t.template_text || (t.attributes && t.attributes.template_text) || t.text || t)

                  const agentTemplates = Array.isArray(raw)
                    ? raw.map((x: any) => String(x ?? "").trim()).filter(Boolean)
                    : []

                  // For BBot, always prefer runtime welcome suggestions (Swiss) over any templates.
                  if (isBBot && brandingSuggestions.length > 0) return brandingSuggestions

                  // For other agents, prefer their templates when they exist; otherwise fall back to branding.
                  return agentTemplates.length > 0 ? agentTemplates : brandingSuggestions
                })()
              }
              userColor={branding?.accentColor || "#ff3131"}
              welcomeTitle={computedWelcomeTitle}
              welcomeSubtitle={computedWelcomeSubtitle}
              isLoading={thread.isLoading}
              toolEvents={toolEvents}
              followUpSuggestions={followUpSuggestions}
              followUpSuggestionsLoading={followUpSuggestionsLoading}
              onFollowupClick={(s) => setDraftInput(s)}
              audioMap={audioMap}
            />
          )}
        </div>

        <div className="flex-none bg-background border-t border-gray-200 dark:border-gray-700">
          <ChatInput
            onSubmit={handleFormSubmit}
            onVoiceMessage={hasAudioInput() ? handleVoiceMessage : undefined}
            isLoading={thread.isLoading}
            selectedAgent={selectedAgent}
            agentName={agents.find((a: any) => a.id === selectedAgent)?.name}
            draft={draftInput}
            onDraftChange={setDraftInput}
            onOpenWorkdesk={() => {
              setWorkdeskAutoPick(false)
              setWorkdeskOpen(true)
            }}
            onAddWorkdeskFiles={() => {
              setWorkdeskAutoPick(true)
              setWorkdeskOpen(true)
            }}
          />
        </div>
      </div>

      <MainChatSidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        onSelectChat={handleSelectChat}
        onSelectAgent={handleSelectAgent}
        onDiscoverAgents={handleToggleDiscover}
        onNewChat={handleNewChat}
        currentThreadId={getCurrentThreadId()}
        currentAgentId={selectedAgent || "bbot"}
        userId={user?.sub}
        agents={agents}
        embedId={MAIN_CHAT_ID}
      />

      <WorkdeskDrawer
        isOpen={workdeskOpen}
        onClose={() => {
          setWorkdeskAutoPick(false)
          setWorkdeskOpen(false)
        }}
        getToken={getAuthTokenForMainApi}
        threadId={workdeskThreadId}
        queuedFiles={queuedWorkdeskFiles}
        localEntries={localWorkspaceEntries}
        localContents={localWorkspaceFilesRef.current}
        onQueueWorkspaceFile={queueWorkspaceFile}
        onRemoveQueuedFile={removeQueuedWorkspaceFile}
        autoPick={workdeskAutoPick}
        onAutoPickConsumed={() => setWorkdeskAutoPick(false)}
      />

        <PaymentRequiredModal
        isOpen={showPaymentModal && isAuthenticated}
        onClose={() => setShowPaymentModal(false)}
        currentBalance={remainingCredits}
        onBalanceUpdated={(newBalance) => setRemainingCredits(newBalance)}
          onAutoRechargeChange={(enabled) => {
          // Handle auto recharge change if needed
          console.log('Auto recharge enabled:', enabled)
          }}
        />

      {showAutoRechargeNotification && (
        <AutoRechargeNotification
          onClose={() => setShowAutoRechargeNotification(false)}
          amount={autoRechargeAmount}
        />
      )}
    </>
  )
}
