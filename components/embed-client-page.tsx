"use client"

import { useSearchParams } from "next/navigation"
import { EmbedChatInterface } from "./embed-chat-interface"

export function EmbedClientPage() {
  // Get agent from URL query parameters
  const searchParams = useSearchParams()
  const agentFromUrl = searchParams?.get("agent")

  return <EmbedChatInterface initialAgent={agentFromUrl ?? 'bbot'} />
}
