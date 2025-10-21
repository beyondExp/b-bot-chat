import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Beyond-Bot.ai - Embed",
  description: "Embedded chat interface",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // This is crucial for iOS safe area support
  themeColor: "#ffffff",
}

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

