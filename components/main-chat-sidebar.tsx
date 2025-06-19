"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Trash2, MessageSquare, Bot, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { ChatSession, ChatHistoryManager } from '@/lib/chat-history'
import { cn } from '@/lib/utils'

interface AgentWithChats {
  agentId: string
  agentName: string
  agentIcon?: string
  sessions: ChatSession[]
  showAll: boolean
}

interface MainChatSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectChat: (session: ChatSession) => void
  onSelectAgent: (agentId: string) => void
  onDiscoverAgents: () => void
  currentThreadId?: string
  currentAgentId: string
  userId?: string
  agents: any[]
}

export function MainChatSidebar({
  isOpen,
  onClose,
  onSelectChat,
  onSelectAgent,
  onDiscoverAgents,
  currentThreadId,
  currentAgentId,
  userId,
  agents
}: MainChatSidebarProps) {
  const [agentsWithChats, setAgentsWithChats] = useState<AgentWithChats[]>([])

  // Load all chat sessions and group by agent
  useEffect(() => {
    if (isOpen) {
      loadAgentsWithChats()
    }
  }, [isOpen, userId, agents])

  const loadAgentsWithChats = () => {
    const allSessions = ChatHistoryManager.getChatSessions()
    
    // Filter sessions for current user
    const userSessions = allSessions.filter(session => {
      const matchesUser = userId ? session.userId === userId : !session.userId
      return matchesUser
    })

    // Group sessions by agent
    const agentGroups = new Map<string, ChatSession[]>()
    
    userSessions.forEach(session => {
      const agentId = session.agentId
      if (!agentGroups.has(agentId)) {
        agentGroups.set(agentId, [])
      }
      agentGroups.get(agentId)!.push(session)
    })

    // Sort sessions by timestamp (newest first) for each agent
    agentGroups.forEach(sessions => {
      sessions.sort((a, b) => b.timestamp - a.timestamp)
    })

    // Create AgentWithChats objects
    const agentsWithChatsData: AgentWithChats[] = []
    
    agentGroups.forEach((sessions, agentId) => {
      const agent = agents.find(a => a.id === agentId)
      const agentName = agent?.name || agentId
      
      agentsWithChatsData.push({
        agentId,
        agentName,
        agentIcon: agent?.icon,
        sessions,
        showAll: false
      })
    })

    // Sort agents by most recent conversation
    agentsWithChatsData.sort((a, b) => {
      const aLatest = a.sessions[0]?.timestamp || 0
      const bLatest = b.sessions[0]?.timestamp || 0
      return bLatest - aLatest
    })

    setAgentsWithChats(agentsWithChatsData)
  }

  const handleDeleteChat = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    ChatHistoryManager.deleteChatSession(sessionId)
    loadAgentsWithChats()
  }

  const handleSelectChat = (session: ChatSession) => {
    onSelectChat(session)
    onClose()
  }

  const handleSelectAgent = (agentId: string) => {
    onSelectAgent(agentId)
    onClose()
  }

  const toggleShowAll = (agentId: string) => {
    setAgentsWithChats(prev => 
      prev.map(agent => 
        agent.agentId === agentId 
          ? { ...agent, showAll: !agent.showAll }
          : agent
      )
    )
  }

  const handleDiscoverAgents = () => {
    onDiscoverAgents()
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Your Conversations
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-4">
            {agentsWithChats.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-sm">Start chatting to see your history</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agentsWithChats.map((agentData) => {
                  const visibleSessions = agentData.showAll 
                    ? agentData.sessions 
                    : agentData.sessions.slice(0, 5)
                  
                  return (
                    <div key={agentData.agentId} className="space-y-2">
                      {/* Agent Header */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleSelectAgent(agentData.agentId)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors flex-1 text-left",
                            agentData.agentId === currentAgentId && "bg-primary/10 text-primary"
                          )}
                        >
                          <Bot className="h-4 w-4" />
                          <span className="font-medium truncate">{agentData.agentName}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {agentData.sessions.length}
                          </span>
                        </button>
                      </div>

                      {/* Chat Sessions */}
                      <div className="ml-4 space-y-1">
                        {visibleSessions.map((session) => (
                          <div
                            key={session.id}
                            className={cn(
                              "group relative p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors",
                              session.threadId === currentThreadId && "bg-primary/20 border border-primary/30"
                            )}
                            onClick={() => handleSelectChat(session)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate mb-1">
                                  {session.title}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate mb-1">
                                  {session.lastMessage}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {ChatHistoryManager.formatTimestamp(session.timestamp)}
                                </p>
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleDeleteChat(session.id, e)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        {/* Show More Button */}
                        {agentData.sessions.length > 5 && (
                          <button
                            onClick={() => toggleShowAll(agentData.agentId)}
                            className="flex items-center gap-1 p-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {agentData.showAll ? (
                              <>
                                <ChevronDown className="h-3 w-3" />
                                Show less
                              </>
                            ) : (
                              <>
                                <ChevronRight className="h-3 w-3" />
                                Show {agentData.sessions.length - 5} more
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Discover Agents Button */}
        <div className="p-4 border-t bg-background">
          <Button
            onClick={handleDiscoverAgents}
            className="w-full flex items-center gap-2"
            variant="default"
          >
            <Sparkles className="h-4 w-4" />
            Discover Agents
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
} 