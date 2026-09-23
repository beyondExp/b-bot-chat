import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { AutoTrialBootstrap } from "@/components/auto-trial-bootstrap"
import { PWAInstaller } from "@/components/pwa-installer"
import { I18nProvider } from "@/lib/i18n"
import { LanguagePrompt } from "@/components/language-prompt"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Beyond-Bot.ai - Chat with AI Agents",
  description:
    "Chat with specialized AI expert agents for every topic — Swiss made and hosted. Discover experts, get answers, and create your own agents.",
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
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
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
            <AuthProvider>
              <AutoTrialBootstrap />
              {children}
            </AuthProvider>
            <LanguagePrompt />
            <PWAInstaller />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
