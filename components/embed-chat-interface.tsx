"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { useChat } from "@ai-sdk/react"
import { useAuth0 } from "@auth0/auth0-react"
import { getAuthToken, isLocallyAuthenticated } from "@/lib/api"
import { LANGGRAPH_AUDIENCE } from "@/lib/api"
import { LangGraphService } from "@/lib/langgraph-service-sdk"

interface EmbedChatInterfaceProps {
  initialAgent?: string | null
}

export function EmbedChatInterface({ initialAgent }: EmbedChatInterfaceProps) {
  // Use the initialAgent or default to "b-bot"
  const [selectedAgent] = useState<string | null>(initialAgent || "bbot")
  const [tokensUsed, setTokensUsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [cachedAuthToken, setCachedAuthToken] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)

  const { isAuthenticated, getAccessTokenSilently, user } = useAuth0()

  // Create a new instance of LangGraphService
  const langGraphService = new LangGraphService()

  // Initialize thread when component mounts
  useEffect(() => {
    // Allow B-Bot without authentication, but require auth for other agents
    const shouldCreateThread = (isAuthenticated || isLocallyAuthenticated() || selectedAgent === "b-bot") && !threadId

    if (shouldCreateThread) {
      const initializeThread = async () => {
        try {
          const thread = await langGraphService.createThread({
            user_id: user?.sub || "anonymous-user",
            agent_id: selectedAgent || "bbot",
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

  // Custom fetch function for chat
  const customFetch = useCallback(
    async (url: string, options: RequestInit) => {
      try {
        // Parse the request body to get the messages
        let bodyObj: any = {}
        if (options.body && typeof options.body === "string") {
          try {
            bodyObj = JSON.parse(options.body)
          } catch (e) {
            console.error("Error parsing request body:", e)
            bodyObj = { messages: [] }
          }
        }

        // Ensure we have a valid messages array
        if (!bodyObj.messages) {
          bodyObj.messages = []
        } else if (!Array.isArray(bodyObj.messages)) {
          bodyObj.messages = []
        }

        // Get the latest user message
        const latestMessage = bodyObj.messages.length > 0 ? bodyObj.messages[bodyObj.messages.length - 1] : null

        if (!latestMessage) {
          throw new Error("No message to send")
        }

        // If we have a threadId, use the LangGraphService to handle the chat
        if (threadId) {
          // Add the message to the thread
          await langGraphService.addThreadMessage(threadId, {
            role: "user",
            content: latestMessage.content || "",
            isBBotThread: selectedAgent === "b-bot",
          })

          // Run the thread with the selected agent
          const response = await langGraphService.runThread(threadId, selectedAgent || "bbot", {
            messages: [latestMessage.content || ""],
          })

          // Create a Response object to return
          const responseData = response.response || {
            role: "assistant",
            content: "I'm sorry, I couldn't process your request.",
            id: `msg-${Date.now()}`,
            created_at: new Date().toISOString(),
          }

          // Create a stream from the response
          const stream = new ReadableStream({
            start(controller) {
              // Add the response to the stream
              controller.enqueue(JSON.stringify(responseData))
              controller.close()
            },
          })

          // Return the stream as a Response
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          })
        }

        // If no threadId, create a new thread and handle the chat
        try {
          // Create a new thread
          const thread = await langGraphService.createThread({
            user_id: user?.sub || "anonymous-user",
            agent_id: selectedAgent || "bbot",
          })

          // Set the threadId for future use
          setThreadId(thread.thread_id)

          // Add the message to the thread
          await langGraphService.addThreadMessage(thread.thread_id, {
            role: "user",
            content: latestMessage.content || "",
            isBBotThread: selectedAgent === "b-bot",
          })

          // Run the thread with the selected agent
          const response = await langGraphService.runThread(thread.thread_id, selectedAgent || "bbot", {
            messages: [latestMessage.content || ""],
          })

          // Create a Response object to return
          const responseData = response.response || {
            role: "assistant",
            content: "I'm sorry, I couldn't process your request.",
            id: `msg-${Date.now()}`,
            created_at: new Date().toISOString(),
          }

          // Create a stream from the response
          const stream = new ReadableStream({
            start(controller) {
              // Add the response to the stream
              controller.enqueue(JSON.stringify(responseData))
              controller.close()
            },
          })

          // Return the stream as a Response
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          })
        } catch (error) {
          console.error("Error creating thread and handling chat:", error)
          return fetch(url, options)
        }
      } catch (error) {
        console.error("Error in customFetch:", error)

        // Create a fallback response
        const fallbackResponse = {
          role: "assistant",
          content: "I'm sorry, I encountered an error processing your request. Please try again.",
          id: `msg-${Date.now()}`,
          created_at: new Date().toISOString(),
        }

        // Create a stream from the fallback response
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(JSON.stringify(fallbackResponse))
            controller.close()
          },
        })

        // Return the stream as a Response
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }
    },
    [threadId, selectedAgent, user?.sub],
  )

  // Set up chat with AI SDK
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/chat",
    body: {
      agent: selectedAgent || "bbot",
      threadId: threadId,
      token: cachedAuthToken,
      synapseToken: cachedAuthToken,
      isAnonymous: !isAuthenticated && selectedAgent === "b-bot",
      messages: [],
    },
    id: selectedAgent || "b-bot",
    onFinish: (message) => {
      scrollToBottom()
      // Estimate token usage
      const newTokens = estimateTokenUsage(message.content)
      setTokensUsed((prev) => prev + newTokens)
    },
    fetcher: customFetch,
  })

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
  }, [messages])

  // Simplified message submission handler
  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e)
  }

  // Add a class to the body to indicate this is an embedded view
  useEffect(() => {
    document.body.classList.add("embedded-chat")
    return () => {
      document.body.classList.remove("embedded-chat")
    }
  }, [])

  return (
    <div className="embed-container flex flex-col h-screen">
      <div className="flex-1 overflow-auto">
        <div className="chat-container">
          <ChatMessages
            messages={messages}
            messagesEndRef={messagesEndRef}
            selectedAgent={selectedAgent}
            onSuggestionClick={(suggestion) => {
              const fakeEvent = {
                preventDefault: () => {},
              } as unknown as React.FormEvent<HTMLFormElement>

              handleInputChange({
                target: { value: suggestion },
              } as React.ChangeEvent<HTMLTextAreaElement>)

              setTimeout(() => {
                handleSubmit(fakeEvent)
              }, 100)
            }}
          />
          <ChatInput
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={handleMessageSubmit}
            isLoading={isLoading}
            selectedAgent={selectedAgent}
          />
        </div>
      </div>
    </div>
  )
}
