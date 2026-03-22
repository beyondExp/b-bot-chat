import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { PWAInstaller } from "@/components/pwa-installer"
import { I18nProvider } from "@/lib/i18n"
import { LanguagePrompt } from "@/components/language-prompt"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Beyond-Bot.ai - Chat with AI Agents",
  description: "Chat with personalized AI agents powered by LangGraph",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Beyond-Bot.ai",
  },
  icons: {
    icon: [
      {
        url: "/api/branding/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "/api/branding/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  generator: 'v0.dev'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#731f7d",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
            <LanguagePrompt />
            <PWAInstaller />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
