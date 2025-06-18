"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Trash2, MessageSquare } from 'lucide-react'
import { ChatSession, ChatHistoryManager } from '@/lib/chat-history'
import { cn } from '@/lib/utils'

interface ChatHistorySidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectChat: (session: ChatSession) => void
  currentThreadId?: string
  agentId: string
  userId?: string
}

export function ChatHistorySidebar({
  isOpen,
  onClose,
  onSelectChat,
  currentThreadId,
  agentId,
  userId
}: ChatHistorySidebarProps) {
  const [sessions, setSessions] = React.useState<ChatSession[]>([])

  // Load chat sessions on mount and when sidebar opens
  React.useEffect(() => {
    if (isOpen) {
      loadSessions()
    }
  }, [isOpen, agentId, userId])

  const loadSessions = () => {
    const allSessions = ChatHistoryManager.getChatSessions()
    // Filter sessions for current agent and user
    const filteredSessions = allSessions.filter(session => {
      const matchesAgent = session.agentId === agentId
      const matchesUser = userId ? session.userId === userId : !session.userId
      return matchesAgent && matchesUser
    })
    setSessions(filteredSessions)
  }

  const handleDeleteChat = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    ChatHistoryManager.deleteChatSession(sessionId)
    loadSessions()
  }

  const handleSelectChat = (session: ChatSession) => {
    onSelectChat(session)
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat History
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
          <div className="p-4">
            {sessions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No chat history yet</p>
                <p className="text-sm">Start a conversation to see your history</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative p-3 rounded-lg bg-white border border-gray-200 cursor-pointer transition-colors hover:bg-gray-50",
                      session.threadId === currentThreadId && "bg-blue-50 border-blue-300"
                    )}
                    onClick={() => handleSelectChat(session)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate mb-1">
                          {session.title}
                        </h4>
                        <p className="text-xs text-muted-foreground truncate mb-2">
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
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
} 