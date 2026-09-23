"use client"

import { useEffect, useState } from "react"
import { Bot, KeyRound, MessageSquare, Sparkles, X } from "lucide-react"
import { useAppAuth } from "@/lib/app-auth"
import { useI18n } from "@/lib/i18n"
import { HUB_KEYS_URL } from "@/components/quota-limit-modal"
import { BrandLogo } from "@/components/brand-logo"

const STORAGE_PREFIX = "bbot-chat-onboarding-v1:"

type Step = {
  icon: React.ReactNode
  titleKey: string
  bodyKey: string
}

const STEPS: Step[] = [
  { icon: <Sparkles size={28} />, titleKey: "onboarding.welcomeTitle", bodyKey: "onboarding.welcomeBody" },
  { icon: <Bot size={28} />, titleKey: "onboarding.discoverTitle", bodyKey: "onboarding.discoverBody" },
  { icon: <KeyRound size={28} />, titleKey: "onboarding.keysTitle", bodyKey: "onboarding.keysBody" },
]

/**
 * First-run welcome for authenticated chat users: what the app is, how to
 * find experts, and how the free daily messages / BYOK model works.
 * Dismissal is persisted per user in localStorage.
 */
export function ChatOnboarding() {
  const { user, isAuthenticated } = useAppAuth()
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  const storageKey = `${STORAGE_PREFIX}${user?.sub || "anonymous"}`

  useEffect(() => {
    if (!isAuthenticated || !user?.sub) return
    try {
      if (localStorage.getItem(storageKey) !== "done") setVisible(true)
    } catch {
      // Storage unavailable (private mode): skip onboarding rather than loop.
    }
  }, [isAuthenticated, user?.sub, storageKey])

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "done")
    } catch {
      // Best-effort persistence only.
    }
    setVisible(false)
  }

  if (!visible) return null

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm overflow-hidden">
        <div className="flex justify-end p-2">
          <button
            onClick={dismiss}
            aria-label={t("onboarding.skip")}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5 text-center">
          {step === 0 ? (
            <div className="flex justify-center">
              <BrandLogo alt="App logo" size={56} className="dark:invert" />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                {current.icon}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">{t(current.titleKey)}</h2>
            <p className="text-sm text-muted-foreground">{t(current.bodyKey)}</p>
          </div>

          {isLast ? (
            <a
              href={HUB_KEYS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <KeyRound size={14} />
              {t("onboarding.addKeyCta")}
            </a>
          ) : null}

          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex-1 py-2 px-4 border border-border rounded-md hover:bg-muted transition-colors text-sm"
              >
                {t("onboarding.back")}
              </button>
            ) : (
              <button
                onClick={dismiss}
                className="flex-1 py-2 px-4 border border-border rounded-md hover:bg-muted transition-colors text-sm"
              >
                {t("onboarding.skip")}
              </button>
            )}
            <button
              onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
              className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm flex items-center justify-center gap-1"
            >
              {isLast ? (
                <>
                  <MessageSquare size={14} />
                  {t("onboarding.start")}
                </>
              ) : (
                t("onboarding.next")
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
