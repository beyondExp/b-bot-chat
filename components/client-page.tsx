"use client"

import { useSearchParams } from "next/navigation"
import { ChatInterface } from "./chat-interface"

function normalizeAgentFromUrl(agentId: string | null): string | null {
  const raw = (agentId ?? "").toString().trim()
  const lower = raw.toLowerCase()
  if (!lower) return null
  if (lower === "default") return "bbot"
  if (lower === "b-bot") return "bbot"
  if (lower === "bbot") return "bbot"
  return raw
}

export function ClientPage() {
  // Get agent from URL query parameters using useSearchParams
  // This is now safely wrapped in a client component inside a Suspense boundary
  const searchParams = useSearchParams()
  const agentFromUrl = searchParams?.get("agent")

  const initialAgent = normalizeAgentFromUrl(agentFromUrl) ?? "bbot"
  return <ChatInterface initialAgent={initialAgent} />
}
