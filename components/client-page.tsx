"use client"

import { useSearchParams } from "next/navigation"
import { ChatInterface } from "./chat-interface"

export function ClientPage() {
  // Get agent from URL query parameters using useSearchParams
  // This is now safely wrapped in a client component inside a Suspense boundary
  const searchParams = useSearchParams()
  const agentFromUrl = searchParams?.get("agent")

  return <ChatInterface initialAgent={agentFromUrl ?? 'bbot'} />
}
