"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Plus, History, Bot } from 'lucide-react'

interface EmbedChatHeaderProps {
  agentName?: string
  onNewChat: () => void
  onShowHistory: () => void
}

export function EmbedChatHeader({
  agentName,
  onNewChat,
  onShowHistory
}: EmbedChatHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h1 className="font-semibold text-lg">
          {agentName || 'Chat Assistant'}
        </h1>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onShowHistory}
          className="gap-2"
        >
          <History className="h-4 w-4" />
          History
        </Button>
        
        <Button
          variant="default"
          size="sm"
          onClick={onNewChat}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
    </div>
  )
} 