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
import { LangGraphService } from "@/lib/langgraph-service-sdk"
import { StreamingHandlerService } from "@/lib/streaming-handler-service"

interface ChatInterfaceProps {
  initialAgent?: string | null
}

export function ChatInterface({ initialAgent }: ChatInterfaceProps) {
  // Initialize selectedAgent with the initialAgent prop
  const [selectedAgent, setSelectedAgent] = useState<string>(initialAgent ?? "bbot")
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
  const { getAgent, getAgents } = useAgents()
  const authenticatedFetch = useAuthenticatedFetch()

  // Add this to the ChatInterface component, after the existing state declarations
  const [threadId, setThreadId] = useState<string | null>(null)
  const [incomingMessage, setIncomingMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])

  // Create a new instance of LangGraphService
  const langGraphService = new LangGraphService()
  const streamingHandler = new StreamingHandlerService()

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
            agent_id: selectedAgent || "bbot",
          })
          setThreadId(thread.thread_id)
        } catch (error) {
          // Silent error handling
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
          // Silent error handling
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
        // Silent error handling
      }
    }

    fetchToken()
  }, [isAuthenticated, getAccessTokenSilently])

  // Update the handleSelectAgent function to create a new thread when switching agents
  const handleSelectAgent = async (agentId: string) => {
    // Debug log
    console.log('Selecting agent:', agentId, 'Current recents:', recentAgents, 'Current agents:', agents.map(a => a.id));

    // Only allow selecting non-B-Bot agents if authenticated
    if (agentId !== "bbot" && !(isAuthenticated || isLocallyAuthenticated())) {
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
      if ((isAuthenticated || isLocallyAuthenticated() || agentId === "bbot")) {
        const initializeNewThread = async () => {
          try {
            const thread = await langGraphService.createThread({
              user_id: user?.sub || "anonymous-user",
              agent_id: agentId,
            })
            setThreadId(thread.thread_id)

            // Clear messages when switching agents
            setChatMessages([])
            setConversationHistory([])
          } catch (error) {
            // If this is B-Bot, create a fallback thread
            if (agentId === "bbot") {
              const fallbackThreadId = `bbot-anonymous-${Date.now()}`
              setThreadId(fallbackThreadId)

              // Clear messages when switching agents
              setChatMessages([])
              setConversationHistory([])
            } else {
              // For other agents, show an error message
              alert("Failed to initialize chat with this agent. Please try again later.")
            }
          }
        }

        initializeNewThread()
      }
    }

    // Add to recent agents if not already there
    if (!recentAgents.includes(agentId)) {
      setRecentAgents((prev) => [agentId, ...prev].slice(0, 5))
      console.log('Added to recents:', agentId, 'New recents:', [agentId, ...recentAgents].slice(0, 5))
    }

    // Ensure the agent is in the loaded agents array (even if it's the current agent)
    if (!agents.some(agent => agent.id === agentId)) {
      try {
        const agent = await getAgent(agentId)
        if (agent) {
          setAgents(prev => [...prev, agent])
          console.log('Added to agents array:', agentId)
        }
      } catch (e) {
        // Fallback: add a minimal agent object
        setAgents(prev => [
          ...prev,
          {
            id: agentId,
            name: agentId,
            shortDescription: '',
            description: '',
            profileImage: '/helpful-robot.png',
            category: 'General',
            publisherId: '',
            abilities: [],
            apps: [],
          }
        ])
        console.log('Added fallback agent to agents array:', agentId)
      }
    }

    // Close discover page
    setShowDiscover(false)
  }

  // Function to handle sending a message with streaming
  const handleSendMessage = async (messageContent: string) => {
    console.log('[Chat] handleSendMessage called with:', messageContent)
    if (!messageContent.trim()) return
    setIsLoading(true)

    // Create a temporary user message to show immediately
    const tempUserMessage = {
      id: `user-temp-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: new Date().toISOString(),
    }

    // Add the user message to the chat
    setChatMessages((prev) => [...prev, tempUserMessage])

    // Update conversation history
    const updatedHistory = [
      ...conversationHistory,
      {
        role: "user",
        content: messageContent,
      },
    ]
    setConversationHistory(updatedHistory)

    try {
      // Get the current thread ID or create a new one
      let currentThreadId = threadId
      if (!currentThreadId) {
        const thread = await langGraphService.createThread({
          user_id: user?.sub || "anonymous-user",
          agent_id: selectedAgent || "bbot",
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
      const agentId = selectedAgent || "bbot"
      const entityId = userId.replace(/[|\-]/g, '') + '_' + agentId

      // Prepare the configuration for the stream - matching the example payload structure
      const streamConfig = {
        input: {
          entity_id: entityId,
          messages: [{ role: "user", content: messageContent }],
        },
        config: {
          thread_id: currentThreadId,
          agent_id: agentId,
          user_id: userId,
          conversation_history: updatedHistory,
          // Add any other configuration options as needed
          temperature: 0.7,
          max_tokens: 1024,
          top_p: 1.0,
          instructions: "Be helpful and concise.",
        },
      }

      // Invoke the streaming graph
      console.log('[Chat] invoking streaming graph with config:', streamConfig)
      const response = await langGraphService.invokeGraphStream(selectedAgent, currentThreadId, streamConfig)

      console.log('[Chat] starting streamingHandler.processStream')
      // Process the streaming response
      await streamingHandler.processStream(response, {
        onMessage: (msg) => {
          setIncomingMessage(msg)
          scrollToBottom()
        },
        onToolEvent: (event) => {
          // Handle tool events if needed
        },
        onUpdate: (messages) => {
          console.log('[Chat] onUpdate raw messages:', messages)
          // Map the full messages array from the backend into chatMessages
          if (messages && messages.length > 0) {
            const mappedMessages = messages.map((msg, idx) => ({
              id: msg.id || `msg-${idx}-${Date.now()}`,
              role: msg.type === "human" || msg.role === "user" ? "user" : "assistant",
              content: msg.content || "",
              timestamp: new Date().toISOString(),
            }))
            console.log('[Chat] mappedMessages:', mappedMessages)
            setChatMessages(mappedMessages)
          }

          setIsLoading(false)
          setIncomingMessage("")
          scrollToBottom()

          // Estimate token usage
          if (messages && messages.length > 0) {
            const lastMessage = messages[messages.length - 1]
            const newTokens = estimateTokenUsage(lastMessage.content || "")
            setTokensUsed((prev) => prev + newTokens)

            // Deduct from balance
            const cost = calculateTokenCost(newTokens)
            setBalance((prev) => prev - cost)
          }
        },
        onError: (err) => {
          setIsLoading(false)
          alert(`Error: ${err}`)
        },
        onScrollDown: scrollToBottom,
        onSetLoading: setIsLoading,
        onInterrupt: (interruptMessage) => {
          // Handle interrupts if needed
        },
      })
    } catch (error) {
      setIsLoading(false)
      alert(`Failed to send message. Please try again.`)
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
  }, [chatMessages, incomingMessage])

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
  const handleMessageSubmit = (e: React.FormEvent<HTMLFormElement>, input: string) => {
    e.preventDefault()

    // Estimate tokens for the input (simplified)
    const estimatedTokens = estimateTokenUsage(input)
    const estimatedCost = calculateTokenCost(estimatedTokens)

    if (balance < estimatedCost) {
      // Check if auto recharge can cover this
      if (autoRechargeEnabled && balance + rechargeAmount >= estimatedCost) {
        // Trigger auto recharge
        setBalance((prev) => prev + rechargeAmount)
        setShowAutoRechargeNotification(true)
        // Submit after a short delay to allow state update
        setTimeout(() => {
          handleSendMessage(input)
        }, 100)
        return
      }

      setShowPaymentRequired(true)
      return
    }

    handleSendMessage(input)
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
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={handleSelectAgent as (agentId: string) => void}
          onClose={() => setSidebarOpen(false)}
          showDiscover={showDiscover}
          setShowDiscover={setShowDiscover}
          recentAgents={recentAgents}
          isAuthenticated={isAuthenticated}
          loginWithRedirect={loginWithRedirect}
        />
      </div>

      {/* Main content */}
      <div className="main-content">
        <ChatHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isSidebarOpen={sidebarOpen}
          onToggleDiscover={() => setShowDiscover(true)}
        />

        {showDiscover ? (
          <div className="flex-1 overflow-auto">
            <DiscoverPage onSelectAgent={handleSelectAgent} recentAgents={recentAgents} />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="chat-container">
              <ChatMessages
                messages={chatMessages}
                messagesEndRef={messagesEndRef}
                selectedAgent={selectedAgent}
                agents={agents}
                incomingMessage={incomingMessage}
                onSuggestionClick={(suggestion) => {
                  handleSendMessage(suggestion)
                }}
              />
              <ChatInput
                onSubmit={(e, input) => handleMessageSubmit(e, input)}
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
