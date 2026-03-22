import { NextResponse } from "next/server"

export async function GET() {
  const appLogoUrl =
    process.env.APP_LOGO_URL ||
    process.env.NEXT_PUBLIC_APP_LOGO_URL ||
    "https://beyond-bot.ai/logo-schwarz.svg"

  const mainAgentLogoUrl =
    process.env.MAIN_AGENT_LOGO_URL ||
    process.env.NEXT_PUBLIC_MAIN_AGENT_LOGO_URL ||
    "https://beyond-bot.ai/logo-schwarz.svg"

  const appName = (process.env.APP_NAME || "Swiss Chat").toString()
  const mainAgentName = (process.env.MAIN_AGENT_NAME || "B-Bot").toString()
  const accentColor = (process.env.ACCENT_COLOR || "#ff3131").toString()

  // Leave these empty by default; the UI will localize fallbacks via i18n.
  const welcomeTitle = (process.env.WELCOME_TITLE || "").toString()
  const welcomeSubtitle = (process.env.WELCOME_SUBTITLE || "").toString()

  const parseSuggestions = (raw: string | undefined | null): string[] => {
    const s = (raw || "").toString().trim()
    if (!s) return []
    return s
      .split("|")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 10)
  }

  const welcomeSuggestions = parseSuggestions(process.env.WELCOME_SUGGESTIONS)

  return NextResponse.json({
    appLogoUrl,
    mainAgentLogoUrl,
    appName,
    mainAgentName,
    accentColor,
    welcomeTitle,
    welcomeSubtitle,
    welcomeSuggestions,
  })
}

