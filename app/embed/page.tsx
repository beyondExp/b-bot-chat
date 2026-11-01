import { Suspense } from "react"
import type { Metadata } from "next"
import { EmbedClientPage } from "@/components/embed-client-page"
import "./embed.css"

type EmbedPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ searchParams }: EmbedPageProps): Promise<Metadata> {
  const params = (await searchParams) || {}
  const rawAgent = Array.isArray(params.agent) ? params.agent[0] : params.agent
  const agent = String(rawAgent || "bbot").trim() || "bbot"
  const baseUrl = (
    process.env.CHAT_PUBLIC_URL ||
    process.env.AUTH0_BASE_URL ||
    process.env.NEXT_PUBLIC_CHAT_URL ||
    "https://swiss-chat.ch"
  ).replace(/\/+$/, "")
  const encodedAgent = encodeURIComponent(agent)
  const endpoint = `${baseUrl}/api/a2a/agents/${encodedAgent}`
  const card = `${endpoint}/agent-card.json`

  return {
    title: "Beyond-Bot.ai - Website Expert",
    description: "Direct chat and agent interface for a Beyond-Bot website expert.",
    alternates: {
      types: {
        "application/a2a+json": card,
      },
    },
    other: {
      "ai-agent-endpoint": endpoint,
      "ai-agent-protocol": "A2A/1.0",
      "ai-agent-card": card,
    },
  }
}

export default function EmbedPage() {
  return (
    <>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <EmbedClientPage />
      </Suspense>
    </>
  )
}
