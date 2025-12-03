"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Trash2, MessageSquare, Plus, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
    return 'https://beyond-bot.ai/logo-schwarz.svg'
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
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
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
      setIsLoading(true)
      console.log('[MainChatSidebar] Loading threads from server...')
      console.log('[MainChatSidebar] Using userId:', userId)
      console.log('[MainChatSidebar] Available agents:', agents)
      
      // For anonymous users, directly use local storage
      if (!userId) {
        console.log('[MainChatSidebar] No userId (anonymous user), using local storage')
        loadAgentsWithChatsFromLocal()
        setIsLoading(false)
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
    } finally {
      setIsLoading(false)
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


  // Get current agent's chats
  const currentAgentData = agentsWithChats.find(a => a.agentId === currentAgentId)
  const allCurrentAgentSessions = currentAgentData?.sessions || []
  const currentAgentName = currentAgentData?.agentName || getAgentName(currentAgentId, agents)
  
  // Filter sessions based on search query
  const currentAgentSessions = allCurrentAgentSessions.filter(session => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    const title = session.title?.toLowerCase() || ''
    const lastMessage = session.lastMessage?.toLowerCase() || ''
    
    return title.includes(query) || lastMessage.includes(query)
  })

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b space-y-3">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {currentAgentName}
          </SheetTitle>
          <SheetDescription>
            Your conversations with this agent
          </SheetDescription>
          
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
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
        </SheetHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-2">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="flex items-center justify-center mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
                <p>Loading conversations...</p>
              </div>
            ) : currentAgentSessions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {searchQuery ? (
                  <>
                    <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations found</p>
                    <p className="text-sm">Try a different search term</p>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No conversations yet</p>
                    <p className="text-sm">Start a new chat to begin</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {currentAgentSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors border-b last:border-b-0",
                      session.threadId === currentThreadId && "bg-primary/10"
                    )}
                    onClick={() => handleSelectChat(session)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold truncate">
                            {session.title}
                          </h4>
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                            {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
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
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
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
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="p-3 border-t bg-background">
          <Button
            onClick={() => {
              onNewChat()
              onClose()
            }}
            className="w-full flex items-center gap-2"
            variant="default"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
} 