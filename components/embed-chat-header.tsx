"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { Plus, History, Bot } from 'lucide-react'

interface EmbedChatHeaderProps {
  agentName?: string
  onNewChat: () => void
  onShowHistory: () => void
  userColor?: string
}

// Helper to determine readable text color
function getContrastYIQ(hexcolor: string) {
  hexcolor = hexcolor.replace('#', '');
  if (hexcolor.length === 3) {
    hexcolor = hexcolor.split('').map(x => x + x).join('');
  }
  const r = parseInt(hexcolor.substr(0,2),16);
  const g = parseInt(hexcolor.substr(2,2),16);
  const b = parseInt(hexcolor.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? '#000' : '#fff';
}

export function EmbedChatHeader({
  agentName,
  onNewChat,
  onShowHistory,
  userColor = '#2563eb'
}: EmbedChatHeaderProps) {
  return (
    <div className="embed-header flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
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
          className="gap-2 hidden"
        >
          <History className="h-4 w-4" />
          History
        </Button>
        
        <Button
          size="sm"
          onClick={onNewChat}
          className="gap-2 border-0"
          style={{ 
            backgroundColor: userColor, 
            color: getContrastYIQ(userColor),
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>
    </div>
  )
} 