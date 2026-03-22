"use client"

import { useState } from "react"
import { Phone, Search, ArrowLeft, MessageSquare, LayoutDashboard } from "lucide-react"
import { UserProfile } from "@/components/user-profile"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { AgentInfoModal } from "@/components/agent-info-modal"
import { useI18n } from "@/lib/i18n"

interface ChatHeaderProps {
  onToggleSidebar: () => void
  isSidebarOpen: boolean
  onToggleDiscover: () => void
  onViewContacts: () => void
  onVoiceCall?: () => void
  onSearchMessages?: () => void
  onOpenWorkdesk?: () => void
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
  onSearchMessages,
  onOpenWorkdesk,
  agentName = "B-Bot",
  agentAvatar = "/logo-black.svg",
  agentData,
  hasMessages = false
}: ChatHeaderProps) {
  const [showDebugInfo, setShowDebugInfo] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const { t } = useI18n()

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
            aria-label={t("header.backToContacts")}
          >
            <ArrowLeft size={20} />
          </Button>
          
          {/* Conversations Drawer Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="rounded-full flex-shrink-0"
            aria-label={t("header.viewConversations")}
          >
            <MessageSquare size={20} />
          </Button>

          {/* Agent Info (WhatsApp Style - Desktop Only) */}
          <div 
            className="hidden md:flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-1 pr-3 rounded-lg transition-colors"
            onClick={() => setShowInfoModal(true)}
          >
            <div className="relative w-10 h-10 rounded-[1rem] overflow-hidden bg-muted border border-border">
              <Image 
                src={agentAvatar} 
                alt={agentName} 
                fill 
                className="object-cover dark:invert" 
              />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm leading-none">{agentName}</span>
              <span className="text-xs text-muted-foreground mt-1">{t("header.online")}</span>
            </div>
          </div>
        </div>
        
        {/* Center Section: Agent Avatar (Mobile Only - Absolute Centered) */}
        {hasMessages && (
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 md:hidden">
            <button 
              onClick={() => setShowInfoModal(true)}
              className="relative w-10 h-10 rounded-[1rem] overflow-hidden bg-muted border border-border hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer animate-in fade-in zoom-in duration-300"
              title={t("header.viewAgentInfo")}
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
          {onOpenWorkdesk && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-primary hover:bg-muted"
              onClick={onOpenWorkdesk}
              aria-label={t("workdesk.open")}
              title={t("workdesk.open")}
            >
              <LayoutDashboard size={20} />
            </Button>
          )}

          {/* Call Actions */}
          {onVoiceCall && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground hover:text-primary hover:bg-muted"
              onClick={onVoiceCall}
              aria-label={t("common.voiceCall")}
            >
              <Phone size={20} />
            </Button>
          )}

          <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>

          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full text-muted-foreground hover:text-primary hover:bg-muted hidden sm:flex"
            onClick={onSearchMessages}
            aria-label={t("header.searchMessages")}
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
