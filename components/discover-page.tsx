"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Search,
  X,
  Star,
  Sparkles,
  BookOpen,
  ChefHat,
  Heart,
  Code,
  Zap,
  AppWindow,
  ExternalLink,
  UserIcon,
  ArrowLeft,
} from "lucide-react"
import Image from "next/image"
import type { Agent } from "@/types/agent"
import { PublisherProfile } from "./publisher-profile"
import { useAgents, anonymousPublisher } from "@/lib/agent-service"
import { LANGGRAPH_AUDIENCE } from "@/lib/api"
import { useAppAuth } from "@/lib/app-auth"
import { useI18n } from "@/lib/i18n"

interface DiscoverPageProps {
  onSelectAgent: (agentId: string) => void
  onClose?: () => void
  recentAgents: string[]
  contactAgentIds?: string[]
  onToggleContact?: (agentId: string) => void
}

// Fallback data in case API fails
const fallbackAgents: Agent[] = [
  {
    id: "b-bot",
    name: "B-Bot",
    shortDescription: "Your personal AI assistant",
    description:
      "B-Bot is your personal AI assistant that can help with a wide range of tasks, from answering questions to generating content and providing recommendations.",
    profileImage: "https://beyond-bot.ai/logo-schwarz.svg",
    category: "General",
    featured: true,
    popular: true,
    publisherId: "beyond-official",
    publisher: anonymousPublisher, // Use anonymous publisher for fallback data
    abilities: [
      { id: "web-search", name: "Web Search", description: "Search the web for information" },
      { id: "creative-writing", name: "Creative Writing", description: "Generate creative content" },
      { id: "data-analysis", name: "Data Analysis", description: "Analyze data and generate insights" },
    ],
    apps: [{ id: "notion", name: "Notion", icon: "N" }],
  },
  {
    id: "default",
    name: "Beyond Assistant",
    shortDescription: "General purpose AI assistant",
    description:
      "A versatile AI assistant that can help with a wide range of tasks, from answering questions to generating content.",
    profileImage: "/placeholder.svg?height=200&width=200",
    category: "General",
    featured: true,
    popular: true,
    publisherId: "beyond-official",
    publisher: anonymousPublisher, // Use anonymous publisher for fallback data
    abilities: [
      { id: "web-search", name: "Web Search", description: "Search the web for information" },
      { id: "creative-writing", name: "Creative Writing", description: "Generate creative content" },
    ],
    apps: [{ id: "notion", name: "Notion", icon: "N" }],
  },
  // Keep the rest of the fallback agents
  {
    id: "professor",
    name: "Professor Einstein",
    shortDescription: "Physics and mathematics expert",
    description:
      "An expert in physics and mathematics who can explain complex concepts in simple terms and provide detailed explanations.",
    profileImage: "/placeholder.svg?height=200&width=200",
    category: "Education",
    popular: true,
    publisherId: "edu-labs",
    publisher: anonymousPublisher, // Use anonymous publisher for fallback data
    abilities: [
      { id: "web-search", name: "Web Search", description: "Search the web for information" },
      { id: "data-analysis", name: "Data Analysis", description: "Analyze data and generate insights" },
    ],
    apps: [{ id: "calculator", name: "Calculator", icon: "=" }],
  },
]

