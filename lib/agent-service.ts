"use client"

import { useState, useCallback } from "react"
import { useAuthenticatedFetch, useApiKeyFetch } from "./api"
import type { Agent } from "@/types/agent"
import type { Publisher } from "@/types/publisher"
import { useAuth0 } from "@auth0/auth0-react"

// Default anonymous publisher to use when no publisher data is available
export const anonymousPublisher: Publisher = {
  id: "anonymous",
  name: "Anonymous Publisher",
  description: "This agent was published anonymously.",
  profileImage: "/placeholder.svg?height=200&width=200",
  verified: false,
  agentCount: 1,
  followerCount: 0,
}

const MASTER_KEY = process.env.NEXT_PUBLIC_BBOT_MASTER_KEY || "REPLACE_WITH_MASTER_KEY";

export function useAgents() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const authenticatedFetch = useAuthenticatedFetch()
  const apiKeyFetch = useApiKeyFetch()
  const { user } = useAuth0()

  // Function to get all agents using the new v3 endpoint
  const getAgents = useCallback(async (): Promise<Agent[]> => {
    setIsLoading(true)
    setError(null)

    try {
      console.log("Fetching all agents using v3 public assistants endpoint...")
      // Use GET method to fetch agents
      const response = await fetch("/api/agents", {
        method: "GET",
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Response from public assistants:", data)

      // Transform the API response into our Agent format
      const agents = Array.isArray(data) ? data.map(transformApiAssistantToAgent) : []

      // Mark agents published by the current user
      if (user && user.sub) {
        agents.forEach((agent) => {
          if (agent.metadata && agent.metadata.owner === user.sub) {
            agent.isPublishedByUser = true
          }
        })
      }

      console.log(`Processed ${agents.length} agents`)
      return agents
    } catch (err) {
      console.error("Error fetching agents:", err)
      setError("Failed to load agents")

      // Fallback to the old endpoint if the new one fails
      console.log("Falling back to v2 assistants search endpoint...")
      try {
        const fallbackResponse = await authenticatedFetch("/assistants/search", {
          method: "POST",
          body: JSON.stringify({
            metadata: {},
            graph_id: "bbot",
            limit: 100,
            offset: 0,
          }),
        })

        console.log("Fallback response from assistants search:", fallbackResponse)
        const fallbackAgents = Array.isArray(fallbackResponse) ? fallbackResponse.map(transformApiAssistantToAgent) : []
        console.log(`Fetched ${fallbackAgents.length} agents from fallback endpoint`)

        return fallbackAgents
      } catch (fallbackErr) {
        console.error("Error fetching agents from fallback endpoint:", fallbackErr)
        return []
      }
    } finally {
      setIsLoading(false)
    }
  }, [authenticatedFetch, user])

  // Helper function to transform API assistant format to our Agent format
  const transformApiAssistantToAgent = (assistant: any): Agent => {
    // Extract metadata
    const metadata = assistant.metadata || {}

    return {
      id: assistant.assistant_id,
      name: assistant.name || "Unnamed Assistant",
      shortDescription: assistant.description || "No description available",
      description: assistant.description || "No description available",
      profileImage: "/placeholder.svg?height=200&width=200", // Default image
      category: metadata.expert_profession || "General",
      publisherId: metadata.owner || "anonymous",
      publisher: anonymousPublisher, // Always use anonymous publisher for now
      abilities: [],
      apps: [],
      metadata: metadata,
      // Add raw data for debugging
      rawData: assistant,
    }
  }

  // Function to get a specific agent by ID
  const getAgent = useCallback(
    async (agentId: string, options?: { allowAnonymous?: boolean }): Promise<Agent | null> => {
      setIsLoading(true)
      setError(null)

      try {
        let responseData
        if (options?.allowAnonymous) {
          // Anonymous fetch using master key
          const response = await fetch(`https://api-staging.b-bot.space/api/v2/assistants/${agentId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${MASTER_KEY}`,
            },
          })
          if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`)
          responseData = await response.json()
        } else {
          // Authenticated fetch as before
          responseData = await authenticatedFetch(`/assistants/${agentId}`, {
            method: "GET",
          })
        }

        return transformApiAssistantToAgent(responseData) || null
      } catch (err) {
        console.error(`Error fetching agent ${agentId}:`, err)
        setError("Failed to load agent")
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [authenticatedFetch],
  )

  // Function to get agents by publisher ID
  const getAgentsByPublisher = useCallback(
    async (publisherId: string): Promise<Agent[]> => {
      setIsLoading(true)
      setError(null)

      try {
        console.log(`Fetching agents for publisher ${publisherId}...`)

        // For now, we'll just fetch all agents and filter client-side
        const allAgents = await getAgents()
        const publisherAgents = allAgents.filter(
          (agent) => agent.publisherId === publisherId || (agent.publisher && agent.publisher.id === publisherId),
        )

        console.log(`Filtered ${publisherAgents.length} agents for publisher ${publisherId}`)
        return publisherAgents
      } catch (err) {
        console.error(`Error fetching agents for publisher ${publisherId}:`, err)
        setError("Failed to load agents for publisher")
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [getAgents],
  )

  return {
    getAgents,
    getAgent,
    getAgentsByPublisher,
    isLoading,
    error,
  }
}

export function usePublishers() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const authenticatedFetch = useAuthenticatedFetch()

  // Placeholder function for future implementation
  const getPublisher = useCallback(async (publisherId: string): Promise<Publisher | null> => {
    // For now, just return the anonymous publisher
    // This can be replaced with a real API call when the endpoint is available
    return anonymousPublisher
  }, [])

  // Placeholder function for future implementation
  const getPublishers = useCallback(async (): Promise<Publisher[]> => {
    // For now, just return an empty array
    // This can be replaced with a real API call when the endpoint is available
    return []
  }, [])

  return {
    getPublisher,
    getPublishers,
    isLoading,
    error,
  }
}
