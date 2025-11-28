"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Users, Sparkles, MessageSquare, Plus, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from "next/image"
import { ChatHistoryManager, type ChatSession } from '@/lib/chat-history'

interface ContactsPageProps {
  agents: any[]
  onSelectAgent: (agentId: string) => void
  onSelectConversation?: (session: ChatSession) => void
  onDiscoverAgents: () => void
  onBack: () => void
  currentAgentId?: string
}

// Helper function to get agent profile image
const getAgentProfileImage = (agentId: string, agents: any[]): string => {
  if (agentId === 'bbot' || agentId === 'b-bot') {
    return '/helpful-robot.png'
  }
  
  const agent = agents.find(a => a.id === agentId)
  return agent?.profileImage || '/helpful-robot.png'
}

export function ContactsPage({
  agents,
  onSelectAgent,
  onSelectConversation,
  onDiscoverAgents,
  onBack,
  currentAgentId
}: ContactsPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [allConversations, setAllConversations] = useState<ChatSession[]>([])
  const [filteredAgents, setFilteredAgents] = useState(agents)
  const [filteredConversations, setFilteredConversations] = useState<ChatSession[]>([])
  
  // Load all conversations on mount
  useEffect(() => {
    const sessions = ChatHistoryManager.getAllSessions()
    setAllConversations(sessions)
  }, [])
  
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
      setFilteredAgents(sortAgentsWithBBotFirst(agents))
      setFilteredConversations([])
      return
    }
    
    const query = searchQuery.toLowerCase()
    
    // Filter agents by name, description, or role
    const matchingAgents = agents.filter(agent => 
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
    setFilteredAgents(sortAgentsWithBBotFirst(matchingAgents))
    setFilteredConversations(matchingConversations)
  }, [searchQuery, agents, allConversations])
  
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
            <h1 className="text-xl font-semibold">Contacts</h1>
            <p className="text-sm text-muted-foreground">
              {agents.length} contact{agents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts and conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {agents.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No contacts yet</p>
              <p className="text-sm mb-6">Discover agents to start chatting</p>
              <Button
                onClick={onDiscoverAgents}
                className="mx-auto"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Discover Agents
              </Button>
            </div>
          ) : searchQuery && filteredAgents.length === 0 && filteredConversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Search className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No results found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Contacts Section */}
              {filteredAgents.length > 0 && (
                <div>
                  {searchQuery && (
                    <h2 className="text-sm font-semibold text-muted-foreground px-2 py-1">
                      CONTACTS ({filteredAgents.length})
                    </h2>
                  )}
                  <div className="space-y-1">
                    {filteredAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className={cn(
                          "flex items-center gap-4 p-4 hover:bg-muted cursor-pointer transition-colors rounded-lg border-b last:border-b-0",
                          agent.id === currentAgentId && "bg-primary/10"
                        )}
                        onClick={() => handleSelectAgent(agent.id)}
                      >
                        <div className="relative w-14 h-14 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          <Image
                            src={getAgentProfileImage(agent.id, agents)}
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
                        <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Conversations Section */}
              {searchQuery && filteredConversations.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground px-2 py-1">
                    CONVERSATIONS ({filteredConversations.length})
                  </h2>
                  <div className="space-y-1">
                    {filteredConversations.map((session) => {
                      const agent = agents.find(a => a.id === session.agentId)
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
                          <div className="relative w-14 h-14 rounded-full overflow-hidden bg-muted flex-shrink-0">
                            <Image
                              src={getAgentProfileImage(session.agentId, agents)}
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
                              {session.title || 'Untitled Chat'}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {session.lastMessage || 'No messages'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              with {agent?.name || session.agentId}
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
          Discover Agents
        </Button>
      </div>
    </div>
  )
}

