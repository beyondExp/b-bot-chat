import { type NextRequest, NextResponse } from "next/server"
import { publicAppOrigin } from "@/lib/app-origin"

type AgentCardContext = {
  params: Promise<{ agent: string }>
}

export async function GET(request: NextRequest, context: AgentCardContext) {
  const { agent: rawAgent } = await context.params
  const agent = String(rawAgent || "").trim()
  if (!agent || agent.length > 200) {
    return NextResponse.json({ error: "invalid_agent" }, { status: 400 })
  }

  const endpoint = `${publicAppOrigin(request)}/api/a2a/agents/${encodeURIComponent(agent)}`
  return NextResponse.json(
    {
      name: "Beyond-Bot Website Expert",
      description: "Answers questions using this website expert's approved public knowledge.",
      version: "1.0.0",
      provider: {
        organization: "Beyond-Bot.ai",
        url: "https://beyond-bot.ai",
      },
      supportedInterfaces: [
        {
          url: endpoint,
          protocolBinding: "JSONRPC",
          protocolVersion: "1.0",
        },
      ],
      capabilities: {
        streaming: false,
        pushNotifications: false,
        extensions: [],
      },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain", "application/json"],
      skills: [
        {
          id: "website_knowledge",
          name: "Website knowledge",
          description: "Answer read-only questions from approved public company knowledge.",
          inputModes: ["text/plain"],
          outputModes: ["text/plain", "application/json"],
          examples: ["What services does this company offer?"],
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Content-Type": "application/a2a+json",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}
