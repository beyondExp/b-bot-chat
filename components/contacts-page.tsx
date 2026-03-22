"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Users, Sparkles, MessageSquare, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from "next/image"
import { ChatHistoryManager, type ChatSession } from '@/lib/chat-history'
import { useI18n } from "@/lib/i18n"
import { ThreadService, type Thread } from "@/lib/thread-service"
import { isLocallyAuthenticated, getAuthToken, LANGGRAPH_AUDIENCE } from "@/lib/api"
import { useAppAuth } from "@/lib/app-auth"

interface ContactsPageProps {
  contacts: any[]
  allAgents: any[]
  onSelectAgent: (agentId: string) => void
  onSelectConversation?: (session: ChatSession) => void
  onDiscoverAgents: () => void
  onBack: () => void
  currentAgentId?: string
  onRemoveContact?: (agentId: string) => void
}

// Helper function to get agent profile image
const getAgentProfileImage = (agentId: string, agents: any[]): string => {
  if (agentId === 'bbot' || agentId === 'b-bot') {
    return agents.find(a => a.id === agentId)?.profileImage || 'https://beyond-bot.ai/logo-schwarz.svg'
  }
  
  const agent = agents.find(a => a.id === agentId)
  return agent?.profileImage || '/helpful-robot.png'
}

