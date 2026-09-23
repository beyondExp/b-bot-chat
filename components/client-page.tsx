"use client"

import { ChatInterface } from "./chat-interface"
import { ChatOnboarding } from "./chat-onboarding"

export function ClientPage({ initialAgent }: { initialAgent: string }) {
  return (
    <>
      <ChatInterface initialAgent={initialAgent} />
      <ChatOnboarding />
    </>
  )
}
