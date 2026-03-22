export type Branding = {
  appLogoUrl: string
  mainAgentLogoUrl: string
  appName: string
  mainAgentName: string
  accentColor: string
  welcomeTitle: string
  welcomeSubtitle: string
  welcomeSuggestions: string[]
}

const DEFAULT_BRANDING: Branding = {
  appLogoUrl: "https://beyond-bot.ai/logo-schwarz.svg",
  mainAgentLogoUrl: "https://beyond-bot.ai/logo-schwarz.svg",
  appName: "Swiss Chat",
  mainAgentName: "B-Bot",
  accentColor: "#ff3131",
  // Intentionally empty so the UI can localize fallbacks via i18n.
  welcomeTitle: "",
  welcomeSubtitle: "",
  welcomeSuggestions: [],
}

export async function fetchBranding(): Promise<Branding> {
  try {
    const res = await fetch("/api/branding", { method: "GET" })
    if (!res.ok) return DEFAULT_BRANDING
    const data = (await res.json()) as Partial<Branding>
    return {
      appLogoUrl: (data.appLogoUrl || DEFAULT_BRANDING.appLogoUrl).toString(),
      mainAgentLogoUrl: (data.mainAgentLogoUrl || DEFAULT_BRANDING.mainAgentLogoUrl).toString(),
      appName: (data.appName || DEFAULT_BRANDING.appName).toString(),
      mainAgentName: (data.mainAgentName || DEFAULT_BRANDING.mainAgentName).toString(),
      accentColor: (data.accentColor || DEFAULT_BRANDING.accentColor).toString(),
      welcomeTitle: (data.welcomeTitle || DEFAULT_BRANDING.welcomeTitle).toString(),
      welcomeSubtitle: (data.welcomeSubtitle || DEFAULT_BRANDING.welcomeSubtitle).toString(),
      welcomeSuggestions: Array.isArray(data.welcomeSuggestions)
        ? data.welcomeSuggestions.map((x) => String(x).trim()).filter(Boolean)
        : DEFAULT_BRANDING.welcomeSuggestions,
    }
  } catch {
    return DEFAULT_BRANDING
  }
}

