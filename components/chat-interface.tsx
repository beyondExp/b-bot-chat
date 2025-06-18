"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { ChatHeader } from "./chat-header"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { AgentSelector } from "./agent-selector"
import { DiscoverPage } from "./discover-page"
import { calculateTokenCost } from "@/lib/stripe"
import { PaymentRequiredModal } from "./payment-required-modal"
import { AutoRechargeNotification } from "./auto-recharge-notification"
import { useAgents } from "@/lib/agent-service"
import { useAuth0 } from "@auth0/auth0-react"
import { useAuthenticatedFetch, getAuthToken, isLocallyAuthenticated } from "@/lib/api"

// Import the LANGGRAPH_AUDIENCE constant
import { LANGGRAPH_AUDIENCE } from "@/lib/api"
// Add these imports at the top of the file
import { useStream } from "@langchain/langgraph-sdk/react"
import type { Message } from "@langchain/langgraph-sdk"

interface ChatInterfaceProps {
  initialAgent?: string | null
}

export function ChatInterface({ initialAgent }: ChatInterfaceProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(initialAgent || "bbot")
  const [tokensUsed, setTokensUsed] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAutoRechargeNotification, setShowAutoRechargeNotification] = useState(false)
  const [autoRechargeAmount, setAutoRechargeAmount] = useState(0)
  const [remainingCredits, setRemainingCredits] = useState(0)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcription, setTranscription] = useState<string>("")
  const [agents, setAgents] = useState<any[]>([])

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [toolEvents, setToolEvents] = useState<any[]>([]);

  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0()
  const { getAgents, getAgent, isLoading: agentsLoading, error: agentsError } = useAgents()

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agentList = await getAgents();
        setAgents(agentList);
        } catch (error) {
        console.error("Error loading agents:", error);
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

  // Get the headers including the Admin-API-Key
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

    // For B-Bot without authentication - use admin API key if available
    const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY;
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
    const userId = user?.sub || "anonymous-user";
    const agentId = selectedAgent || "bbot";
    return userId.replace(/[|\-]/g, '') + '_' + agentId;
  };

  // Initialize the useStream hook - proxy handles authentication
  const thread = useStream<{ messages: Message[]; entity_id?: string; user_id?: string; agent_id?: string }>({
    apiUrl: getApiUrl(),
    apiKey: undefined, // Proxy handles authentication
    assistantId: getAssistantId(), // Only set if valid UUID, otherwise use default
    messagesKey: "messages",
    onError: (error: unknown) => {
      console.error("Stream error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Chat error:", errorMessage);
    },
    onFinish: () => {
      console.log("Stream finished");
      scrollToBottom();
    },
  });

  // Debug logging for thread state changes
  useEffect(() => {
    console.log("[Chat] Thread state changed:", {
      messagesLength: thread.messages?.length || 0,
      isLoading: thread.isLoading,
      values: thread.values,
      firstMessage: thread.messages?.[0],
      lastMessage: thread.messages?.[thread.messages.length - 1]
    });
  }, [thread.messages, thread.isLoading, thread.values]);

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

  const authenticatedFetch = useAuthenticatedFetch()

  const handleTranscriptionComplete = (transcriptionText: string) => {
    setTranscription(transcriptionText)
    setIsTranscribing(false)
    // Auto-send the transcription
    handleSendMessage(transcriptionText)
  }

  if (!selectedAgent) {
    return (
      <DiscoverPage
        agents={agents}
        loading={agentsLoading}
        error={agentsError}
        onAgentSelect={setSelectedAgent}
      />
    )
  }

  return (
    <>
      <div className="flex flex-col h-screen bg-background">
        <ChatHeader
          selectedAgent={selectedAgent}
          agents={agents}
          onAgentChange={setSelectedAgent}
          tokensUsed={tokensUsed}
          remainingCredits={remainingCredits}
        />

        <div className="flex-1 overflow-hidden">
              <ChatMessages
            messages={thread.messages}
                messagesEndRef={messagesEndRef}
                selectedAgent={selectedAgent}
                agents={agents}
            onSuggestionClick={handleSuggestionClick}
            suggestions={
              agents.find((a: any) => a.id === selectedAgent)?.templates?.map((t: any) =>
                t.template_text || (t.attributes && t.attributes.template_text) || t.text || t
              )
            }
          />
        </div>

        <div className="border-t bg-background p-4">
              <ChatInput
            onSubmit={handleFormSubmit}
            isLoading={thread.isLoading}
                selectedAgent={selectedAgent}
            agentName={agents.find((a: any) => a.id === selectedAgent)?.name}
              />
            </div>
      </div>

        <PaymentRequiredModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        requiredCredits={calculateTokenCost(tokensUsed)}
      />

      <AutoRechargeNotification
        isOpen={showAutoRechargeNotification}
        onClose={() => setShowAutoRechargeNotification(false)}
        amount={autoRechargeAmount}
      />
    </>
  )
}
