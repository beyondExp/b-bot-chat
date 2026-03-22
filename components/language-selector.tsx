"use client"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { flagForLocale, SUPPORTED_LOCALES, useI18n, type Locale } from "@/lib/i18n"

export function LanguageSelector({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()

  const select = (l: Locale) => {
    setLocale(l)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("rounded-full text-muted-foreground hover:text-primary hover:bg-muted", className)}
          aria-label={t("lang.select")}
          title={t("lang.select")}
        >
          <span className="text-xl leading-none">{flagForLocale(locale)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-0 p-1">
        <div className="grid grid-cols-4 gap-1">
          {SUPPORTED_LOCALES.map((l) => (
            <DropdownMenuItem
              key={l}
              onSelect={() => select(l)}
              className={cn("justify-center px-2 py-2", l === locale && "bg-accent")}
              aria-label={t(`lang.${l}`)}
              title={t(`lang.${l}`)}
            >
              <span className="text-xl leading-none">{flagForLocale(l)}</span>
              <span className="sr-only">{t(`lang.${l}`)}</span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

