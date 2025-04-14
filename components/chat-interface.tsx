"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { ChatHeader } from "./chat-header"
import { ChatInput } from "./chat-input"
import { ChatMessages } from "./chat-messages"
import { AgentSelector } from "./agent-selector"
import { DiscoverPage } from "./discover-page"
import { useChat } from "@ai-sdk/react"
import { calculateTokenCost } from "@/lib/stripe"
import { PaymentRequiredModal } from "./payment-required-modal"
import { AutoRechargeNotification } from "./auto-recharge-notification"
import { useAgents } from "@/lib/agent-service"
import { useAuth0 } from "@auth0/auth0-react"
import { useAuthenticatedFetch, getAuthToken, isLocallyAuthenticated } from "@/lib/api"

// Import the LANGGRAPH_AUDIENCE constant
import { LANGGRAPH_AUDIENCE } from "@/lib/api"

// Add these imports at the top of the file
import { useLangGraphService } from "@/lib/langgraph-service"
// Add this import at the top of the file
import { LangGraphService } from "@/lib/langgraph-service-sdk"

export function ChatInterface() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
  const [recentAgents, setRecentAgents] = useState<string[]>([])
  const [tokensUsed, setTokensUsed] = useState(0)
  const [balance, setBalance] = useState(1000) // $10.00 initial balance for demo
  const [showPaymentRequired, setShowPaymentRequired] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [cachedAuthToken, setCachedAuthToken] = useState<string | null>(null)

  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false)
  const [rechargeThreshold, setRechargeThreshold] = useState(200) // $2.00
  const [rechargeAmount, setRechargeAmount] = useState(2000) // $20.00
  const [showAutoRechargeNotification, setShowAutoRechargeNotification] = useState(false)

  const { isAuthenticated, getAccessTokenSilently, user, loginWithRedirect } = useAuth0()
  const { getAgent } = useAgents()
  const authenticatedFetch = useAuthenticatedFetch()

  // Add this to the ChatInterface component, after the existing state declarations
  const [threadId, setThreadId] = useState<string | null>(null)
  const { createThread, runThread, addThreadMessage } = useLangGraphService()

  // Replace the existing useLangGraphService hook with this:
  // Create a new instance of LangGraphService
  const langGraphService = new LangGraphService()

  // Add this effect to create a thread when the component mounts
  useEffect(() => {
    // Allow B-Bot without authentication, but require auth for other agents
    const shouldCreateThread = (isAuthenticated || isLocallyAuthenticated() || selectedAgent === "b-bot") && !threadId

    if (shouldCreateThread) {
      const initializeThread = async () => {
        try {
          // Default to b-bot if no agent is selected
          const thread = await langGraphService.createThread({
            user_id: user?.sub || "anonymous-user",
            agent_id: selectedAgent || "b-bot",
          })
          setThreadId(thread.thread_id)
          console.log("Thread initialized with ID:", thread.thread_id)
        } catch (error) {
          console.error("Failed to initialize thread:", error)
        }
      }

      initializeThread()
    }
  }, [isAuthenticated, threadId, user?.sub, selectedAgent])

  // Load recent agents from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRecentAgents = localStorage.getItem("recentAgents")
      if (savedRecentAgents) {
        try {
          setRecentAgents(JSON.parse(savedRecentAgents))
        } catch (e) {
          console.error("Error parsing recent agents from localStorage:", e)
        }
      }
    }
  }, [])

  // Save recent agents to localStorage when they change
  useEffect(() => {
    if (typeof window !== "undefined" && recentAgents.length > 0) {
      localStorage.setItem("recentAgents", JSON.stringify(recentAgents))
    }
  }, [recentAgents])

  // Fetch and cache the auth token when the component mounts
  useEffect(() => {
    const fetchToken = async () => {
      try {
        // First check if we're authenticated through Auth0
        if (isAuthenticated) {
          console.log("Fetching token with audience:", LANGGRAPH_AUDIENCE)
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: LANGGRAPH_AUDIENCE,
            },
          })
          setCachedAuthToken(token)
          localStorage.setItem("auth_token", token)
          console.log("Cached auth token on mount:", token.substring(0, 15) + "...")
          return
        }

        // If not authenticated through Auth0, check for local token
        if (isLocallyAuthenticated()) {
          const token = getAuthToken()
          if (token) {
            console.log("Using locally stored token:", token.substring(0, 15) + "...")
            setCachedAuthToken(token)
            return
          }
        }

        console.log("No authentication source available")
      } catch (error) {
        console.error("Error fetching auth token on mount:", error)
      }
    }

    fetchToken()
  }, [isAuthenticated, getAccessTokenSilently])

  // Add this function to get the current authentication token
  const getAuthTokenForRequest = useCallback(async () => {
    try {
      // If we have a cached token, use it
      if (cachedAuthToken) {
        console.log("Using cached auth token:", cachedAuthToken.substring(0, 15) + "...")
        return cachedAuthToken
      }

      // Try to get token from localStorage
      const storedToken = getAuthToken()
      if (storedToken) {
        console.log("Using token from localStorage:", storedToken.substring(0, 15) + "...")
        setCachedAuthToken(storedToken)
        return storedToken
      }

      // If not found in localStorage and authenticated, get it from Auth0
      if (isAuthenticated) {
        console.log("Getting fresh token with audience:", LANGGRAPH_AUDIENCE)
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: LANGGRAPH_AUDIENCE,
          },
        })

        console.log("Got fresh token:", token.substring(0, 15) + "...")
        setCachedAuthToken(token)
        localStorage.setItem("auth_token", token)
        return token
      }

      console.log("No authentication method available")
      return null
    } catch (error) {
      console.error("Error getting auth token:", error)
      return null
    }
  }, [getAccessTokenSilently, cachedAuthToken, isAuthenticated])

  // Update the handleSelectAgent function to create a new thread when switching agents
  const handleSelectAgent = (agentId: string | null) => {
    // Only allow selecting non-B-Bot agents if authenticated
    if (agentId !== "b-bot" && !(isAuthenticated || isLocallyAuthenticated())) {
      // Show login prompt
      if (
        typeof window !== "undefined" &&
        window.confirm("You need to sign in to chat with this agent. Would you like to sign in now?")
      ) {
        loginWithRedirect()
      }
      return
    }

    // Only update if the agent is actually changing
    if (agentId !== selectedAgent) {
      setSelectedAgent(agentId)

      // Create a new thread for the new agent
      if ((isAuthenticated || isLocallyAuthenticated() || agentId === "b-bot") && agentId) {
        const initializeNewThread = async () => {
          try {
            console.log(`Initializing new thread for agent: ${agentId}`)
            const thread = await langGraphService.createThread({
              user_id: user?.sub || "anonymous-user",
              agent_id: agentId,
            })
            setThreadId(thread.thread_id)
            console.log("New thread initialized for agent:", agentId, "Thread ID:", thread.thread_id)

            // Clear messages when switching agents
            setMessages([])
          } catch (error) {
            console.error("Failed to initialize thread for new agent:", error)

            // If this is B-Bot, create a fallback thread
            if (agentId === "b-bot") {
              console.log("Creating fallback thread for B-Bot")
              const fallbackThreadId = `bbot-anonymous-${Date.now()}`
              setThreadId(fallbackThreadId)

              // Clear messages when switching agents
              setMessages([])
            } else {
              // For other agents, show an error message
              alert("Failed to initialize chat with this agent. Please try again later.")
            }
          }
        }

        initializeNewThread()
      }

      // Add to recent agents if not already there
      if (agentId && !recentAgents.includes(agentId)) {
        setRecentAgents((prev) => [agentId, ...prev].slice(0, 5))
      }
    }

    // Close discover page
    setShowDiscover(false)
  }

  // Update the customFetch function to use our new service for sending messages
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

        // If we have a threadId, add the message and run the thread
        if (threadId) {
          console.log(`Adding message to thread ${threadId}`)

          // Add the message to the thread
          await langGraphService.addThreadMessage(threadId, {
            role: "user",
            content: latestMessage.content || "",
            isBBotThread: selectedAgent === "b-bot",
          })

          // Run the thread with the selected agent
          const response = await langGraphService.runThread(threadId, selectedAgent || "b-bot", {
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

        // If no threadId, fall back to the original fetch
        console.log("No threadId, falling back to original fetch")
        return fetch(url, options)
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
    [threadId, selectedAgent],
  )

  // Update the useChat hook to use our custom fetch function
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/chat",
    body: {
      agent: selectedAgent || "b-bot",
      threadId: threadId,
      token: cachedAuthToken, // Include the token in the request body
      synapseToken: cachedAuthToken, // Include as synapseToken to match Vue implementation
      isAnonymous: !isAuthenticated && selectedAgent === "b-bot", // Flag for anonymous B-Bot usage
      messages: [], // Ensure messages array exists initially
    },
    id: selectedAgent || "b-bot", // Default to b-bot
    onFinish: (message) => {
      scrollToBottom()

      // Estimate token usage (in a real app, this would come from the API)
      const newTokens = estimateTokenUsage(message.content)
      setTokensUsed((prev) => prev + newTokens)

      // Deduct from balance
      const cost = calculateTokenCost(newTokens)
      setBalance((prev) => prev - cost)
    },
    fetcher: customFetch, // Use our custom fetch function
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

  // Check if auto recharge should be triggered
  const checkAutoRecharge = () => {
    if (autoRechargeEnabled && balance < rechargeThreshold) {
      // In a real app, this would call an API to process the payment
      // For demo purposes, we'll just add the funds directly
      setBalance((prev) => prev + rechargeAmount)
      setShowAutoRechargeNotification(true)
      return true
    }
    return false
  }

  // Check if user has sufficient balance before sending message
  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Estimate tokens for the input (simplified)
    const estimatedTokens = estimateTokenUsage(input)
    const estimatedCost = calculateTokenCost(estimatedTokens)

    if (balance < estimatedCost) {
      // Check if auto recharge can cover this
      if (autoRechargeEnabled && balance + rechargeAmount >= estimatedCost) {
        e.preventDefault()
        // Trigger auto recharge
        setBalance((prev) => prev + rechargeAmount)
        setShowAutoRechargeNotification(true)
        // Submit after a short delay to allow state update
        setTimeout(() => {
          handleSubmit(e)
        }, 100)
        return
      }

      e.preventDefault()
      setShowPaymentRequired(true)
      return
    }

    handleSubmit(e)
  }

  // Close sidebar on mobile when clicking outside
  const handleOverlayClick = () => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false)
    }
  }

  // Set initial sidebar state based on screen size
  useEffect(() => {
    const handleResize = () => {
      setSidebarOpen(window.innerWidth > 768)
    }

    // Set initial state
    handleResize()

    // Add event listener
    window.addEventListener("resize", handleResize)

    // Clean up
    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  // Update the main content div to ensure proper layout
  return (
    <div className="app-container">
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && window.innerWidth <= 768 && <div className="sidebar-overlay" onClick={handleOverlayClick} />}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <AgentSelector
          selectedAgent={selectedAgent}
          onSelectAgent={handleSelectAgent}
          onClose={() => setSidebarOpen(false)}
          onOpenDiscover={() => setShowDiscover(true)}
          recentAgents={recentAgents}
        />
      </div>

      {/* Main content */}
      <div className="main-content">
        <ChatHeader
          selectedAgent={selectedAgent}
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenDiscover={() => setShowDiscover(true)}
        />

        {showDiscover ? (
          <div className="flex-1 overflow-auto">
            <DiscoverPage onSelectAgent={handleSelectAgent} recentAgents={recentAgents} />
          </div>
        ) : (
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
        )}
      </div>

      {/* Payment Required Modal */}
      {showPaymentRequired && (
        <PaymentRequiredModal
          onClose={() => setShowPaymentRequired(false)}
          currentBalance={balance}
          onBalanceUpdated={(newBalance) => {
            setBalance(newBalance)
            setShowPaymentRequired(false)
          }}
          onAutoRechargeChange={(enabled) => {
            setAutoRechargeEnabled(enabled)
          }}
        />
      )}

      {/* Auto Recharge Notification */}
      {showAutoRechargeNotification && (
        <AutoRechargeNotification amount={rechargeAmount} onClose={() => setShowAutoRechargeNotification(false)} />
      )}
    </div>
  )
}
