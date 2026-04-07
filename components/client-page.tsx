"use client"

import { ChatInterface } from "./chat-interface"

export function ClientPage({ initialAgent }: { initialAgent: string }) {
  return <ChatInterface initialAgent={initialAgent} />
}
