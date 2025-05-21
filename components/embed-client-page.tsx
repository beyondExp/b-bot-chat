"use client"

import { useSearchParams } from "next/navigation"
import { EmbedChatInterface } from "./embed-chat-interface"

export function EmbedClientPage() {
  // Get agent from URL query parameters
  const searchParams = useSearchParams()
  const agentFromUrl = searchParams?.get("agent")
  const userIdFromUrl = searchParams?.get("user_id")

  return <EmbedChatInterface initialAgent={agentFromUrl ?? 'bbot'} embedUserId={userIdFromUrl} />
}