export function DiscoverPage({
  onSelectAgent,
  onClose,
  recentAgents = [],
  contactAgentIds = [],
  onToggleContact,
}: DiscoverPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([])
  const [selectedPublisher, setSelectedPublisher] = useState<string | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [useFallback, setUseFallback] = useState(false)
  const [showMyAgents, setShowMyAgents] = useState(false)
  const contactSet = useMemo(() => new Set((contactAgentIds || []).filter(Boolean)), [contactAgentIds])
  const { t } = useI18n()

  const { isAuthenticated, getAccessTokenSilently, user } = useAppAuth()
  const { getAgents } = useAgents()

  // Fetch agents
  useEffect(() => {
    if (!isAuthenticated) return

    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Get the auth token first to ensure we're authenticated
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: LANGGRAPH_AUDIENCE,
          },
        })

        console.log("Got auth token:", token.substring(0, 15) + "...")
        console.log("Using audience:", LANGGRAPH_AUDIENCE)

        // Fetch agents
        console.log("Fetching agents...")
        const agentsResponse: any = await getAgents()
        console.log("Agents response:", agentsResponse)

        // Check if the response is an array or has a results property
        const agents = Array.isArray(agentsResponse)
          ? agentsResponse
          : agentsResponse && agentsResponse.results
            ? agentsResponse.results
            : []

        console.log(`Processed ${agents.length} agents`)
        setAgents(agents as Agent[])

        // Extract unique categories
        const uniqueCategories: string[] = Array.from(
          new Set(
            (agents || [])
              .map((agent: any) => String(agent?.category || "").trim())
              .filter(Boolean),
          ),
        )
        setCategories(uniqueCategories)

        // All agents already have the anonymous publisher set in transformApiAssistantToAgent
        setFilteredAgents(agents as Agent[])
        setUseFallback(false)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to load agents. Using fallback data.")

        // Use fallback data
        setUseFallback(true)
        setAgents(fallbackAgents)

        // Extract unique categories from fallback data
        const uniqueCategories: string[] = Array.from(new Set(fallbackAgents.map((agent) => agent.category)))
        setCategories(uniqueCategories)

        setFilteredAgents(fallbackAgents)
      } finally {
        setIsLoading(false)
      }
    }

    // Add a flag to prevent multiple fetches
    let isMounted = true
    if (isMounted) {
      fetchData()
    }

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  // Filter agents based on search query, selected category, and my agents filter
  useEffect(() => {
    if (agents.length === 0) return

    let filtered = [...agents]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.description.toLowerCase().includes(query) ||
          agent.category.toLowerCase().includes(query),
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter((agent) => agent.category === selectedCategory)
    }

    if (showMyAgents && user) {
      filtered = filtered.filter((agent) => agent.isPublishedByUser)
    }

    setFilteredAgents(filtered)
  }, [searchQuery, selectedCategory, agents, showMyAgents, user])

  // Get agent icon based on category
  const getAgentIcon = (category: string) => {
    switch (category) {
      case "Education":
        return <BookOpen size={18} />
      case "Lifestyle":
        return <ChefHat size={18} />
      case "Health":
        return <Heart size={18} />
      case "Technology":
        return <Code size={18} />
      case "Finance":
        return <Star size={18} />
      case "Entertainment":
        return <Sparkles size={18} />
      default:
        return <Sparkles size={18} />
    }
  }

  // If a publisher is selected, show the publisher profile
  if (selectedPublisher) {
    return (
      <PublisherProfile
        publisherId={selectedPublisher}
        onBack={() => setSelectedPublisher(null)}
        onSelectAgent={onSelectAgent}
        useFallback={useFallback}
      />
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="discover-page">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-lg">{t("discover.loadingAgents")}</div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return null
  }

  // Count user's published agents
  const userAgentsCount = agents.filter((agent) => agent.isPublishedByUser).length

  return (
    <div className="discover-page discover-page-shell">
      {error && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <p className="font-bold">{t("discover.noteTitle")}</p>
          <p>{error}</p>
        </div>
      )}

      <div className="discover-header">
        <div className="flex items-center gap-3 mb-4">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label={t("discover.goBack")}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex-1">
            <h1 className="discover-title">{t("discover.title")}</h1>
          </div>
        </div>

        {/* Search bar */}
        <div className="discover-search-container">
          <Search className="discover-search-icon" size={18} />
          <input
            type="text"
            placeholder={t("discover.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="discover-search-input"
          />
          {searchQuery && (
            <button
              className="discover-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label={t("discover.clearSearch")}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category filters */}
        <div className="discover-categories">
          <button
            className={`discover-category-button ${selectedCategory === null && !showMyAgents ? "active" : ""}`}
            onClick={() => {
              setSelectedCategory(null)
              setShowMyAgents(false)
            }}
          >
            {t("discover.all")}
          </button>

          {/* My Agents filter - only show if user has published agents */}
          {userAgentsCount > 0 && (
            <button
              className={`discover-category-button ${showMyAgents ? "active" : ""}`}
              onClick={() => {
                setShowMyAgents(!showMyAgents)
                if (!showMyAgents) {
                  setSelectedCategory(null)
                }
              }}
            >
              <div className="flex items-center gap-1">
                <UserIcon size={14} />
                <span>{t("discover.myAgents").replace("{count}", String(userAgentsCount))}</span>
              </div>
            </button>
          )}

          {categories.map((category) => (
            <button
              key={category}
              className={`discover-category-button ${selectedCategory === category ? "active" : ""}`}
              onClick={() => {
                setSelectedCategory(category)
                setShowMyAgents(false)
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="discover-content">
        {/* My Agents section */}
        {showMyAgents && (
          <div className="discover-section">
          <h2 className="discover-section-title">{t("discover.myPublishedAgents")}</h2>
          <div className="discover-grid">
            {filteredAgents.length > 0 ? (
              filteredAgents.map((agent) => (
                <div key={agent.id} className="agent-card">
                  <div className="agent-card-badge featured">{t("discover.badge.myAgent")}</div>
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

                    {/* Agent category */}
                    <div className="agent-card-category">
                      {getAgentIcon(agent.category)}
                      <span>{agent.category}</span>
                    </div>
                  </div>
                  {onToggleContact && (
                    <button
                      type="button"
                      className={`agent-card-contact-button ${contactSet.has(agent.id) ? "added" : ""}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onToggleContact(agent.id)
                      }}
                    >
                      {contactSet.has(agent.id) ? t("discover.removeFromContacts") : t("discover.addToContacts")}
                    </button>
                  )}
                  <button className="agent-card-button" onClick={() => onSelectAgent(agent.id)}>
                    {t("discover.chatNow")}
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-8 text-muted-foreground">
                {t("discover.noPublishedAgents")}
              </div>
            )}
          </div>
          </div>
        )}

        {/* Featured agents section */}
        {!searchQuery && !selectedCategory && !showMyAgents && (
          <div className="discover-section">
          <h2 className="discover-section-title">{t("discover.featuredAgents")}</h2>
          <div className="discover-grid">
            {filteredAgents
              .filter((agent) => agent.featured || agent.metadata?.distributionChannel?.config?.public)
              .slice(0, 4)
              .map((agent) => (
                <div key={agent.id} className="agent-card featured">
                  <div className="agent-card-badge featured">
                    {agent.isPublishedByUser ? t("discover.badge.myAgent") : t("discover.badge.featured")}
                  </div>
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

                    {/* Publisher info - always show anonymous publisher for now */}
                    <div
                      className="agent-card-publisher"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPublisher(agent.publisherId)
                      }}
                    >
                      <div className="publisher-avatar">
                        <Image
                          src="/placeholder.svg?height=20&width=20"
                          alt={t("discover.anonymousPublisher")}
                          width={20}
                          height={20}
                        />
                      </div>
                      <span className="publisher-name">{t("discover.anonymousPublisher")}</span>
                    </div>

                    {/* Agent abilities */}
                    {agent.abilities && agent.abilities.length > 0 && (
                      <div className="agent-card-abilities">
                        {agent.abilities.slice(0, 2).map((ability) => (
                          <div key={ability.id} className="agent-card-ability">
                            <Zap size={12} />
                            <span>{ability.name}</span>
                          </div>
                        ))}
                        {agent.abilities.length > 2 && (
                          <div className="agent-card-ability more">
                            {t("discover.more").replace("{count}", String(agent.abilities.length - 2))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agent apps */}
                    {agent.apps && agent.apps.length > 0 && (
                      <div className="agent-card-apps">
                        {agent.apps.slice(0, 2).map((app) => (
                          <div key={app.id} className="agent-card-app">
                            <AppWindow size={12} />
                            <span>{app.name}</span>
                          </div>
                        ))}
                        {agent.apps.length > 2 && (
                          <div className="agent-card-app more">
                            {t("discover.more").replace("{count}", String(agent.apps.length - 2))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {onToggleContact && (
                    <button
                      type="button"
                      className={`agent-card-contact-button ${contactSet.has(agent.id) ? "added" : ""}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onToggleContact(agent.id)
                      }}
                    >
                      {contactSet.has(agent.id) ? t("discover.removeFromContacts") : t("discover.addToContacts")}
                    </button>
                  )}
                  <button className="agent-card-button" onClick={() => onSelectAgent(agent.id)}>
                    {t("discover.chatNow")}
                  </button>
                </div>
              ))}
          </div>
          </div>
        )}

        {/* Recently chatted agents section */}
        {!searchQuery && !selectedCategory && !showMyAgents && recentAgents && recentAgents.length > 0 && (
          <div className="discover-section">
          <h2 className="discover-section-title">{t("discover.recentlyChatted")}</h2>
          <div className="discover-grid">
            {filteredAgents
              .filter((agent) => recentAgents.includes(agent.id))
              .map((agent) => (
                <div key={agent.id} className="agent-card">
                  {agent.isPublishedByUser && (
                    <div className="agent-card-badge featured">{t("discover.badge.myAgent")}</div>
                  )}
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

                    {/* Publisher info - always show anonymous publisher for now */}
                    <div
                      className="agent-card-publisher"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPublisher(agent.publisherId)
                      }}
                    >
                      <div className="publisher-avatar">
                        <Image
                          src="/placeholder.svg?height=20&width=20"
                          alt={t("discover.anonymousPublisher")}
                          width={20}
                          height={20}
                        />
                      </div>
                      <span className="publisher-name">{t("discover.anonymousPublisher")}</span>
                    </div>

                    {/* Agent abilities */}
                    {agent.abilities && agent.abilities.length > 0 && (
                      <div className="agent-card-abilities">
                        {agent.abilities.slice(0, 2).map((ability) => (
                          <div key={ability.id} className="agent-card-ability">
                            <Zap size={12} />
                            <span>{ability.name}</span>
                          </div>
                        ))}
                        {agent.abilities.length > 2 && (
                          <div className="agent-card-ability more">
                            {t("discover.more").replace("{count}", String(agent.abilities.length - 2))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {onToggleContact && (
                    <button
                      type="button"
                      className={`agent-card-contact-button ${contactSet.has(agent.id) ? "added" : ""}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onToggleContact(agent.id)
                      }}
                    >
                      {contactSet.has(agent.id) ? t("discover.removeFromContacts") : t("discover.addToContacts")}
                    </button>
                  )}
                  <button className="agent-card-button" onClick={() => onSelectAgent(agent.id)}>
                    {t("discover.chatNow")}
                  </button>
                </div>
              ))}
          </div>
          </div>
        )}

        {/* All agents section (for search results) */}
        {(searchQuery || selectedCategory) && (
          <div className="discover-section">
          <h2 className="discover-section-title">
            {filteredAgents.length === 1
              ? t("discover.agentFound.singular").replace("{count}", String(filteredAgents.length))
              : t("discover.agentFound.plural").replace("{count}", String(filteredAgents.length))}
          </h2>
          {filteredAgents.length > 0 ? (
            <div className="discover-grid">
              {filteredAgents.map((agent) => (
                <div key={agent.id} className="agent-card">
                  {agent.isPublishedByUser && (
                    <div className="agent-card-badge featured">{t("discover.badge.myAgent")}</div>
                  )}
                  {agent.featured && !agent.isPublishedByUser && (
                    <div className="agent-card-badge featured">{t("discover.badge.featured")}</div>
                  )}
                  {agent.new && !agent.featured && !agent.isPublishedByUser && (
                    <div className="agent-card-badge new">{t("discover.badge.new")}</div>
                  )}
                  {agent.popular && !agent.featured && !agent.new && !agent.isPublishedByUser && (
                    <div className="agent-card-badge popular">{t("discover.badge.popular")}</div>
                  )}
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
                    <div className="agent-card-category">
                      {getAgentIcon(agent.category)}
                      <span>{agent.category}</span>
                    </div>
                    <h3 className="agent-card-title">{agent.name}</h3>
                    <p className="agent-card-description">{agent.shortDescription}</p>

                    {/* Publisher info - always show anonymous publisher for now */}
                    <div
                      className="agent-card-publisher"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPublisher(agent.publisherId)
                      }}
                    >
                      <div className="publisher-avatar">
                        <Image
                          src="/placeholder.svg?height=20&width=20"
                          alt={t("discover.anonymousPublisher")}
                          width={20}
                          height={20}
                        />
                      </div>
                      <span className="publisher-name">{t("discover.anonymousPublisher")}</span>
                    </div>

                    {/* Agent abilities */}
                    {agent.abilities && agent.abilities.length > 0 && (
                      <div className="agent-card-abilities">
                        {agent.abilities.slice(0, 2).map((ability) => (
                          <div key={ability.id} className="agent-card-ability">
                            <Zap size={12} />
                            <span>{ability.name}</span>
                          </div>
                        ))}
                        {agent.abilities.length > 2 && (
                          <div className="agent-card-ability more">
                            {t("discover.more").replace("{count}", String(agent.abilities.length - 2))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agent apps */}
                    {agent.apps && agent.apps.length > 0 && (
                      <div className="agent-card-apps">
                        {agent.apps.slice(0, 2).map((app) => (
                          <div key={app.id} className="agent-card-app">
                            <AppWindow size={12} />
                            <span>{app.name}</span>
                          </div>
                        ))}
                        {agent.apps.length > 2 && (
                          <div className="agent-card-app more">
                            {t("discover.more").replace("{count}", String(agent.apps.length - 2))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {onToggleContact && (
                    <button
                      type="button"
                      className={`agent-card-contact-button ${contactSet.has(agent.id) ? "added" : ""}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onToggleContact(agent.id)
                      }}
                    >
                      {contactSet.has(agent.id) ? t("discover.removeFromContacts") : t("discover.addToContacts")}
                    </button>
                  )}
                  <button className="agent-card-button" onClick={() => onSelectAgent(agent.id)}>
                    {t("discover.chatNow")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="discover-empty">
              <p>{t("discover.noAgentsFound")}</p>
              <button
                className="discover-reset-button"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory(null)
                  setShowMyAgents(false)
                }}
              >
                {t("discover.resetFilters")}
              </button>
            </div>
          )}
          </div>
        )}

        {/* All public agents section */}
        {!searchQuery && !selectedCategory && !showMyAgents && (
          <div className="discover-section">
          <h2 className="discover-section-title">{t("discover.allPublicAgents")}</h2>
          <div className="discover-grid">
            {filteredAgents.map((agent) => (
              <div key={agent.id} className="agent-card">
                {agent.isPublishedByUser && (
                  <div className="agent-card-badge featured">{t("discover.badge.myAgent")}</div>
                )}
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
                  <div className="agent-card-category">
                    {getAgentIcon(agent.category)}
                    <span>{agent.category}</span>
                  </div>
                  <h3 className="agent-card-title">{agent.name}</h3>
                  <p className="agent-card-description">{agent.shortDescription}</p>

                  {/* Publisher info - always show anonymous publisher for now */}
                  <div
                    className="agent-card-publisher"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPublisher(agent.publisherId)
                    }}
                  >
                    <div className="publisher-avatar">
                      <Image
                        src="/placeholder.svg?height=20&width=20"
                        alt={t("discover.anonymousPublisher")}
                        width={20}
                        height={20}
                      />
                    </div>
                    <span className="publisher-name">{t("discover.anonymousPublisher")}</span>
                  </div>
                </div>
                {onToggleContact && (
                  <button
                    type="button"
                    className={`agent-card-contact-button ${contactSet.has(agent.id) ? "added" : ""}`}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onToggleContact(agent.id)
                    }}
                  >
                    {contactSet.has(agent.id) ? t("discover.removeFromContacts") : t("discover.addToContacts")}
                  </button>
                )}
                <button className="agent-card-button" onClick={() => onSelectAgent(agent.id)}>
                  {t("discover.chatNow")}
                </button>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>
    </div>
  )
}
