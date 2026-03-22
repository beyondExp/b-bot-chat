import type { MetadataRoute } from "next"

export const dynamic = "force-dynamic"

export default function manifest(): MetadataRoute.Manifest {
  const appName = process.env.APP_NAME || "Beyond-Bot.ai"
  const appShortName = process.env.APP_SHORT_NAME || "Beyond-Bot"

  // Use a local icon URL so deployments can change branding via env vars
  // without relying on Next metadata route caching semantics.
  const icon = "/api/branding/icon.svg"

  return {
    name: appName,
    short_name: appShortName,
    description: "AI chat web application with specialized agents",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#731f7d",
    orientation: "portrait-primary",
    icons: [
      {
        src: icon,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  }
}

