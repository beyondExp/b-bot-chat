"use client"

import { MoonIcon, SunIcon, MenuIcon, CompassIcon, ExternalLink, RefreshCwIcon } from "lucide-react"
import { useTheme } from "next-themes"
import Image from "next/image"
import { UserProfile } from "./user-profile"
import { useState, useEffect } from "react"
import { refreshCache } from "@/lib/refresh-cache"

interface ChatHeaderProps {
  selectedAgent: string | null
  toggleSidebar: () => void
  onOpenDiscover: () => void
}

export function ChatHeader({ selectedAgent, toggleSidebar, onOpenDiscover }: ChatHeaderProps) {
  const { theme, setTheme } = useTheme()
  const [showPWAGuide, setShowPWAGuide] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Check if app is installed
  useEffect(() => {
    if (typeof window === "undefined") return

    // Check if in standalone mode (already installed)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      localStorage.getItem("pwa-installed") === "true"
    ) {
      setIsInstalled(true)
    }
  }, [])

  const handleRefreshCache = async () => {
    setIsRefreshing(true)
    await refreshCache()
    // The page will reload, but just in case it doesn't:
    setTimeout(() => {
      setIsRefreshing(false)
      window.location.reload()
    }, 2000)
  }

  return (
    <header className="header">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="icon-button" aria-label="Toggle sidebar">
          <MenuIcon size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 relative flex items-center justify-center">
            <Image src="/logo.svg" alt="Beyond-Bot.ai Logo" width={32} height={32} className="dark:invert" />
          </div>
          <div>
            <h1 className="font-medium text-sm">{selectedAgent ? getAgentName(selectedAgent) : "Beyond Assistant"}</h1>
            <p className="text-xs text-muted-foreground">beyond-bot.ai</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={handleRefreshCache} className="icon-button" aria-label="Refresh Cache" disabled={isRefreshing}>
          <RefreshCwIcon size={18} className={isRefreshing ? "animate-spin" : ""} />
        </button>

        <button onClick={onOpenDiscover} className="discover-header-button" aria-label="Discover AI Agents">
          <CompassIcon size={18} />
          <span className="discover-button-text">Discover</span>
        </button>

        <a
          href="https://hub.b-bot.space"
          target="_blank"
          rel="noopener noreferrer"
          className="hub-header-button"
          aria-label="Go to Creator Hub"
        >
          <ExternalLink size={18} />
          <span className="hub-button-text">Creator Hub</span>
        </a>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="icon-button"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>
        <UserProfile />
      </div>
    </header>
  )
}

function getAgentName(agentId: string): string {
  const agents: Record<string, string> = {
    "b-bot": "B-Bot",
    default: "Beyond Assistant",
    professor: "Professor Einstein",
    chef: "Chef Gordon",
    therapist: "Dr. Thompson",
    coder: "Dev Patel",
  }

  return agents[agentId] || "Beyond Assistant"
}
