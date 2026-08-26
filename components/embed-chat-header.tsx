"use client"

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, History, Bot } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { useI18n } from "@/lib/i18n"

interface EmbedChatHeaderProps {
  agentName?: string
  onNewChat: () => void
  onShowHistory: () => void
  userColor?: string
  headerIcon?: string
  /** Expert / channel profile image URL. Preferred over Lucide headerIcon when set. */
  profileImage?: string | null
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

function isUsableProfileImage(url?: string | null): url is string {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.includes('placeholder.svg')) return false
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true
  if (trimmed.startsWith('/')) return true
  return false
}

export function EmbedChatHeader({
  agentName,
  onNewChat,
  onShowHistory,
  userColor = '#2563eb',
  headerIcon = 'bot',
  profileImage = null,
}: EmbedChatHeaderProps) {
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    setAvatarFailed(false)
  }, [profileImage])

  // Get the icon component dynamically from Lucide
  const getIconComponent = (iconName: string) => {
    if (!iconName) return Bot;
    
    // Convert kebab-case to PascalCase (e.g., 'message-circle' -> 'MessageCircle')
    const iconKey = iconName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    
    // Get the icon from lucide-react
    const IconComponent = (LucideIcons as any)[iconKey];
    return IconComponent || Bot; // Fallback to Bot if icon not found
  };
  
  const IconComponent = getIconComponent(headerIcon);
  const showAvatar = !avatarFailed && isUsableProfileImage(profileImage);
  
  return (
    <div className="embed-header flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {showAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profileImage}
            alt=""
            className="h-7 w-7 rounded-full object-cover flex-shrink-0"
            style={{ boxShadow: `0 0 0 1.5px ${userColor}33` }}
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <IconComponent 
            className="h-5 w-5 flex-shrink-0" 
            style={{ color: userColor }}
          />
        )}
        <h1 className="font-semibold text-lg truncate">
          {agentName || 'Chat Assistant'}
        </h1>
      </div>
      
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outlinePrimary"
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

const HUB_SIGNUP =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_HUB_URL
    ? process.env.NEXT_PUBLIC_HUB_URL.replace(/\/+$/, "")
    : "https://hub.beyond-bot.ch") +
  "/?utm_source=embed&utm_medium=referral&utm_campaign=builtwith"

export function EmbedPoweredBy({ hidden }: { hidden?: boolean }) {
  const { t } = useI18n()
  if (hidden) return null
  return (
    <a
      href={HUB_SIGNUP}
      target="_blank"
      rel="noopener noreferrer"
      className="embed-powered-by flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-background/95 px-3 py-1.5 text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      {t("embed.builtWith")} <span className="font-medium">Beyond-Bot.ai</span>
    </a>
  )
}
