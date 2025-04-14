"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, CheckCircle } from "lucide-react"
import Image from "next/image"
import type { Agent } from "@/types/agent"
import type { Publisher } from "@/types/publisher"
import { useAgents, usePublishers, anonymousPublisher } from "@/lib/agent-service"

interface PublisherProfileProps {
  publisherId: string
  onBack: () => void
  onSelectAgent: (agentId: string) => void
  useFallback?: boolean
}

export function PublisherProfile({ publisherId, onBack, onSelectAgent, useFallback = false }: PublisherProfileProps) {
  const [publisher, setPublisher] = useState<Publisher | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { getPublisher } = usePublishers()
  const { getAgentsByPublisher } = useAgents()

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // For now, just use the anonymous publisher
        // This will be replaced with real publisher data when the API is available
        setPublisher(anonymousPublisher)

        // Get agents by publisher
        const publisherAgents = await getAgentsByPublisher(publisherId)
        setAgents(publisherAgents)
      } catch (err) {
        console.error("Error fetching publisher data:", err)
        setError("Failed to load publisher data")

        // Use anonymous publisher as fallback
        setPublisher(anonymousPublisher)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [publisherId])

  if (isLoading) {
    return (
      <div className="publisher-profile">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-lg">Loading publisher profile...</div>
        </div>
      </div>
    )
  }

  if (error || !publisher) {
    return (
      <div className="publisher-profile">
        <button className="publisher-back-button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Discover</span>
        </button>
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mt-4">
          <p className="font-bold">Error</p>
          <p>{error || "Failed to load publisher data"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="publisher-profile">
      <button className="publisher-back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>Back to Discover</span>
      </button>

      <div className="publisher-header">
        <div className="publisher-avatar-large">
          <Image
            src={publisher.profileImage || "/placeholder.svg?height=100&width=100"}
            alt={publisher.name}
            width={100}
            height={100}
          />
        </div>
        <div className="publisher-info">
          <div className="publisher-name-container">
            <h1 className="publisher-name">{publisher.name}</h1>
            {publisher.verified && <CheckCircle size={16} className="verified-icon" />}
          </div>
          <p className="publisher-description">{publisher.description}</p>
          <div className="publisher-stats">
            <div className="publisher-stat">
              <span className="publisher-stat-value">{publisher.agentCount || agents.length}</span>
              <span className="publisher-stat-label">Agents</span>
            </div>
            <div className="publisher-stat">
              <span className="publisher-stat-value">{publisher.followerCount?.toLocaleString() || "0"}</span>
              <span className="publisher-stat-label">Followers</span>
            </div>
          </div>
        </div>
      </div>

      <div className="publisher-agents">
        <h2 className="publisher-section-title">Agents by {publisher.name}</h2>
        {agents.length > 0 ? (
          <div className="publisher-agents-grid">
            {agents.map((agent) => (
              <div key={agent.id} className="agent-card">
                <div className="agent-card-image-container">
                  <Image
                    src={agent.profileImage || "/placeholder.svg?height=80&width=80"}
                    alt={agent.name}
                    width={80}
                    height={80}
                    className="agent-card-image"
                  />
                </div>
                <div className="agent-card-content">
                  <h3 className="agent-card-title">{agent.name}</h3>
                  <p className="agent-card-description">{agent.shortDescription}</p>
                </div>
                <button className="agent-card-button" onClick={() => onSelectAgent(agent.id)}>
                  Chat Now
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="publisher-empty">
            <p>No agents found for this publisher.</p>
          </div>
        )}
      </div>
    </div>
  )
}
