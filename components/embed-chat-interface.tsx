"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { useAuth0 } from "@auth0/auth0-react"
import { getAuthToken, isLocallyAuthenticated } from "@/lib/api"
import { LANGGRAPH_AUDIENCE } from "@/lib/api"
import { LangGraphService } from "@/lib/langgraph-service-sdk"
import { StreamingHandlerService } from "@/lib/streaming-handler-service"
import { useAgents } from "@/lib/agent-service"

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
  const [cachedAuthToken, setCachedAuthToken] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [incomingMessage, setIncomingMessage] = useState("")
  const [agentValid, setAgentValid] = useState<boolean>(false)
  const [agentError, setAgentError] = useState<string>("")
  const { getAgent } = useAgents()
  const [agentObj, setAgentObj] = useState<any>(null);

  // Debug log after state is defined
  console.log('[UI][render] messages:', messages, 'incomingMessage:', incomingMessage);

  const { isAuthenticated, getAccessTokenSilently, user } = useAuth0()

  // Create a new instance of LangGraphService
  const langGraphService = new LangGraphService()
  const streamingHandler = new StreamingHandlerService()

  const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY;

  // Helper to get headers for embed mode
  const getEmbedHeaders = (isStream = false) => {
    if (embedUserId && ADMIN_API_KEY) {
      return {
        "Admin-API-Key": ADMIN_API_KEY,
        "X-User-ID": embedUserId,
        "Content-Type": "application/json",
        "Accept": isStream ? "text/event-stream" : "application/json",
      };
    }
    return undefined;
  };

  // Initialize thread when component mounts
  useEffect(() => {
    // Allow B-Bot without authentication, but require auth for other agents
    const shouldCreateThread = (isAuthenticated || isLocallyAuthenticated() || selectedAgent === "b-bot" || embedUserId) && !threadId

    if (shouldCreateThread) {
      const initializeThread = async () => {
        try {
          const embedHeaders = getEmbedHeaders();
          if (embedHeaders) {
            console.log("[EmbedChatInterface] Sending headers for createThread:", embedHeaders);
          }
          const thread = await langGraphService.createThread({
            user_id: embedUserId || user?.sub || "anonymous-user",
            agent_id: selectedAgent,
          }, embedHeaders)
          setThreadId(thread.thread_id)
          console.log("Thread initialized with ID:", thread.thread_id)
        } catch (error) {
          console.error("Failed to initialize thread:", error)

          // Create a fallback thread ID for B-Bot if needed
          if (selectedAgent === "b-bot") {
            const fallbackThreadId = `bbot-anonymous-${Date.now()}`
            setThreadId(fallbackThreadId)
          }
        }
      }

      initializeThread()
    }
  }, [isAuthenticated, threadId, user?.sub, selectedAgent, embedUserId])

  // Fetch and cache the auth token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        // First check if we're authenticated through Auth0
        if (isAuthenticated) {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: LANGGRAPH_AUDIENCE,
            },
          })
          setCachedAuthToken(token)
          localStorage.setItem("auth_token", token)
          return
        }

        // If not authenticated through Auth0, check for local token
        if (isLocallyAuthenticated()) {
          const token = getAuthToken()
          if (token) {
            setCachedAuthToken(token)
            return
          }
        }
      } catch (error) {
        console.error("Error fetching auth token:", error)
      }
    }

    fetchToken()
  }, [isAuthenticated, getAccessTokenSilently])

  useEffect(() => {
    const checkAgent = async () => {
      console.log('[EmbedChatInterface] checkAgent: initialAgent =', initialAgent, 'selectedAgent =', selectedAgent)
      // Only skip fetch if this embed is for the built-in B-Bot (the default embed agent)
      // If initialAgent is undefined or 'bbot', treat as B-Bot embed
      if (!initialAgent || initialAgent === "bbot" || initialAgent === "b-bot") {
        console.log('[EmbedChatInterface] Skipping fetch for built-in B-Bot embed')
        setAgentValid(true)
        setAgentError("")
        return
      }
      try {
        const agent = await getAgent(selectedAgent || '', { allowAnonymous: true })
        if (agent && agent.metadata && agent.metadata.distributionChannel && agent.metadata.distributionChannel.type === "Embed") {
          setAgentValid(true)
          setAgentError("")
        } else {
          setAgentError("This assistant is not enabled for embed usage.")
          setAgentValid(false)
        }
      } catch (e) {
        setAgentError("Failed to load assistant or check embed permissions.")
        setAgentValid(false)
      }
    }
    checkAgent()
  }, [selectedAgent, getAgent, initialAgent])

  // Fetch agent object on mount
  useEffect(() => {
    const fetchAgent = async () => {
      if (!initialAgent || initialAgent === "bbot" || initialAgent === "b-bot") {
        setAgentObj({
          id: "bbot",
          name: "B-Bot",
          shortDescription: "Your personal AI assistant",
          description: "B-Bot is your personal AI assistant that can help with a wide range of tasks.",
          profileImage: "/helpful-robot.png",
          category: "General",
          publisherId: "beyond-official",
          abilities: [],
          apps: [],
          templates: [
            { text: "Hello! How can you help me?" },
            { text: "What can you do?" },
            { text: "Tell me about yourself" }
          ]
        });
        return;
      }
      try {
        const agent = await getAgent(selectedAgent || '', { allowAnonymous: true });
        setAgentObj(agent);
      } catch (e) {
        setAgentObj(null);
      }
    };
    fetchAgent();
  }, [selectedAgent, getAgent, initialAgent]);

  // --- Streaming message logic (like ChatInterface) ---
  const handleSendMessage = async (messageContent: string) => {
    if (!messageContent.trim()) return
    setIsLoading(true)

    // Create a temporary user message to show immediately
    const tempUserMessage = {
      id: `user-temp-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => {
      const newMessages = [...prev, tempUserMessage];
      console.log('[DEBUG][setMessages][tempUserMessage]', newMessages);
      return newMessages;
    });

    try {
      // Get the current thread ID or create a new one
      let currentThreadId = threadId
      if (!currentThreadId) {
        const embedHeaders = getEmbedHeaders();
        if (embedHeaders) {
          console.log("[EmbedChatInterface] Sending headers for createThread:", embedHeaders);
        }
        const thread = await langGraphService.createThread({
          user_id: embedUserId || user?.sub || "anonymous-user",
          agent_id: selectedAgent,
        }, embedHeaders)
        currentThreadId = thread.thread_id
        setThreadId(currentThreadId)
      }

      // Add the message to the thread
      if (currentThreadId) {
        const embedHeaders = getEmbedHeaders();
        if (embedHeaders) {
          console.log("[EmbedChatInterface] Sending headers for addThreadMessage:", embedHeaders);
        }
        await langGraphService.addThreadMessage(currentThreadId, {
          role: "user",
          content: messageContent,
        }, embedHeaders)
      }

      const userId = embedUserId || user?.sub || "anonymous-user"
      const agentId = selectedAgent

      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId

      // Prepare the configuration for the stream
      const streamConfig = {
        input: {
          entity_id: entityId,
          messages: [{ role: "user", content: messageContent }],
        },
        config: {
          thread_id: currentThreadId,
          agent_id: agentId,
          user_id: userId,
          conversation_history: messages,
          temperature: 0.7,
          max_tokens: 1024,
          top_p: 1.0,
          instructions: "Be helpful and concise.",
        },
      }

      // Invoke the streaming graph
      const embedHeaders = getEmbedHeaders(true);
      if (embedHeaders) {
        console.log("[EmbedChatInterface] Sending headers for invokeGraphStream:", embedHeaders);
      }
      if (!currentThreadId) {
        throw new Error("No thread ID available for streaming");
      }
      const response = await langGraphService.invokeGraphStream(selectedAgent, currentThreadId, streamConfig, embedHeaders)

      // Process the streaming response
      console.log('[UI][processStream] About to call streamingHandler.processStream with callbacks:', {
        onMessage: (msgObj: any) => {
          console.log('[UI][onMessage] incomingMessage:', msgObj);
          setIncomingMessage((prev) => {
            console.log('[DEBUG][setIncomingMessage][onMessage]', msgObj.content);
            return msgObj.content;
          });
        },
        onUpdate: (messagesArr: any[]) => {
          console.log('[UI][onUpdate] messagesArr:', messagesArr);
          if (messagesArr && messagesArr.length > 0) {
            messagesArr.forEach((msg: any, idx: number) => {
              console.log(`[UI][onUpdate][message ${idx}] id: ${msg.id}, type: ${msg.type}, role: ${msg.role}, content: ${msg.content}`);
            });
            const mappedMessages = messagesArr.map((msg: any, idx: number) => ({
              id: msg.id || msg.run_id || `msg-${idx}-${Date.now()}`,
              role: msg.type === "ai"
                ? "assistant"
                : msg.type === "human"
                  ? "user"
                  : msg.role || "user",
              content: msg.content || "",
              timestamp: new Date().toISOString(),
            }));
            console.log('[DEBUG][setMessages][onUpdate]', mappedMessages);
            console.log('[DEBUG][mappedMessages][embed chat]', mappedMessages);
            setMessages(mappedMessages); // Replace the entire array
          }
          console.log('[DEBUG][setIncomingMessage][onUpdate] clear incomingMessage');
          setIncomingMessage(""); // Always clear
          setIsLoading(false)
          scrollToBottom()
        },
        onError: (err: any) => {
          setIsLoading(false)
          alert(`Error: ${err}`)
        },
        onScrollDown: scrollToBottom,
        onSetLoading: setIsLoading,
        onInterrupt: () => {},
      });
      await streamingHandler.processStream(response, {
        onMessage: (msgObj: any) => {
          console.log('[UI][onMessage] incomingMessage:', msgObj);
          setIncomingMessage((prev) => {
            console.log('[DEBUG][setIncomingMessage][onMessage]', msgObj.content);
            return msgObj.content;
          });
        },
        onUpdate: (messagesArr: any[]) => {
          console.log('[UI][onUpdate] messagesArr:', messagesArr);
          if (messagesArr && messagesArr.length > 0) {
            messagesArr.forEach((msg: any, idx: number) => {
              console.log(`[UI][onUpdate][message ${idx}] id: ${msg.id}, type: ${msg.type}, role: ${msg.role}, content: ${msg.content}`);
            });
            const mappedMessages = messagesArr.map((msg: any, idx: number) => ({
              id: msg.id || msg.run_id || `msg-${idx}-${Date.now()}`,
              role: msg.type === "ai"
                ? "assistant"
                : msg.type === "human"
                  ? "user"
                  : msg.role || "user",
              content: msg.content || "",
              timestamp: new Date().toISOString(),
            }));
            console.log('[DEBUG][setMessages][onUpdate]', mappedMessages);
            console.log('[DEBUG][mappedMessages][embed chat]', mappedMessages);
            setMessages(mappedMessages); // Replace the entire array
          }
          console.log('[DEBUG][setIncomingMessage][onUpdate] clear incomingMessage');
          setIncomingMessage(""); // Always clear
          setIsLoading(false)
          scrollToBottom()
        },
        onError: (err: any) => {
          setIsLoading(false)
          alert(`Error: ${err}`)
        },
        onScrollDown: scrollToBottom,
        onSetLoading: setIsLoading,
        onInterrupt: () => {},
      })
    } catch (error) {
      console.error("Error in handleSendMessage:", error)
    }
  }

  // Function to estimate token usage (simplified)
  const estimateTokenUsage = (text: string): number => {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
    console.log('[DEBUG][useEffect][messages/incomingMessage]', { messages, incomingMessage });
  }, [messages, incomingMessage])

  // Simplified message submission handler
  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>, msg: string) => {
    e.preventDefault()
    handleSendMessage(msg)
    setInput("")
  }

  // Add a class to the body to indicate this is an embedded view
  useEffect(() => {
    document.body.classList.add("embedded-chat")
    return () => {
      document.body.classList.remove("embedded-chat")
    }
  }, [])

  // Add debug log for ChatMessages props before return
  const debugChatMessagesProps = { messages, incomingMessage };
  console.log('[DEBUG][render][ChatMessages props]', debugChatMessagesProps);

  return (
    <div className="embed-container flex flex-col h-screen">
      {!agentValid ? (
        <div className="flex items-center justify-center h-screen text-red-500">
          {agentError || "Checking assistant permissions..."}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="chat-container">
            <ChatMessages
              messages={messages}
              messagesEndRef={messagesEndRef}
              selectedAgent={selectedAgent}
              agents={agentObj ? [agentObj] : []}
              incomingMessage={incomingMessage}
              suggestions={
                agentObj && agentObj.templates && agentObj.templates.length > 0
                  ? agentObj.templates.map((t: any) =>
                      t.template_text || (t.attributes && t.attributes.template_text) || t.text || t
                    )
                  : undefined
              }
              onSuggestionClick={(suggestion) => {
                setInput(suggestion)
                setTimeout(() => {
                  handleSendMessage(suggestion)
                }, 100)
              }}
            />
            <ChatInput
              onSubmit={handleMessageSubmit}
              isLoading={isLoading}
              selectedAgent={selectedAgent}
              agentName={agentObj?.name}
            />
          </div>
        </div>
      )}
    </div>
  )
}
