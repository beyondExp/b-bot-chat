"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { EmbedChatInterface } from "./embed-chat-interface"

export function EmbedClientPage() {
  // Get agent from URL query parameters
  const searchParams = useSearchParams()
  const agentFromUrl = searchParams?.get("agent")
  const userIdFromUrl = searchParams?.get("user_id")
  const embedIdFromUrl = searchParams?.get("embedId")

  // Keep the namespace stable across re-renders when embedId is not in the URL.
  const embedId = useMemo(
    () => embedIdFromUrl || `embed-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`,
    [embedIdFromUrl],
  )

  return (
    <EmbedChatInterface 
      initialAgent={agentFromUrl ?? 'bbot'} 
      embedUserId={userIdFromUrl}
      embedId={embedId}
    />
  )
}
