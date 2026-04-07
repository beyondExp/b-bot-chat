import { ClientPage } from "@/components/client-page"

function normalizeAgentFromUrl(agentId: string | null): string | null {
  const raw = (agentId ?? "").toString().trim()
  const lower = raw.toLowerCase()
  if (!lower) return null
  if (lower === "default") return "bbot"
  if (lower === "b-bot") return "bbot"
  if (lower === "bbot") return "bbot"
  return raw
}

export default function Home({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const raw =
    (typeof searchParams?.agent === "string" ? searchParams?.agent : null) ||
    (typeof searchParams?.assistantId === "string" ? searchParams?.assistantId : null) ||
    (typeof searchParams?.assistant_id === "string" ? searchParams?.assistant_id : null) ||
    (typeof searchParams?.channel === "string" ? searchParams?.channel : null) ||
    (typeof searchParams?.channel_id === "string" ? searchParams?.channel_id : null) ||
    null

  const initialAgent = normalizeAgentFromUrl(raw) ?? "bbot"
  return <ClientPage initialAgent={initialAgent} />
}
