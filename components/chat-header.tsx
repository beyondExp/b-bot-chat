"use client"

import { useState } from "react"
import { Menu, X, Sparkles, Phone, Video, MoreVertical, Search, ArrowLeft, Users, MessageSquare } from "lucide-react"
import { UserProfile } from "@/components/user-profile"
import { useAuth0 } from "@auth0/auth0-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { AgentInfoModal } from "@/components/agent-info-modal"

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
  agentData?: any
  hasMessages?: boolean
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
  agentAvatar = "/logo-black.svg",
  agentData,
  hasMessages = false
}: ChatHeaderProps) {
  const { isAuthenticated, isLoading } = useAuth0()
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)

  return (
    <>
      <header className="w-full flex items-center justify-between px-4 py-2 border-b border-border bg-card h-16 relative">
        {/* Left Section: Navigation and Agent Info (Desktop) */}
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

          {/* Agent Info (WhatsApp Style - Desktop Only) */}
          <div 
            className="hidden md:flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1 pr-3 rounded-lg transition-colors"
            onClick={() => setShowInfoModal(true)}
          >
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
        
        {/* Center Section: Agent Avatar (Mobile Only - Absolute Centered) */}
        {hasMessages && (
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 md:hidden">
            <button 
              onClick={() => setShowInfoModal(true)}
              className="relative w-10 h-10 rounded-full overflow-hidden bg-muted border border-border hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer animate-in fade-in zoom-in duration-300"
              title="View Agent Info"
            >
              <Image 
                src={agentAvatar} 
                alt={agentName} 
                fill 
                className="object-cover dark:invert" 
              />
            </button>
          </div>
        )}

        {/* Right Section: Actions */}
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

          <div className="ml-2">
            <UserProfile />
          </div>
        </div>
      </header>

      <AgentInfoModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
        agent={agentData || { name: agentName, profileImage: agentAvatar }}
      />
    </>
  )
}
