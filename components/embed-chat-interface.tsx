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

interface EmbedChatInterfaceProps {
  initialAgent?: string
}

export function EmbedChatInterface({ initialAgent }: EmbedChatInterfaceProps) {
  // Use the initialAgent or default to "b-bot"
  const [selectedAgent] = useState<string>(initialAgent ?? "bbot")
  const [tokensUsed, setTokensUsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const [cachedAuthToken, setCachedAuthToken] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [incomingMessage, setIncomingMessage] = useState("")

  const { isAuthenticated, getAccessTokenSilently, user } = useAuth0()

  // Create a new instance of LangGraphService
  const langGraphService = new LangGraphService()
  const streamingHandler = new StreamingHandlerService()

  // Initialize thread when component mounts
  useEffect(() => {
    // Allow B-Bot without authentication, but require auth for other agents
    const shouldCreateThread = (isAuthenticated || isLocallyAuthenticated() || selectedAgent === "b-bot") && !threadId

    if (shouldCreateThread) {
      const initializeThread = async () => {
        try {
          const thread = await langGraphService.createThread({
            user_id: user?.sub || "anonymous-user",
            agent_id: selectedAgent,
          })
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
  }, [isAuthenticated, threadId, user?.sub, selectedAgent])

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
    setMessages((prev) => [...prev, tempUserMessage])

    try {
      // Get the current thread ID or create a new one
      let currentThreadId = threadId
      if (!currentThreadId) {
        const thread = await langGraphService.createThread({
          user_id: user?.sub || "anonymous-user",
          agent_id: selectedAgent,
        })
        currentThreadId = thread.thread_id
        setThreadId(currentThreadId)
      }

      // Add the message to the thread
      if (currentThreadId) {
        await langGraphService.addThreadMessage(currentThreadId, {
          role: "user",
          content: messageContent,
        })
      }

      const userId = user?.sub || "anonymous-user"
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
      const response = await langGraphService.invokeGraphStream(selectedAgent, currentThreadId, streamConfig)

      // Process the streaming response
      await streamingHandler.processStream(response, {
        onMessage: (msg) => {
          setIncomingMessage(msg)
        },
        onUpdate: (messagesArr) => {
          if (messagesArr && messagesArr.length > 0) {
            const mappedMessages = messagesArr.map((msg: any, idx: number) => ({
              id: msg.id || `msg-${idx}-${Date.now()}`,
              role: msg.type === "human" || msg.role === "user" ? "user" : "assistant",
              content: msg.content || "",
              timestamp: new Date().toISOString(),
            }))
            setMessages(mappedMessages)
          }
          setIsLoading(false)
          setIncomingMessage("")
          scrollToBottom()
        },
        onError: (err) => {
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

  // Minimal agents array for B-Bot
  const agents = [
    {
      id: "bbot",
      name: "B-Bot",
      shortDescription: "Your personal AI assistant",
      description: "B-Bot is your personal AI assistant that can help with a wide range of tasks.",
      profileImage: "/helpful-robot.png",
      category: "General",
      publisherId: "beyond-official",
      abilities: [],
      apps: [],
    },
  ];

  return (
    <div className="embed-container flex flex-col h-screen">
      <div className="flex-1 overflow-auto">
        <div className="chat-container">
          <ChatMessages
            messages={messages}
            messagesEndRef={messagesEndRef}
            selectedAgent={selectedAgent}
            agents={agents}
            incomingMessage={incomingMessage}
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
          />
        </div>
      </div>
    </div>
  )
}
