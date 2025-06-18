"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { EmbedChatHeader } from "./embed-chat-header"
import { ChatHistorySidebar } from "./chat-history-sidebar"
import { useAuth0 } from "@auth0/auth0-react"
import { getAuthToken, isLocallyAuthenticated } from "@/lib/api"
import { LANGGRAPH_AUDIENCE } from "@/lib/api"
import { useAgents } from "@/lib/agent-service"
import { useRouter } from 'next/router'
import { useStream } from "@langchain/langgraph-sdk/react"
import type { Message } from "@langchain/langgraph-sdk"
import { ChatHistoryManager, ChatSession } from "@/lib/chat-history"

interface EmbedChatInterfaceProps {
  initialAgent?: string
  embedUserId?: string | null
}

export function EmbedChatInterface({ initialAgent, embedUserId }: EmbedChatInterfaceProps) {
  // Normalize agent id: treat 'b-bot' and 'bbot' as the same
  const normalizedAgent = (!initialAgent || initialAgent === "b-bot" || initialAgent === "bbot") ? "bbot" : initialAgent;
  const [selectedAgent] = useState<string>(normalizedAgent);
  const [tokensUsed, setTokensUsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [input, setInput] = useState("")
  const [agentValid, setAgentValid] = useState<boolean>(false)
  const [agentError, setAgentError] = useState<string>("")
  const { getAgent } = useAgents()
  const [agentObj, setAgentObj] = useState<any>(null);
  const [toolEvents, setToolEvents] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);

  // Get streaming and color from query params
  let streaming = true;
  let userColor = '#2563eb'; // default blue
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.has('streaming')) {
      streaming = params.get('streaming') !== 'false';
    }
    if (params.has('color')) {
      userColor = params.get('color') || userColor;
    }
  }

  const { isAuthenticated, getAccessTokenSilently, user } = useAuth0()

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

  // Get the headers including the Admin-API-Key for embed mode
  const getHeaders = async () => {
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // For embed mode with admin API key
    if (embedUserId && ADMIN_API_KEY) {
      return {
        ...baseHeaders,
        "Admin-API-Key": ADMIN_API_KEY,
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

    // For B-Bot without authentication - use admin API key if available
    if (selectedAgent === "bbot" && ADMIN_API_KEY) {
      return {
        ...baseHeaders,
        "Admin-API-Key": ADMIN_API_KEY,
      };
    }

    return baseHeaders;
  };

  // Get the API URL for LangGraph - use the proxy endpoint
  const getApiUrl = () => {
    // Use the proxy endpoint which handles authentication internally
    // Need to construct absolute URL for LangGraph client
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/proxy`;
    }
    // Fallback for server-side rendering
    return '/api/proxy';
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

  // State for API key (can be undefined since proxy handles auth)
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);

  // Get entity ID for state management
  const getEntityId = () => {
    const userId = embedUserId || user?.sub || "anonymous-user";
    const agentId = selectedAgent || "bbot";
    return userId.replace(/[|\-]/g, '') + '_' + agentId;
  };

  // Get stored thread ID or use current session thread ID
  const getThreadId = () => {
    return currentSession?.threadId || ChatHistoryManager.getCurrentThreadId();
  };

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
      setAgentError(errorMessage || "An error occurred");
    },
    onFinish: () => {
      console.log("Stream finished");
      scrollToBottom();
      saveCurrentSession();
    },
    onThreadId: (threadId: string) => {
      console.log("Thread ID received:", threadId);
      ChatHistoryManager.setCurrentThreadId(threadId);
    },
  });

  // Workaround state for SDK bug - manually track streaming messages  
  const [streamingMessages, setStreamingMessages] = useState<Message[]>([]);
  
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

  // Save current session to chat history
  const saveCurrentSession = useCallback(() => {
    const messages = streamingMessages.length > 0 ? streamingMessages : thread.messages;
    if (!messages || messages.length === 0) return;

    const userMessage = messages.find(msg => msg.type === 'human');
    const aiMessage = messages.find(msg => msg.type === 'ai');
    
    if (!userMessage) return;

    const userId = embedUserId || user?.sub;
    const threadId = ChatHistoryManager.getCurrentThreadId();
    
    if (!threadId) return;

    const session: ChatSession = {
      id: currentSession?.id || `${threadId}-${Date.now()}`,
      threadId: threadId,
      agentId: selectedAgent,
      title: currentSession?.title || ChatHistoryManager.generateChatTitle(
        typeof userMessage.content === 'string' ? userMessage.content : 'New Chat'
      ),
      lastMessage: aiMessage && typeof aiMessage.content === 'string' 
        ? aiMessage.content.substring(0, 100) + (aiMessage.content.length > 100 ? '...' : '')
        : 'No response yet',
      timestamp: Date.now(),
      userId: userId
    };

    ChatHistoryManager.saveChatSession(session);
    setCurrentSession(session);
  }, [streamingMessages, thread.messages, currentSession, selectedAgent, embedUserId, user?.sub]);

  // Update streaming messages when SDK finally updates
  useEffect(() => {
    if (thread.messages && thread.messages.length > 0) {
      setStreamingMessages(thread.messages);
      // Save session when messages are updated (debounced)
      const timeoutId = setTimeout(() => {
        saveCurrentSession();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [thread.messages, saveCurrentSession]);

  // Start a new chat
  const handleNewChat = () => {
    ChatHistoryManager.clearCurrentThreadId();
    setCurrentSession(null);
    setStreamingMessages([]);
    // The thread will automatically create a new thread ID on next message
    window.location.reload(); // Simple way to reset the chat state
  };

  // Select a chat from history
  const handleSelectChat = (session: ChatSession) => {
    setCurrentSession(session);
    ChatHistoryManager.setCurrentThreadId(session.threadId);
    // Reload to load the selected thread
    window.location.reload();
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [streamingMessages, thread.messages]);

  // Load agent information
  useEffect(() => {
    const loadAgent = async () => {
      try {
        setAgentError("");
        const agentData = await getAgent(selectedAgent);
        if (agentData) {
          setAgentObj(agentData);
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

  // Handle sending a message
  const handleSendMessage = async (messageContent: string) => {
    setToolEvents([]); // Clear previous tool events
    if (!messageContent.trim()) return;

    try {
      const userId = embedUserId || user?.sub || "anonymous-user";
      const agentId = selectedAgent;
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

      // Merge assistant apps with user apps (user apps take precedence)
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };

      // Create the new message
      const newMessage: Message = {
        type: "human",
        content: messageContent,
      };

      // Submit using LangGraph's useStream
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
          max_tokens: 1024,
          top_p: 1.0,
          instructions: "Be helpful and concise.",
          apps: mergedApps,
            }
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
          }),
        }
      );

      setInput("");
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

  return (
    <div className="flex flex-col h-screen bg-background">
      <EmbedChatHeader
        agentName={agentObj?.name}
        onNewChat={handleNewChat}
        onShowHistory={() => setShowHistory(true)}
      />
      
      <div className="flex-1 overflow-hidden">
        <ChatMessages
          messages={streamingMessages.length > 0 ? streamingMessages : thread.messages}
          messagesEndRef={messagesEndRef}
          selectedAgent={selectedAgent}
          agents={agentObj ? [agentObj] : []}
          userColor={userColor}
          onSuggestionClick={handleSuggestionClick}
          suggestions={
            agentObj && agentObj.templates && agentObj.templates.length > 0
              ? agentObj.templates.map((t: any) =>
                  t.template_text || (t.attributes && t.attributes.template_text) || t.text || t
                )
              : undefined
          }
        />
      </div>
      
      <div className="border-t bg-background p-4">
        <ChatInput
          onSubmit={handleFormSubmit}
          isLoading={thread.isLoading}
          selectedAgent={selectedAgent}
          agentName={agentObj?.name}
          userColor={userColor}
        />
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
      />
    </div>
  );
}
