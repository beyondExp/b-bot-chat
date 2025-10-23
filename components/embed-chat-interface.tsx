"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { ChatInput } from "./chat-input"
import { EnhancedChatMessages } from "./enhanced-chat-messages"
// Temporarily remove tool response handling to avoid type conflicts  
// import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses"
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
import { messageMetadataManager, type ChatMessage, type MessageMetadata } from "@/lib/message-metadata"

interface EmbedChatInterfaceProps {
  initialAgent?: string
  embedUserId?: string | null
  embedId?: string
}

export function EmbedChatInterface({ initialAgent, embedUserId, embedId }: EmbedChatInterfaceProps) {
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
  const [showHistory, setShowHistory] = useState(false);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [waitingForEditResponse, setWaitingForEditResponse] = useState<{messageIndex: number, originalContent: string} | null>(null);
  const [branchRefreshKey, setBranchRefreshKey] = useState(0);

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
        entity_id: userId.replace(/[|\-]/g, '') + '_' + agentId,
        distributionChannel: {
          type: "Embed"
        }
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
    return currentSession?.threadId || ChatHistoryManager.getCurrentThreadId(embedId);
  };

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
      
      setAgentError(errorMessage || "An error occurred");
    },
    onFinish: () => {
      console.log("Stream finished");
      scrollToBottom();
      saveCurrentSession();
    },
    onThreadId: async (threadId: string) => {
      console.log("Thread ID received:", threadId);
      ChatHistoryManager.setCurrentThreadId(threadId, embedId);
      
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
  const saveCurrentSession = useCallback(() => {
    const messages = streamingMessages.length > 0 ? streamingMessages : thread.messages;
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
  }, [streamingMessages, thread.messages, currentSession, selectedAgent, embedUserId, user?.sub, embedId]);

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
    setStreamingMessages([]);
    messageMetadataManager.clear(); // Clear all branch data
    // The thread will automatically create a new thread ID on next message
    window.location.reload(); // Simple way to reset the chat state
  };

  // Select a chat from history
  const handleSelectChat = (session: ChatSession) => {
    setCurrentSession(session);
    ChatHistoryManager.setCurrentThreadId(session.threadId, embedId);
    // Reload to load the selected thread
    window.location.reload();
  };

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // Find the scrollable chat container
      const chatContainer = messagesEndRef.current.closest('.chat-messages');
      if (chatContainer) {
        // Scroll the chat container to the bottom instead of using scrollIntoView
        chatContainer.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        // Fallback to the element's scrollIntoView but with block: 'nearest' to prevent page scrolling
        messagesEndRef.current.scrollIntoView({ 
          behavior: "smooth", 
          block: "nearest",
          inline: "nearest" 
        });
      }
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [streamingMessages, thread.messages]);

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
        const agentData = await getAgent(selectedAgent, { allowAnonymous: true });
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

    try {
      const userId = embedUserId || user?.sub || "anonymous-user";
      const agentId = selectedAgent;
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

      // Merge assistant apps with user apps (user apps take precedence)
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };
      
      // Add manual blacklist to apps if in Embed mode (in addition to automatic blacklisting)
      // This allows for custom blacklist overrides per app
      // Example: mergedApps["knowledge_companyinfoludemedia"].blacklist = ["edit_line_knowledge_companyinfoludemedia"]
      // Note: Automatic blacklisting for Embed mode is already handled by the backend

      // Create the new message
      const newMessage: Message = {
        type: "human",
        content: messageContent,
      };

      // Get expert_id from assistant metadata if available
      const expertId = agentObj?.metadata?.expert_id;

      // Submit using LangGraph's useStream
      thread.submit(
        { 
          messages: [newMessage],
          entity_id: entityId,  // Required in main payload for LangGraph
          user_id: userId,      // Also add these for compatibility
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
              distribution_channel: { type: "Embed" }, // Pass to backend for security filtering
            }
          },
          streamMode: ["messages", "updates"], // Use messages/updates for proper event streaming like B-Bot Hub
          metadata: {
            expert_id: expertId,
            user_id: userId,
            agent_id: agentId,
            assistant_id: agentId,
            entity_id: entityId,
            distributionChannel: {
              type: "Embed"
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
            expert_id: expertId,
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

  // Convert messages from LangGraph format to ChatMessage format
  const convertMessages = (messages: Message[]): ChatMessage[] => {
    const isAnonymousUser = !embedUserId && !user?.sub;
    
    return messages
      .filter(msg => {
        // Filter out empty AI messages that only contain tool_calls (trigger messages)
        if (msg.type === "ai" && (!msg.content || (msg.content as string).trim() === "") && (msg as any).tool_calls && (msg as any).tool_calls.length > 0) {
          console.log("🚫 [convertMessages] Filtering out empty AI message with tool_calls:", msg.id);
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
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

      // Get expert_id from assistant metadata if available
      const expertId = agentObj?.metadata?.expert_id;

      // Merge assistant apps with user apps
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };

      // Submit the conversation from edit point to regenerate AI response
      thread.submit(
        { 
          messages: langGraphMessages,
          entity_id: entityId,  // Required in main payload for LangGraph
          user_id: userId,      // Also add these for compatibility
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
              distribution_channel: { type: "Embed" }, // Pass to backend for security filtering
            }
          },
          metadata: {
            expert_id: expertId,
            user_id: userId,
            agent_id: agentId,
            assistant_id: agentId,
            entity_id: entityId,
            distributionChannel: {
              type: "Embed"
            }
          },
          optimisticValues: (prev) => ({
            ...prev,
            messages: langGraphMessages,
            entity_id: entityId,
            user_id: userId,
            agent_id: agentId,
            expert_id: expertId,
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
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

      // Get expert_id from assistant metadata if available
      const expertId = agentObj?.metadata?.expert_id;

      // Merge assistant apps with user apps
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };

      // Submit the conversation up to the regeneration point
      thread.submit(
        { 
          messages: langGraphMessages,
          entity_id: entityId,  // Required in main payload for LangGraph
          user_id: userId,      // Also add these for compatibility
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
              distribution_channel: { type: "Embed" }, // Pass to backend for security filtering
            }
          },
          metadata: {
            expert_id: expertId,
            user_id: userId,
            agent_id: agentId,
            assistant_id: agentId,
            entity_id: entityId,
            distributionChannel: {
              type: "Embed"
            }
          },
          optimisticValues: (prev) => ({
            ...prev,
            messages: langGraphMessages,
            entity_id: entityId,
            user_id: userId,
            agent_id: agentId,
            expert_id: expertId,
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

  return (
    <div className="flex flex-col h-screen bg-background embedded-chat">
      <EmbedChatHeader
        agentName={agentObj?.name}
        onNewChat={handleNewChat}
        onShowHistory={() => setShowHistory(true)}
        userColor={userColor}
      />
      
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <EnhancedChatMessages
            messages={useMemo(() => {
              // Always use the branch manager as the source of truth when it has data
              const currentConversation = messageMetadataManager.getCurrentConversation();
              
              // If branch manager has content, use it
              if (currentConversation.length > 0) {
                console.log("📋 Using branch manager conversation:", currentConversation.length, "messages");
                return currentConversation;
              }
              
              // Fallback to streaming/thread messages
              const rawMessages = streamingMessages.length > 0 ? streamingMessages : thread.messages;
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
              
              return convertedMessages;
            }, [streamingMessages, thread.messages, branchRefreshKey])}
              messagesEndRef={messagesEndRef}
              selectedAgent={selectedAgent}
              agents={agentObj ? [agentObj] : []}
            userColor={userColor}
            isLoading={thread.isLoading}
            onSuggestionClick={handleSuggestionClick}
            onMessageEdit={handleMessageEdit}
            onMessageRegenerate={handleMessageRegenerate}
            onBranchSelect={handleBranchSelect}
            getMessageMetadata={getMessageMetadata}
            toolEvents={toolEvents}
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
