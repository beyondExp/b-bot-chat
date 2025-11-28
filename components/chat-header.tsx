"use client"

import { useState } from "react"
import { Menu, X, Sparkles, Phone, Video, MoreVertical, Search, ArrowLeft, Users, MessageSquare } from "lucide-react"
import { UserProfile } from "@/components/user-profile"
import { useAuth0 } from "@auth0/auth0-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"

interface ChatHeaderProps {
  onToggleSidebar: () => void
  isSidebarOpen: boolean
  onToggleDiscover: () => void
  onViewContacts: () => void
  onVoiceCall?: () => void
  onVideoCall?: () => void
  onSearchMessages?: () => void
  agentName?: string
  agentAvatar?: string
}

export function ChatHeader({ 
  onToggleSidebar, 
  isSidebarOpen, 
  onToggleDiscover,
  onViewContacts,
  onVoiceCall,
  onVideoCall,
  onSearchMessages,
  agentName = "B-Bot",
  agentAvatar = "/logo-black.svg"
}: ChatHeaderProps) {
  const { isAuthenticated, isLoading } = useAuth0()
  const [showDebugInfo, setShowDebugInfo] = useState(false)

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card h-16">
      <div className="flex items-center gap-3">
        {/* Back to Contacts Button (WhatsApp style) */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onViewContacts}
          className="rounded-full flex-shrink-0"
          aria-label="Back to contacts"
        >
          <ArrowLeft size={20} />
        </Button>
        
        {/* Conversations Drawer Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="rounded-full flex-shrink-0"
          aria-label="View conversations"
        >
          <MessageSquare size={20} />
        </Button>
        
        {/* Agent Info (WhatsApp Style) */}
        <div className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1 pr-3 rounded-lg transition-colors">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted border border-border">
            <Image 
              src={agentAvatar} 
              alt={agentName} 
              fill 
              className="object-cover dark:invert" 
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-none">{agentName}</span>
            <span className="text-xs text-muted-foreground mt-1">Online</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Call Actions - Only show if agent supports voice calls */}
        {(onVideoCall || onVoiceCall) && (
          <>
            {onVideoCall && (
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-primary hover:bg-muted" onClick={onVideoCall}>
                <Video size={22} />
              </Button>
            )}
            {onVoiceCall && (
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-primary hover:bg-muted" onClick={onVoiceCall}>
                <Phone size={20} />
              </Button>
            )}
            
            <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>
          </>
        )}

        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full text-muted-foreground hover:text-primary hover:bg-muted hidden sm:flex"
          onClick={onSearchMessages}
          aria-label="Search messages"
        >
          <Search size={20} />
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full text-muted-foreground hover:text-primary hover:bg-muted"
          onClick={onToggleDiscover}
        >
          <Sparkles size={20} />
        </Button>

        <div className="ml-2">
          <UserProfile />
        </div>
      </div>
    </header>
  )
}
