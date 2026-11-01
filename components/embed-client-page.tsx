"use client"

import { useEffect, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { EmbedChatInterface } from "./embed-chat-interface"
import { getOrCreateEmbedSessionToken } from "@/lib/embed-session"

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
  const discoveryRegistered = useRef(false)

  useEffect(() => {
    if (discoveryRegistered.current || window.top !== window.self) return
    discoveryRegistered.current = true

    const agent = agentFromUrl || "bbot"
    const encodedAgent = encodeURIComponent(agent)
    const cardUrl = `${window.location.origin}/api/a2a/agents/${encodedAgent}/agent-card.json`
    const endpointUrl = `${window.location.origin}/api/a2a/agents/${encodedAgent}`

    const link = document.createElement("link")
    link.rel = "alternate"
    link.type = "application/a2a+json"
    link.href = cardUrl
    link.dataset.bbotAgentCard = agent
    document.head.appendChild(link)

    const metadata = [
      ["ai-agent-endpoint", endpointUrl],
      ["ai-agent-protocol", "A2A/1.0"],
      ["ai-agent-card", cardUrl],
    ] as const
    const metaElements = metadata.map(([name, content]) => {
      const meta = document.createElement("meta")
      meta.name = name
      meta.content = content
      document.head.appendChild(meta)
      return meta
    })

    const modelContext = (
      document as Document & {
        modelContext?: {
          registerTool?: (tool: Record<string, unknown>) => unknown
        }
      }
    ).modelContext

    if (typeof modelContext?.registerTool === "function") {
      const registration = modelContext.registerTool({
        name: "ask_website_expert",
        description:
          "Ask this official Beyond-Bot expert for public, source-grounded information.",
        inputSchema: {
          type: "object",
          properties: {
            question: { type: "string" },
            language: { type: "string" },
          },
          required: ["question"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: async (input: { question: string; language?: string }) => {
          const response = await fetch("/api/agent-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent,
              question: input.question,
              language:
                input.language || document.documentElement.lang || navigator.language,
              pageUrl: window.location.href,
              pageTitle: document.title,
              sessionToken: getOrCreateEmbedSessionToken(agent, embedId),
            }),
          })
          const result = await response.json().catch(() => ({ error: "invalid_response" }))
          if (!response.ok) {
            throw new Error(result.message || result.error || "Beyond-Bot query failed")
          }
          return result
        },
      }) as { catch?: (handler: (error: unknown) => void) => void } | undefined
      registration?.catch?.((error) => {
        console.warn("[Beyond-Bot] Site tool registration failed.", error)
      })
    }

    return () => {
      link.remove()
      metaElements.forEach((meta) => meta.remove())
    }
  }, [agentFromUrl, embedId])

  return (
    <EmbedChatInterface 
      initialAgent={agentFromUrl ?? 'bbot'} 
      embedUserId={userIdFromUrl}
      embedId={embedId}
    />
  )
}
