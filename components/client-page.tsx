"use client"

import { ChatInterface } from "@/components/chat-interface"
import { AuthGuard } from "@/components/auth-guard"
import { useSearchParams } from "next/navigation"

export function ClientPage() {
  // Get the agent parameter from the URL
  const searchParams = useSearchParams()
  const agentParam = searchParams.get("agent")

  return (
    <main className="flex min-h-screen flex-col">
      <AuthGuard initialAgent={agentParam}>
        <ChatInterface initialAgent={agentParam} />
      </AuthGuard>
    </main>
  )
}
