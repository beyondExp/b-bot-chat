"use client"

import { useSearchParams } from "next/navigation"
import { EmbedChatInterface } from "./embed-chat-interface"

export function EmbedClientPage() {
  // Get agent from URL query parameters
  const searchParams = useSearchParams()
  const agentFromUrl = searchParams?.get("agent")
  const userIdFromUrl = searchParams?.get("user_id")
  const embedIdFromUrl = searchParams?.get("embedId")
  
  // Generate a unique embed ID if not provided
  const embedId = embedIdFromUrl || `embed-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`

  return (
    <EmbedChatInterface 
      initialAgent={agentFromUrl ?? 'bbot'} 
      embedUserId={userIdFromUrl}
      embedId={embedId}
    />
  )
}