export function ContactsPage({
  contacts,
  allAgents,
  onSelectAgent,
  onSelectConversation,
  onDiscoverAgents,
  onBack,
  currentAgentId,
  onRemoveContact
}: ContactsPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [allConversations, setAllConversations] = useState<ChatSession[]>([])
  const [filteredContacts, setFilteredContacts] = useState(contacts)
  const [filteredConversations, setFilteredConversations] = useState<ChatSession[]>([])
  const { t } = useI18n()
  const { isAuthenticated, getAccessTokenSilently, user } = useAppAuth()

  const getAuthTokenForService = async (): Promise<string | null> => {
    try {
      if (isAuthenticated) {
        return await getAccessTokenSilently({
          authorizationParams: {
            audience: LANGGRAPH_AUDIENCE,
          },
        })
      }
      if (isLocallyAuthenticated()) {
        return getAuthToken()
      }
      return null
    } catch (error) {
      console.error("Failed to get auth token:", error)
      return null
    }
  }

  const threadService = new ThreadService(getAuthTokenForService)

  const convertThreadToChatSession = (thread: Thread): ChatSession => {
    const agentId = (thread.metadata as any)?.assistant_id || thread.config?.configurable?.agent_id || "bbot"
    const threadUserId = (thread.metadata as any)?.owner || thread.config?.configurable?.user_id || user?.sub
    const title = (thread.metadata as any)?.title || `Chat ${String(thread.thread_id).slice(-8)}`
    return {
      id: thread.thread_id,
      threadId: thread.thread_id,
      agentId,
      userId: threadUserId,
      title,
      lastMessage: (thread.metadata as any)?.lastMessage || t("contacts.noMessages"),
      timestamp: new Date(thread.updated_at).getTime(),
    }
  }
  
  // Load all conversations on mount
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Prefer server threads for authenticated/local-auth users so history survives storage clearing.
        const hasUser = Boolean(user?.sub) || isLocallyAuthenticated()
        if (hasUser) {
          const threads = await threadService.getThreads()
          if (mounted && Array.isArray(threads) && threads.length > 0) {
            setAllConversations(threads.map(convertThreadToChatSession))
            return
          }
        }
      } catch (e) {
        console.warn("[ContactsPage] Failed to load threads from server; falling back to local history", e)
      }
      if (mounted) {
        setAllConversations(ChatHistoryManager.getAllSessions())
      }
    })()
    return () => {
      mounted = false
    }
  }, [user?.sub])
  
  // Helper function to sort agents with B-Bot at the top
  const sortAgentsWithBBotFirst = (agentList: any[]) => {
    return [...agentList].sort((a, b) => {
      const aIsBBot = a.id === 'bbot' || a.id === 'b-bot' || a.name?.toLowerCase() === 'b-bot'
      const bIsBBot = b.id === 'bbot' || b.id === 'b-bot' || b.name?.toLowerCase() === 'b-bot'
      
      if (aIsBBot && !bIsBBot) return -1
      if (!aIsBBot && bIsBBot) return 1
      
      // If neither or both are B-Bot, sort alphabetically by name
      return (a.name || '').localeCompare(b.name || '')
    })
  }
  
  // Filter agents and conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      // No search query - show all agents sorted with B-Bot first
      setFilteredContacts(sortAgentsWithBBotFirst(contacts))
      setFilteredConversations([])
      return
    }
    
    const query = searchQuery.toLowerCase()
    
    // Filter agents by name, description, or role
    const matchingAgents = contacts.filter(agent => 
      agent.name?.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query) ||
      agent.role?.toLowerCase().includes(query)
    )
    
    // Filter conversations by title or lastMessage
    const matchingConversations = allConversations.filter(session =>
      session.title?.toLowerCase().includes(query) ||
      session.lastMessage?.toLowerCase().includes(query)
    )
    
    // Sort matching agents with B-Bot first
    setFilteredContacts(sortAgentsWithBBotFirst(matchingAgents))
    setFilteredConversations(matchingConversations)
  }, [searchQuery, contacts, allConversations])
  
  const handleSelectAgent = (agentId: string) => {
    onSelectAgent(agentId)
    onBack() // Navigate back to chat view after selecting agent
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{t("contacts.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("contacts.count")
                .replace("{count}", String(contacts.length))
                .replace("{plural}", contacts.length === 1 ? "" : "s")}
            </p>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("contacts.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("contacts.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {contacts.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">{t("contacts.noContactsYet")}</p>
              <p className="text-sm mb-6">{t("contacts.discoverToStart")}</p>
              <Button
                onClick={onDiscoverAgents}
                className="mx-auto"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t("contacts.discoverAgents")}
              </Button>
            </div>
          ) : searchQuery && filteredContacts.length === 0 && filteredConversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">{t("contacts.noResultsFound")}</p>
              <p className="text-sm">{t("contacts.tryDifferentSearch")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contacts Section */}
              {filteredContacts.length > 0 && (
                <div>
                  {searchQuery && (
                    <h2 className="text-sm font-semibold text-muted-foreground px-2 py-1">
                      {t("contacts.section.contacts").replace("{count}", String(filteredContacts.length))}
                    </h2>
                  )}
                  <div className="space-y-1">
                    {filteredContacts.map((agent) => (
                      <div
                        key={agent.id}
                        className={cn(
                          "flex items-center gap-4 p-4 hover:bg-muted cursor-pointer transition-colors rounded-lg border-b last:border-b-0",
                          agent.id === currentAgentId && "bg-primary/10"
                        )}
                        onClick={() => handleSelectAgent(agent.id)}
                      >
                        <div className="relative w-14 h-14 rounded-[1rem] overflow-hidden bg-muted flex-shrink-0">
                          <Image
                            src={getAgentProfileImage(agent.id, allAgents)}
                            alt={agent.name}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = '/helpful-robot.png'
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold truncate">
                            {agent.name}
                          </h3>
                          {agent.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {agent.description}
                            </p>
                          )}
                          {agent.role && (
                            <p className="text-xs text-muted-foreground truncate">
                              {agent.role}
                            </p>
                          )}
                        </div>
                        {onRemoveContact ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            aria-label={t("contacts.removeFromContacts")}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              onRemoveContact(agent.id)
                            }}
                          >
                            <X className="h-5 w-5 text-muted-foreground" />
                          </Button>
                        ) : (
                          <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Conversations Section */}
              {searchQuery && filteredConversations.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground px-2 py-1">
                    {t("contacts.section.conversations").replace("{count}", String(filteredConversations.length))}
                  </h2>
                  <div className="space-y-1">
                    {filteredConversations.map((session) => {
                      const agent = allAgents.find(a => a.id === session.agentId)
                      return (
                        <div
                          key={session.id}
                          className="flex items-center gap-4 p-4 hover:bg-muted cursor-pointer transition-colors rounded-lg border-b last:border-b-0"
                          onClick={() => {
                            if (onSelectConversation) {
                              onSelectConversation(session)
                            } else {
                              handleSelectAgent(session.agentId)
                            }
                          }}
                        >
                          <div className="relative w-14 h-14 rounded-[1rem] overflow-hidden bg-muted flex-shrink-0">
                            <Image
                              src={getAgentProfileImage(session.agentId, allAgents)}
                              alt={agent?.name || 'Agent'}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = '/helpful-robot.png'
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold truncate">
                              {session.title || t("contacts.untitledChat")}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {session.lastMessage || t("contacts.noMessages")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("contacts.with").replace("{name}", agent?.name || session.agentId)}
                            </p>
                          </div>
                          <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Action Buttons */}
      <div className="p-4 border-t bg-background space-y-2">
        <Button
          onClick={onDiscoverAgents}
          className="w-full flex items-center gap-2"
          variant="default"
        >
          <Sparkles className="h-4 w-4" />
          {t("contacts.discoverAgents")}
        </Button>
      </div>
    </div>
  )
}

