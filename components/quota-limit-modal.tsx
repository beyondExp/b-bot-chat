"use client"

import { X, AlertCircle, ArrowUpRight } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export const HUB_BILLING_URL =
  process.env.NEXT_PUBLIC_HUB_BILLING_URL || "https://hub.beyond-bot.ch/billing"

// BYOK: provider keys are managed in the Hub, not in chat.
export const HUB_KEYS_URL =
  process.env.NEXT_PUBLIC_HUB_KEYS_URL || "https://hub.beyond-bot.ch/keys"

export interface QuotaInfo {
  plan?: string | null
  limit?: number | null
  used?: number | null
  /** "keyless_daily" = daily cap on the built-in platform key (BYOK missing). */
  reason?: "monthly" | "keyless_daily" | null
}

interface QuotaLimitModalProps {
  isOpen: boolean
  onClose: () => void
  quota?: QuotaInfo | null
}

/**
 * Shown when the user's subscription plan has no runs/messages left this
 * month (HTTP 402 run_limit_reached). Replaces the old pay-per-use
 * "insufficient balance" modal: the only thing sold is the subscription.
 */
export function QuotaLimitModal({ isOpen, onClose, quota }: QuotaLimitModalProps) {
  const { t } = useI18n()

  if (!isOpen) {
    return null
  }

  const plan = (quota?.plan || "").toString()
  const limit = typeof quota?.limit === "number" ? quota.limit : null
  const used = typeof quota?.used === "number" ? quota.used : null
  const isKeyless = quota?.reason === "keyless_daily"

  const title = isKeyless ? t("quotaLimit.keylessTitle") : t("quotaLimit.title")
  const reachedTitle = isKeyless ? t("quotaLimit.keylessTitle") : t("quotaLimit.reachedTitle")
  const reachedBody = isKeyless
    ? limit !== null
      ? t("quotaLimit.keylessBodyWithNumbers").replace("{limit}", String(limit))
      : t("quotaLimit.keylessBody")
    : limit !== null
      ? t("quotaLimit.reachedBodyWithNumbers")
          .replace("{used}", String(used ?? limit))
          .replace("{limit}", String(limit))
          .replace("{plan}", plan || t("quotaLimit.currentPlanFallback"))
      : t("quotaLimit.reachedBody")
  const hint = isKeyless ? t("quotaLimit.keylessHint") : t("quotaLimit.body")
  const ctaHref = isKeyless ? HUB_KEYS_URL : HUB_BILLING_URL
  const ctaLabel = isKeyless ? t("quotaLimit.addKeyCta") : t("quotaLimit.upgradeCta")

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-lg">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium">{reachedTitle}</h3>
              <p className="text-sm mt-1">{reachedBody}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{hint}</p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-border rounded-md hover:bg-muted transition-colors"
            >
              {t("common.close")}
            </button>
            <a
              href={ctaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowUpRight size={16} />
              <span>{ctaLabel}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
