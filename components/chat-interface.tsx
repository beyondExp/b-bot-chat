"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "ai/react"
import { ChatHeader } from "@/components/chat-header"
import { ChatMessages } from "@/components/chat-messages"
import { ChatInput } from "@/components/chat-input"
import { AgentSelector } from "@/components/agent-selector"
import { DiscoverPage } from "@/components/discover-page"
import { useAuth0 } from "@auth0/auth0-react"
import { getAuthToken, isLocallyAuthenticated } from "@/lib/api"

export function ChatInterface() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<any>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const { isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0()
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Get auth token on mount and when auth state changes
  useEffect(() => {
    async function getToken() {
      try {
        // First check if we're authenticated through Auth0
        if (isAuthenticated) {
          console.log("Getting token from Auth0")
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: "https://api.b-bot.space",
            },
          })
          console.log("Got token from Auth0")
          setAuthToken(token)
          return
        }

        // If not authenticated through Auth0, check for local token
        if (isLocallyAuthenticated()) {
          console.log("Getting token from localStorage")
          const token = getAuthToken()
          console.log("Got token from localStorage:", !!token)
          setAuthToken(token)
          return
        }

        console.log("No authentication source available")
        setAuthToken(null)
      } catch (error) {
        console.error("Error getting token:", error)
        setAuthToken(null)
      }
    }

    // Only try to get token if not loading
    if (!isLoading) {
      getToken()
    }
  }, [isAuthenticated, getAccessTokenSilently, isLoading])

  // Custom fetch function that adds the auth token
  const customFetch = async (url: string, options: RequestInit) => {
    // Get the current token (might have been updated)
    const currentToken = getAuthToken() || authToken

    // Log token status for debugging
    console.log("Token status:", {
      hasToken: !!currentToken,
      isAuthenticated,
      isLocallyAuth: isLocallyAuthenticated(),
    })

    // Create headers with auth token if available
    const headers = new Headers(options.headers)
    if (currentToken) {
      headers.set("Authorization", `Bearer ${currentToken}`)
    }

    // Create body with token included as fallback
    let body = options.body
    if (body && typeof body === "string") {
      try {
        const bodyObj = JSON.parse(body)
        bodyObj.token = currentToken
        bodyObj.synapseToken = currentToken // Add synapseToken to match Vue implementation
        body = JSON.stringify(bodyObj)
      } catch (e) {
        console.error("Error parsing request body:", e)
      }
    }

    // Make the request with updated headers and body
    return fetch(url, {
      ...options,
      headers,
      body: body as BodyInit,
    })
  }

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: isChatLoading,
  } = useChat({
    api: "/api/chat",
    body: {
      assistantId: selectedAgent?.id || "b-bot",
      config: {
        temperature: 0.7,
      },
    },
    onError: (error) => {
      console.error("Chat error:", error)
    },
    fetcher: customFetch,
  })

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const toggleDiscover = () => {
    setIsDiscoverOpen(!isDiscoverOpen)
  }

  const handleAgentSelect = (agent: any) => {
    setSelectedAgent(agent)
    setIsSidebarOpen(false)
  }

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="flex h-screen bg-background">
      <AgentSelector
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectAgent={handleAgentSelect}
        selectedAgentId={selectedAgent?.id}
      />

      <div className="flex-1 flex flex-col h-full">
        <ChatHeader onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} onToggleDiscover={toggleDiscover} />

        <div className="flex-1 overflow-hidden relative">
          {isDiscoverOpen ? (
            <DiscoverPage onSelectAgent={handleAgentSelect} onClose={toggleDiscover} />
          ) : (
            <>
              <div ref={chatContainerRef} className="h-full overflow-y-auto pb-32">
                <ChatMessages messages={messages} isLoading={isChatLoading} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background to-transparent pt-16">
                <ChatInput
                  input={input}
                  handleInputChange={handleInputChange}
                  handleSubmit={handleSubmit}
                  isLoading={isChatLoading}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
