"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import {
  ChevronLeftIcon,
  Sparkles,
  BookOpen,
  ChefHat,
  Heart,
  Code,
  CompassIcon,
  ExternalLink,
  LogIn,
} from "lucide-react"
import { useAgents } from "@/lib/agent-service"
import { useAuth0 } from "@auth0/auth0-react"
import type { Agent } from "@/types/agent"

interface AgentSelectorProps {
  selectedAgent: string | null
  onSelectAgent: (agentId: string | null) => void
  onClose: () => void
  onOpenDiscover: () => void
  recentAgents: string[]
}

export function AgentSelector({
  selectedAgent,
  onSelectAgent,
  onClose,
  onOpenDiscover,
  recentAgents,
}: AgentSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)

  // Get authentication status from Auth0
  const { isAuthenticated, loginWithRedirect } = useAuth0()
  const { getAgents } = useAgents()

  // Fetch agents only if authenticated
  useEffect(() => {
    // Always fetch agents if authenticated
    if (isAuthenticated) {
      const fetchAgents = async () => {
        setIsLoading(true)
        try {
          const agentsData = await getAgents()
          if (isMounted.current) {
            setAgents(agentsData)
          }
        } catch (err) {
          console.error("Error fetching agents:", err)
          if (isMounted.current) {
            setError("Failed to load agents. Please try again later.")
          }
        } finally {
          if (isMounted.current) {
            setIsLoading(false)
          }
        }
      }

      fetchAgents()
    } else {
      // If not authenticated, set agents to empty array (we'll handle B-Bot separately)
      setAgents([])
      setIsLoading(false)
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted.current = false
    }
  }, [isAuthenticated])

  // Get icon for agent based on category
  const getAgentIcon = (agent: Agent) => {
    switch (agent.category) {
      case "Education":
        return <BookOpen size={18} />
      case "Lifestyle":
        return <ChefHat size={18} />
      case "Health":
        return <Heart size={18} />
      case "Technology":
        return <Code size={18} />
      default:
        return <Sparkles size={18} />
    }
  }

  // Update the ensureBBotIncluded function to create a B-Bot agent if it doesn't exist

  const ensureBBotIncluded = (agentsList: Agent[]): Agent[] => {
    // Check if B-Bot is already in the list
    const bBotExists = agentsList.some((agent) => agent.id === "b-bot")

    if (!bBotExists) {
      // Create a default B-Bot agent if it doesn't exist in the agents list
      const defaultBBot: Agent = {
        id: "b-bot",
        name: "B-Bot",
        shortDescription: "Your personal AI assistant",
        description: "B-Bot is your personal AI assistant that can help with a wide range of tasks.",
        profileImage: "/helpful-robot.png",
        category: "General",
        publisherId: "beyond-official",
        abilities: [],
        apps: [],
      }

      // Add B-Bot to the beginning of the list
      return [defaultBBot, ...agentsList]
    }

    // If B-Bot exists but is not at the beginning, move it to the beginning
    if (agentsList[0]?.id !== "b-bot") {
      const bBot = agentsList.find((agent) => agent.id === "b-bot")
      const otherAgents = agentsList.filter((agent) => agent.id !== "b-bot")
      return [bBot!, ...otherAgents]
    }

    return agentsList
  }

  // Update the displayedAgents calculation to always include B-Bot at the top
  // and filter other agents based on authentication status
  const displayedAgents = useMemo(() => {
    // Create default B-Bot agent
    const defaultBBot: Agent = {
      id: "b-bot",
      name: "B-Bot",
      shortDescription: "Your personal AI assistant",
      description: "B-Bot is your personal AI assistant that can help with a wide range of tasks.",
      profileImage: "/helpful-robot.png",
      category: "General",
      publisherId: "beyond-official",
      abilities: [],
      apps: [],
    }

    // If not authenticated, only show B-Bot
    if (!isAuthenticated) {
      return [defaultBBot]
    }

    // If authenticated, ensure B-Bot is included with other agents
    const agentsWithBBot = ensureBBotIncluded(
      recentAgents.length > 0 ? agents.filter((agent) => recentAgents.includes(agent.id)) : agents.slice(0, 5),
    )

    return agentsWithBBot
  }, [isAuthenticated, agents, recentAgents])

  return (
    <>
      <div className="sidebar-header">
        <h2 className="font-medium">AI Agents</h2>
        <button onClick={onClose} className="icon-button" aria-label="Close sidebar">
          <ChevronLeftIcon size={18} />
        </button>
      </div>

      <div className="sidebar-content">
        {/* Discover button - only show if authenticated */}
        {isAuthenticated ? (
          <button className="discover-button" onClick={onOpenDiscover} aria-label="Discover AI Agents">
            <CompassIcon size={18} />
            <span>Discover AI Agents</span>
          </button>
        ) : (
          <button
            className="discover-button"
            onClick={() => loginWithRedirect()}
            aria-label="Sign in to discover more agents"
          >
            <LogIn size={18} />
            <span>Sign in for more agents</span>
          </button>
        )}

        {isLoading ? (
          <div className="p-4 text-center">
            <div className="animate-pulse">Loading agents...</div>
          </div>
        ) : error && isAuthenticated ? (
          <div className="p-4 text-center">
            <div className="text-red-500 mb-2">{error}</div>
            <button
              className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Always show B-Bot at the top */}
            {displayedAgents.length > 0 && displayedAgents[0].id === "b-bot" && (
              <button
                key="b-bot"
                className={`sidebar-agent ${selectedAgent === "b-bot" ? "active" : ""}`}
                onClick={() => {
                  onSelectAgent("b-bot")
                  // Close sidebar on mobile after selection
                  if (window.innerWidth <= 768) {
                    onClose()
                  }
                }}
              >
                <div className={`agent-icon ${selectedAgent === "b-bot" ? "bg-primary text-white" : "bg-muted"}`}>
                  <Sparkles size={18} />
                </div>
                <div className="agent-info">
                  <div className="agent-name">B-Bot</div>
                  <div className="agent-description">Your personal AI assistant</div>
                </div>
              </button>
            )}

            {/* Only show Recent section if authenticated and there are recent agents */}
            {isAuthenticated && recentAgents.length > 0 && (
              <div className="sidebar-section">
                <h3 className="sidebar-section-title">Recent</h3>
              </div>
            )}

            {/* Show other agents only if authenticated */}
            {isAuthenticated &&
              displayedAgents
                .filter((agent) => agent.id !== "b-bot")
                .map((agent) => (
                  <button
                    key={agent.id}
                    className={`sidebar-agent ${selectedAgent === agent.id ? "active" : ""}`}
                    onClick={() => {
                      onSelectAgent(agent.id)
                      // Close sidebar on mobile after selection
                      if (window.innerWidth <= 768) {
                        onClose()
                      }
                    }}
                  >
                    <div className={`agent-icon ${selectedAgent === agent.id ? "bg-primary text-white" : "bg-muted"}`}>
                      {getAgentIcon(agent)}
                    </div>
                    <div className="agent-info">
                      <div className="agent-name">{agent.name}</div>
                      <div className="agent-description">{agent.shortDescription}</div>
                    </div>
                  </button>
                ))}

            {/* Show "View All" button if authenticated and there are more than 5 agents */}
            {isAuthenticated && agents.length > 5 && recentAgents.length === 0 && (
              <button className="view-all-button" onClick={onOpenDiscover}>
                View All Agents
              </button>
            )}
          </>
        )}

        {/* Show promo container for both authenticated and unauthenticated users */}
        <div className="promo-container">
          <a href="https://hub.b-bot.space" target="_blank" rel="noopener noreferrer" className="hub-promo-card">
            <div className="hub-promo-icon">
              <ExternalLink size={18} />
            </div>
            <div>
              <h3 className="promo-title">Beyond-Bot.ai Hub</h3>
              <p className="promo-description">Create, publish, and monetize your own AI agents.</p>
            </div>
          </a>
        </div>
      </div>
    </>
  )
}
