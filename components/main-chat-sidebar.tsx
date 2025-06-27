"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Trash2, MessageSquare, Bot, Sparkles, ChevronDown, ChevronRight, Users, Plus } from 'lucide-react'
import { ChatSession, ChatHistoryManager } from '@/lib/chat-history'
import { cn } from '@/lib/utils'
import { ThreadService, type Thread } from "@/lib/thread-service"
import { useAuth0 } from "@auth0/auth0-react"
import { isLocallyAuthenticated, getAuthToken, LANGGRAPH_AUDIENCE } from "@/lib/api"
import Image from "next/image"

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
  onNewChat: () => void
  currentThreadId?: string
  currentAgentId: string
  userId?: string
  agents: any[]
  embedId?: string
}

// Helper function to extract content from message
const getMessageContent = (content: any): string => {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const textBlocks = content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
    return textBlocks.join(' ')
  }
  return ''
}

// Helper function to extract first user message for better chat titles
const getFirstUserMessage = (thread: any): string => {
  if (!thread.values?.messages || !Array.isArray(thread.values.messages)) {
    return ''
  }
  
  const firstHumanMessage = thread.values.messages.find(
    (msg: any) => msg.type === 'human'
  )
  
  if (firstHumanMessage) {
    const content = getMessageContent(firstHumanMessage.content)
    // Return first 50 characters for title
    return content.length > 50 ? content.substring(0, 50) + '...' : content
  }
  
  return ''
}

// Helper function to get agent profile image
const getAgentProfileImage = (agentId: string, agents: any[]): string => {
  if (agentId === 'bbot' || agentId === 'b-bot') {
    return '/helpful-robot.png'
  }
  
  const agent = agents.find(a => a.id === agentId)
  return agent?.profileImage || '/helpful-robot.png'
}

// Helper function to get agent name
const getAgentName = (agentId: string, agents: any[]): string => {
  if (agentId === 'bbot' || agentId === 'b-bot') {
    return 'B-Bot'
  }
  
  const agent = agents.find(a => a.id === agentId)
  return agent?.name || agentId
}

