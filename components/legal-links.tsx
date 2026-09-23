"use client"

import { useI18n } from "@/lib/i18n"

/**
 * Impressum / AGB / Datenschutz links, required on every user-facing surface
 * (Swiss law). The documents live on the marketing website.
 */
const WEBSITE_URL = (process.env.NEXT_PUBLIC_WEBSITE_URL || "https://beyond-bot.ai").replace(/\/+$/, "")

export const LEGAL_URLS = {
  impressum: `${WEBSITE_URL}/impressum`,
  terms: `${WEBSITE_URL}/agb`,
  privacy: `${WEBSITE_URL}/datenschutz`,
} as const

export function LegalLinks({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <nav className={className ?? "flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground"}>
      <a href={LEGAL_URLS.impressum} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
        {t("legal.impressum")}
      </a>
      <a href={LEGAL_URLS.terms} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
        {t("legal.terms")}
      </a>
      <a href={LEGAL_URLS.privacy} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
        {t("legal.privacy")}
      </a>
    </nav>
  )
}
