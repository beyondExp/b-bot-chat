// Server-side helper for building MainAPI URLs.
// Deployments configure MAIN_API_URL either with or without the "/api" prefix
// (e.g. "https://api.b-bot.ch/api" or "https://api.b-bot.ch"), so normalize
// to a base that always ends with "/api".
export function mainApiBase(): string {
  const raw = (process.env.MAIN_API_URL || process.env.MAIN_API_PUBLIC_URL || "").replace(/\/+$/, "")
  if (!raw) return ""
  return raw.endsWith("/api") ? raw : `${raw}/api`
}
