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
// Temporarily remove tool response handling to avoid type conflicts
// import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses"
import { MainChatSidebar } from "./main-chat-sidebar"
import { PaymentRequiredModal } from "./payment-required-modal"
import { AutoRechargeNotification } from "./auto-recharge-notification"
import { DiscoverPage } from "./discover-page"
import { AgentSelector } from "./agent-selector"
import { useAgents } from "@/lib/agent-service"
import { useAuth0 } from "@auth0/auth0-react"
import { useAuthenticatedFetch, isLocallyAuthenticated, getAuthToken } from "@/lib/api"
import { ThreadService, type Thread } from "@/lib/thread-service"

// Import the LANGGRAPH_AUDIENCE constant
import { LANGGRAPH_AUDIENCE } from "@/lib/api"

interface ChatInterfaceProps {
  initialAgent?: string | null
}

export function ChatInterface({ initialAgent }: ChatInterfaceProps) {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()
  const [agents, setAgents] = useState<any[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [remainingCredits, setRemainingCredits] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAutoRechargeNotification, setShowAutoRechargeNotification] = useState(false)
  const [autoRechargeAmount, setAutoRechargeAmount] = useState(0)
  const [toolEvents, setToolEvents] = useState<any[]>([])

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
    const proxyEndpoint = (!isAuthenticated || selectedAgent === "bbot") ? '/api/embed-proxy' : '/api/proxy';
    
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
    threadId: canInitializeStream ? getCurrentThreadId() : undefined, // Only load thread if initializing
    messagesKey: "messages",
    onError: (error: unknown) => {
      console.error("Stream error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Chat error:", errorMessage);
    },
    onFinish: () => {
      console.log("Stream finished");
      scrollToBottom();
      saveCurrentSession();
    },
    onThreadId: (threadId: string) => {
      console.log("Thread ID received:", threadId);
      ChatHistoryManager.setCurrentThreadId(threadId, MAIN_CHAT_ID);
    },
    // TODO: LangGraph SDK useStream doesn't support onToolEvent directly
    // Tool events need to be extracted from the message stream based on metadata/namespace
    // onToolEvent: handleToolEvent,
  });

  // Extract tool events from message stream (since LangGraph SDK doesn't support onToolEvent directly)
  useEffect(() => {
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
    console.log("[Chat] Thread state changed:", {
      messagesLength: thread.messages?.length || 0,
      isLoading: thread.isLoading,
      values: thread.values,
      firstMessage: thread.messages?.[0],
      lastMessage: thread.messages?.[thread.messages.length - 1],
      currentThreadId: getCurrentThreadId(),
      selectedAgent: selectedAgent
    });
  }, [thread.messages, thread.isLoading, thread.values, selectedAgent]);

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

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
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

      // Submit using LangGraph's useStream (like agent-chat-ui)
      thread.submit(
        { 
          messages: allMessages,
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
          max_tokens: 1024,
          top_p: 1.0,
          instructions: "Be helpful and concise.",
          apps: mergedApps,
            }
          },
          streamMode: ["messages", "updates"], // Use messages/updates for proper event streaming like B-Bot Hub
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

  // Sidebar handlers
  const handleToggleSidebar = () => {
    setShowSidebar(!showSidebar)
  }

  const handleSelectChat = async (session: ChatSession) => {
    console.log('[Chat] Selecting chat session:', session)
    
    // Set flag to prevent agent change useEffect from clearing session
    setIsSelectingChat(true)
    
    // Set the current session and thread ID first
    setCurrentSession(session)
    ChatHistoryManager.setCurrentThreadId(session.threadId, MAIN_CHAT_ID)
    
    // Then set the agent
    setSelectedAgent(session.agentId)
    
    // Clear the flag after a short delay to allow React to process the state updates
    setTimeout(() => {
      setIsSelectingChat(false)
    }, 100)
    
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
    // No need to reload the page - useStream will start a new thread on next message
  }

  const handleToggleDiscover = () => {
    setSelectedAgent(null) // This will show the DiscoverPage
  }

  // Get recent agents from chat history
  const getRecentAgents = (): string[] => {
    const allSessions = ChatHistoryManager.getChatSessions(MAIN_CHAT_ID)
    const userId = user?.sub
    
    // Filter sessions for current user (including anonymous users)
    const userSessions = allSessions.filter((session: ChatSession) => {
      const matchesUser = userId ? session.userId === userId : (!session.userId || session.userId === "anonymous-user")
      return matchesUser
    })

    // Get unique agent IDs sorted by most recent activity
    const agentActivity = new Map<string, number>()
    
    userSessions.forEach((session: ChatSession) => {
      const agentId = session.agentId
      const currentLatest = agentActivity.get(agentId) || 0
      if (session.timestamp > currentLatest) {
        agentActivity.set(agentId, session.timestamp)
      }
    })

    // Sort by timestamp and return agent IDs
    return Array.from(agentActivity.entries())
      .sort(([,a], [,b]) => b - a)
      .map(([agentId]) => agentId)
      .slice(0, 5) // Return top 5 recent agents
  }

  if (!selectedAgent) {
    return (
      <DiscoverPage
        onSelectAgent={setSelectedAgent}
        recentAgents={getRecentAgents()}
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

  return (
    <>
      <div className="flex flex-col h-screen bg-background">
        <ChatHeader
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={showSidebar}
          onToggleDiscover={handleToggleDiscover}
        />

        <div className="flex-1 overflow-hidden">
          {isSelectingChat ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
                <p>Loading conversation...</p>
                <p className="text-sm">Please wait while we load your chat</p>
              </div>
            </div>
          ) : (
            <EnhancedChatMessages
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
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
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
                agents.find((a: any) => a.id === selectedAgent)?.templates?.map((t: any) =>
                  t.template_text || (t.attributes && t.attributes.template_text) || t.text || t
                )
              }
              userColor="#2563eb"
              isLoading={thread.isLoading}
              toolEvents={toolEvents}
            />
          )}
        </div>

        <div className="bg-background">
              <ChatInput
            onSubmit={handleFormSubmit}
            isLoading={thread.isLoading}
                selectedAgent={selectedAgent}
            agentName={agents.find((a: any) => a.id === selectedAgent)?.name}
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
