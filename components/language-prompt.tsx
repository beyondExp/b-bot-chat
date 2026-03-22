"use client"

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { flagForLocale, LOCALE_PROMPTED_KEY, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES, useI18n, type Locale } from "@/lib/i18n"

export function LanguagePrompt({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const hasStoredLocale = Boolean(window.localStorage.getItem(LOCALE_STORAGE_KEY))
      if (hasStoredLocale) return

      const prompted = Boolean(window.localStorage.getItem(LOCALE_PROMPTED_KEY))
      if (prompted) return

      window.localStorage.setItem(LOCALE_PROMPTED_KEY, "1")
      setOpen(true)
    } catch {
      // ignore
    }
  }, [])

  const options = useMemo(() => SUPPORTED_LOCALES as readonly Locale[], [])

  if (!open) return null

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-[60] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur",
        className,
      )}
      role="dialog"
      aria-label={t("lang.select")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{t("lang.select")}</div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("common.close")}
          onClick={() => setOpen(false)}
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        {options.map((l) => (
          <button
            key={l}
            type="button"
            className={cn(
              "flex items-center justify-center rounded-lg border border-border bg-background p-2 text-xl leading-none hover:bg-muted",
              l === locale && "ring-2 ring-primary",
            )}
            onClick={() => {
              setLocale(l)
              setOpen(false)
            }}
            aria-label={t(`lang.${l}`)}
            title={t(`lang.${l}`)}
          >
            {flagForLocale(l)}
          </button>
        ))}
      </div>
    </div>
  )
}

