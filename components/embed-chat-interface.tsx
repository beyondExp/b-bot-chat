"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { ChatInput } from "./chat-input"
import { EnhancedChatMessages } from "./enhanced-chat-messages"
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
  const [waitingForEditResponse, setWaitingForEditResponse] = useState<{messageIndex: number, originalContent: string} | null>(null);
  const [branchRefreshKey, setBranchRefreshKey] = useState(0);

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

  // Save current session to chat history (only once per thread)
  const saveCurrentSession = useCallback(() => {
    const messages = streamingMessages.length > 0 ? streamingMessages : thread.messages;
    if (!messages || messages.length === 0) return;

    const userMessage = messages.find(msg => msg.type === 'human');
    const aiMessage = messages.find(msg => msg.type === 'ai');
    
    // Only save if we have both a user message and an AI response (complete exchange)
    if (!userMessage || !aiMessage) return;

    const userId = embedUserId || user?.sub;
    const threadId = ChatHistoryManager.getCurrentThreadId();
    
    if (!threadId) return;

    // Check if this thread already exists in chat history
    const existingSessions = ChatHistoryManager.getChatSessions();
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

    ChatHistoryManager.saveChatSession(session);
    setCurrentSession(session);
  }, [streamingMessages, thread.messages, currentSession, selectedAgent, embedUserId, user?.sub]);

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
    ChatHistoryManager.clearCurrentThreadId();
    setCurrentSession(null);
    setStreamingMessages([]);
    messageMetadataManager.clear(); // Clear all branch data
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

  // Convert LangGraph Messages to ChatMessages
  const convertMessages = (messages: Message[]): ChatMessage[] => {
    return messages.map((msg, idx) => ({
      id: msg.id || `msg-${idx}`,
      role: msg.type === "human" ? "user" as const : "assistant" as const,
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      type: msg.type === "human" ? "human" as const : "ai" as const
    }));
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
      setToolEvents([]);

      // Get the entity info for the request
      const userId = embedUserId || user?.sub || "anonymous-user";
      const agentId = selectedAgent;
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

      // Merge assistant apps with user apps
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };

      // Submit the conversation from edit point to regenerate AI response
      thread.submit(
        { 
          messages: langGraphMessages,
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
            messages: langGraphMessages,
            entity_id: entityId,
            user_id: userId,
            agent_id: agentId,
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
      setToolEvents([]);

      // Get the entity info for the request
      const userId = embedUserId || user?.sub || "anonymous-user";
      const agentId = selectedAgent;
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId;

      // Merge assistant apps with user apps
      const userApps = {};
      const assistantApps = agentObj?.rawData?.config?.apps || {};
      const mergedApps = { ...assistantApps, ...userApps };

      // Submit the conversation up to the regeneration point
      thread.submit(
        { 
          messages: langGraphMessages,
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
            messages: langGraphMessages,
            entity_id: entityId,
            user_id: userId,
            agent_id: agentId,
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
    <div className="flex flex-col h-screen bg-background" style={{ maxHeight: '100vh', overflow: 'hidden' }}>
      <EmbedChatHeader
        agentName={agentObj?.name}
        onNewChat={handleNewChat}
        onShowHistory={() => setShowHistory(true)}
      />
      
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <EnhancedChatMessages
            messages={useMemo(() => {
              // Always use the branch manager as the source of truth when it has data
              // It will return the base conversation if no branches exist
              const currentConversation = messageMetadataManager.getCurrentConversation();
              
              // If branch manager has content, use it (this includes both branched and non-branched conversations)
              if (currentConversation.length > 0) {
                return currentConversation;
              }
              
              // Fallback to streaming/thread messages only if branch manager is empty
              return convertMessages(streamingMessages.length > 0 ? streamingMessages : thread.messages);
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
            suggestions={
              agentObj && agentObj.templates && agentObj.templates.length > 0
                ? agentObj.templates.map((t: any) =>
                    t.template_text || (t.attributes && t.attributes.template_text) || t.text || t
                  )
                : undefined
            }
          />
        </div>
        
        <div className="border-t bg-background p-4 flex-shrink-0">
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
      />
    </div>
  );
}
