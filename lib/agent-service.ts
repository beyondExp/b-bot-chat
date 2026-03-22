"use client"

import { useState, useCallback } from "react"
import { useAuthenticatedFetch, useApiKeyFetch } from "./api"
import type { Agent } from "@/types/agent"
import type { Publisher } from "@/types/publisher"
import { useAppAuth } from "@/lib/app-auth"

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

// Built-in B-Bot agent (should always be available in Chat, even if the backend returns no agents)
const BBOT_AGENT: Agent = {
  id: "bbot",
  name: "B-Bot",
  shortDescription: "Your helpful AI assistant powered by LangGraph",
  description:
    "B-Bot is an intelligent AI assistant that can help you with various tasks, answer questions, and provide assistance across different domains. Built with LangGraph for reliable and efficient responses.",
  // Use runtime-configurable main-agent logo (env-driven).
  profileImage: "/api/branding/main-agent.svg",
  category: "General",
  publisherId: "b-bot-official",
  publisher: {
    id: "b-bot-official",
    name: "B-Bot Team",
    description: "The official B-Bot development team",
    profileImage: "/logo.svg",
    verified: true,
    agentCount: 1,
    followerCount: 0,
  },
  abilities: [
    { id: "chat", name: "Chat", description: "General conversation and assistance" },
    { id: "assistance", name: "Assistance", description: "Help with various tasks" },
    { id: "general-knowledge", name: "General Knowledge", description: "Answer questions on various topics" },
  ],
  apps: [],
  // Do not ship hardcoded English starter questions for BBot.
  // The chat UI pulls welcome suggestions from runtime branding (`WELCOME_SUGGESTIONS` via `/api/branding`).
  templates: [],
  metadata: {
    owner: "b-bot-official",
    expert_profession: "General Assistant",
    profileImage: "/api/branding/main-agent.svg",
  },
  rawData: {
    assistant_id: "bbot",
    name: "B-Bot",
    description: "Your helpful AI assistant powered by LangGraph",
    metadata: {
      owner: "b-bot-official",
      expert_profession: "General Assistant",
      profileImage: "/api/branding/main-agent.svg",
    },
  },
}

export function useAgents() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const authenticatedFetch = useAuthenticatedFetch()
  const apiKeyFetch = useApiKeyFetch()
  const { user } = useAppAuth()

  const ensureBBotAgent = useCallback((list: Agent[]): Agent[] => {
    const normalized = (list || []).map((a) => {
      const isBBot =
        a.id === "bbot" ||
        a.id === "b-bot" ||
        a.name?.toLowerCase?.() === "b-bot" ||
        a.name?.toLowerCase?.() === "bbot"
      if (!isBBot) return a

      // Force B‑Bot branding to be env-driven (prevents logo "flip" after agents load).
      return {
        ...a,
        id: "bbot",
        profileImage: "/api/branding/main-agent.svg",
        // Prevent agent templates from overriding runtime welcome suggestions.
        templates: [],
        metadata: {
          ...(a as any).metadata,
          profileImage: "/api/branding/main-agent.svg",
        },
        rawData: {
          ...(a as any).rawData,
          metadata: {
            ...(((a as any).rawData || {}).metadata || {}),
            profileImage: "/api/branding/main-agent.svg",
          },
        },
      } as Agent
    })

    const hasBBot = normalized.some(
      (a) => a.id === "bbot" || a.id === "b-bot" || a.name?.toLowerCase?.() === "b-bot" || a.name?.toLowerCase?.() === "bbot",
    )
    return hasBBot ? normalized : [BBOT_AGENT, ...normalized]
  }, [])

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
      const agents = Array.isArray(data) 
        ? data.map(transformApiAssistantToAgent)
            // Filter only agents with "Chat" distribution channel type
            // Or those without a distribution channel type (legacy compatibility if needed)
            .filter(agent => {
              const distType = agent.metadata?.distributionChannel?.type;
              return distType === 'Chat' || !distType; // Keep Chat or unspecified, filter out Embed/Template unless specifically intended
            })
        : []

      // Mark agents published by the current user
      if (user && user.sub) {
        agents.forEach((agent) => {
          if (agent.metadata && agent.metadata.owner === user.sub) {
            agent.isPublishedByUser = true
          }
        })
      }

      console.log(`Processed ${agents.length} agents`)
      return ensureBBotAgent(agents)
    } catch (err) {
      console.error("Error fetching agents:", err)
      setError("Failed to load agents")

      // Do NOT fall back to `/assistants/search` here:
      // - It previously hit `api.b-bot.space` (wrong platform)
      // - Aegra's `/assistants/search` is unstable in our deployment
      // Agents are expected to come from `/api/agents` (MainAPI v3 public distribution channels).
      return ensureBBotAgent([])
    } finally {
      setIsLoading(false)
    }
  }, [authenticatedFetch, ensureBBotAgent, user])

  // Helper function to transform API assistant format to our Agent format
  const transformApiAssistantToAgent = (assistant: any): Agent => {
    // Extract metadata
    const metadata = assistant.metadata || {}
    const resolvedId =
      assistant.assistant_id ||
      assistant.channel_id ||
      assistant.id ||
      (typeof assistant === "string" ? assistant : undefined)

    return {
      // MainAPI returns "distribution channels" with `channel_id`.
      // Synapse assistants use `assistant_id`. Support both.
      id: String(resolvedId || ""),
      name: assistant.name || "Unnamed Assistant",
      shortDescription: assistant.description || "No description available",
      description: assistant.description || "No description available",
      profileImage: metadata.profileImage || "/placeholder.svg?height=200&width=200", // Use metadata image if present
      category: metadata.expert_profession || "General",
      publisherId: metadata.owner || "anonymous",
      publisher: anonymousPublisher, // Always use anonymous publisher for now
      abilities: metadata.abilities || [],
      apps: [],
      templates: metadata.templates || [],
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
        // Special case for "bbot" - inject the agent information instead of fetching
        if (agentId === "bbot" || agentId === "b-bot") {
          return BBOT_AGENT
        }

        let responseData
        if (options?.allowAnonymous) {
          // Anonymous fetch using embed-proxy endpoint, no Authorization header
          // The embed-proxy will automatically add the Admin API Key for anonymous requests
          const response = await fetch(`/api/embed-proxy/assistants/${agentId}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
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