export function MainChatSidebar({
  isOpen,
  onClose,
  onSelectChat,
  onSelectAgent,
  onDiscoverAgents,
  onNewChat,
  currentThreadId,
  currentAgentId,
  userId,
  agents,
  embedId
}: MainChatSidebarProps) {
  const [agentsWithChats, setAgentsWithChats] = useState<AgentWithChats[]>([])
  const { isAuthenticated, getAccessTokenSilently } = useAuth0()

  // Initialize thread service with auth token getter
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
      console.error('Failed to get auth token:', error)
      return null
    }
  }

  const threadService = new ThreadService(getAuthTokenForService)

  // Convert Thread to ChatSession format
  const convertThreadToChatSession = (thread: Thread): ChatSession => {
    // Extract agent ID from metadata.assistant_id (primary) or config.configurable.agent_id (fallback)
    const agentId = thread.metadata?.assistant_id || thread.config?.configurable?.agent_id || 'bbot'
    
    // Extract user ID from metadata.owner (primary) or config.configurable.user_id (fallback)
    const threadUserId = thread.metadata?.owner || thread.config?.configurable?.user_id || userId
    
    // Get better title from first user message
    const firstUserMessage = getFirstUserMessage(thread)
    const title = firstUserMessage || thread.metadata?.title || `Chat ${thread.thread_id.slice(-8)}`
    
    console.log('[MainChatSidebar] Converting thread:', {
      threadId: thread.thread_id,
      agentId,
      threadUserId,
      title,
      metadata: thread.metadata
    })
    
    return {
      id: thread.thread_id,
      threadId: thread.thread_id,
      agentId,
      userId: threadUserId,
      title,
      lastMessage: thread.metadata?.lastMessage || 'New conversation',
      timestamp: new Date(thread.updated_at).getTime()
    }
  }

  // Load data when sidebar opens
  useEffect(() => {
    if (isOpen) {
      loadAgentsWithChats()
    }
  }, [isOpen, userId, embedId])

  const loadAgentsWithChats = async () => {
    try {
      console.log('[MainChatSidebar] Loading threads from server...')
      console.log('[MainChatSidebar] Using userId:', userId)
      console.log('[MainChatSidebar] Available agents:', agents)
      
      // For anonymous users, directly use local storage
      if (!userId) {
        console.log('[MainChatSidebar] No userId (anonymous user), using local storage')
        loadAgentsWithChatsFromLocal()
        return
      }
      
      // Fetch threads from LangGraph via ThreadService
      const threads = await threadService.getThreads(userId)
      console.log('[MainChatSidebar] Received threads:', threads)
      
      // Check if we got valid threads
      if (!threads || threads.length === 0) {
        console.log('[MainChatSidebar] No threads from server, falling back to local storage')
        loadAgentsWithChatsFromLocal()
        return
      }
      
      // Convert threads to ChatSession format
      const sessions = threads.map(convertThreadToChatSession)
      console.log('[MainChatSidebar] Converted to sessions:', sessions)
      
      // Group sessions by agent
      const agentGroups = new Map<string, ChatSession[]>()
      
      sessions.forEach(session => {
        const agentId = session.agentId
        if (!agentGroups.has(agentId)) {
          agentGroups.set(agentId, [])
        }
        agentGroups.get(agentId)!.push(session)
      })

      // Sort sessions within each agent by timestamp (newest first)
      agentGroups.forEach((sessions, agentId) => {
        sessions.sort((a, b) => b.timestamp - a.timestamp)
      })

      // Convert to AgentWithChats array and sort by most recent activity
      const result: AgentWithChats[] = Array.from(agentGroups.entries()).map(([agentId, sessions]) => {        
        const agentName = getAgentName(agentId, agents)
        const agentIcon = getAgentProfileImage(agentId, agents)
        console.log('[MainChatSidebar] Processing agent:', { agentId, agentName, agentIcon, sessionsCount: sessions.length })
        
        return {
          agentId,
          agentName,
          agentIcon,
          sessions,
          showAll: false
        }
      }).sort((a, b) => {
        const aLatest = a.sessions[0]?.timestamp || 0
        const bLatest = b.sessions[0]?.timestamp || 0
        return bLatest - aLatest
      })

      console.log('[MainChatSidebar] Final result:', result)
      setAgentsWithChats(result)
    } catch (error) {
      console.error('[MainChatSidebar] Error loading threads:', error)
      console.log('[MainChatSidebar] API failed, falling back to local storage')
      // Fallback to local storage if server fails
      loadAgentsWithChatsFromLocal()
    }
  }

  // Fallback method using local storage
  const loadAgentsWithChatsFromLocal = () => {
    console.log('[MainChatSidebar] Loading from local storage for userId:', userId)
    const allSessions = ChatHistoryManager.getChatSessions(embedId)
    console.log('[MainChatSidebar] All local sessions:', allSessions)
    
    // Filter sessions for current user (including anonymous users)
    const userSessions = allSessions.filter(session => {
      const matchesUser = userId ? session.userId === userId : (!session.userId || session.userId === "anonymous-user")
      console.log('[MainChatSidebar] Session:', session.id, 'userId:', session.userId, 'matches:', matchesUser)
      return matchesUser
    })
    console.log('[MainChatSidebar] Filtered user sessions:', userSessions)

    // Group sessions by agent
    const agentGroups = new Map<string, ChatSession[]>()
    
    userSessions.forEach(session => {
      const agentId = session.agentId
      if (!agentGroups.has(agentId)) {
        agentGroups.set(agentId, [])
      }
      agentGroups.get(agentId)!.push(session)
    })

    // Sort sessions within each agent by timestamp (newest first)
    agentGroups.forEach((sessions, agentId) => {
      sessions.sort((a, b) => b.timestamp - a.timestamp)
    })

    // Convert to AgentWithChats array and sort by most recent activity
    const result: AgentWithChats[] = Array.from(agentGroups.entries()).map(([agentId, sessions]) => {
      const agent = agents.find(a => a.id === agentId)
      
      return {
        agentId,
        agentName: getAgentName(agentId, agents),
        agentIcon: getAgentProfileImage(agentId, agents),
        sessions,
        showAll: false
      }
    }).sort((a, b) => {
      const aLatest = a.sessions[0]?.timestamp || 0
      const bLatest = b.sessions[0]?.timestamp || 0
      return bLatest - aLatest
    })

    setAgentsWithChats(result)
  }

  const handleDeleteChat = async (sessionId: string) => {
    try {
      // Try to delete from server first
      const success = await threadService.deleteThread(sessionId)
      if (success) {
        console.log('[MainChatSidebar] Deleted thread from server:', sessionId)
      } else {
        console.warn('[MainChatSidebar] Failed to delete thread from server, deleting locally')
      }
    } catch (error) {
      console.error('[MainChatSidebar] Error deleting thread:', error)
    }
    
    // Always delete from local storage as well
    ChatHistoryManager.deleteChatSession(sessionId, embedId)
    
    // Refresh the list
    loadAgentsWithChats()
  }

  const handleSelectChat = (session: ChatSession) => {
    console.log('[MainChatSidebar] Chat selected:', session)
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
          <SheetDescription>
            Browse your chat history organized by agent
          </SheetDescription>
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
                            "flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors flex-1 text-left",
                            agentData.agentId === currentAgentId && "bg-primary/10 text-primary"
                          )}
                        >
                          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                            <Image
                              src={agentData.agentIcon || '/helpful-robot.png'}
                              alt={agentData.agentName}
                              fill
                              className="object-cover"
                              onError={(e) => {
                                // Fallback to default image on error
                                const target = e.target as HTMLImageElement
                                target.src = '/helpful-robot.png'
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{agentData.agentName}</span>
                            <span className="text-xs text-muted-foreground">
                              {agentData.sessions.length} conversation{agentData.sessions.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </button>
                      </div>

                      {/* Chat Sessions */}
                      <div className="ml-4 space-y-1">
                        {visibleSessions.map((session) => (
                          <div
                            key={session.id}
                            className={cn(
                              "group relative p-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors",
                              session.threadId === currentThreadId && "bg-primary/20 border border-primary/30"
                            )}
                            onClick={() => handleSelectChat(session)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium line-clamp-2 leading-tight mb-1">
                                  {session.title}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate">
                                  {session.lastMessage}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(session.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteChat(session.id)
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        {/* Show More/Less Button */}
                        {agentData.sessions.length > 5 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => toggleShowAll(agentData.agentId)}
                          >
                            {agentData.showAll 
                              ? 'Show less' 
                              : `Show ${agentData.sessions.length - 5} more`}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="p-4 border-t bg-background space-y-2">
          <Button
            onClick={() => {
              onNewChat()
              onClose()
            }}
            className="w-full flex items-center gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
          <Button
            onClick={handleDiscoverAgents}
            className="w-full flex items-center gap-2"
            variant="default"
          >
            <Users className="h-4 w-4" />
            Discover Agents
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
} 