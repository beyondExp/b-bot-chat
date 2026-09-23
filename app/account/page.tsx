"use client"

import { useState, useEffect } from "react"
import {
  User,
  ArrowLeft,
  ArrowUpRight,
  CreditCard,
  Sparkles,
  Download,
  Info,
  KeyRound,
} from "lucide-react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { PWAInstallGuide } from "@/components/pwa-install-guide"
import { getAuthToken } from "@/lib/api"
import { useAppAuth } from "@/lib/app-auth"
import { useI18n } from "@/lib/i18n"
import { clearChatUserProfile, loadChatUserProfile, saveChatUserProfile } from "@/lib/chat-user-profile"
import { HUB_BILLING_URL, HUB_KEYS_URL } from "@/components/quota-limit-modal"
import { LegalLinks } from "@/components/legal-links"

interface QuotaStatus {
  plan?: string | null
  monthly_runs_limit?: number | null
  monthly_runs_used?: number | null
  monthly_runs_remaining?: number | null
}

export default function AccountPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAppAuth()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<"overview" | "subscription" | "chatProfile">("overview")
  const [showPWAGuide, setShowPWAGuide] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [aboutMe, setAboutMe] = useState("")
  const [additionalInstructions, setAdditionalInstructions] = useState("")
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null)

  // Check if app is installed
  useEffect(() => {
    if (typeof window === "undefined") return

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      localStorage.getItem("pwa-installed") === "true"
    ) {
      setIsInstalled(true)
    }
  }, [])

  // Load subscription quota (plan + monthly runs)
  useEffect(() => {
    const token = getAuthToken()
    if (!token) return
    setQuotaLoading(true)
    fetch("/api/quota", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === "object") setQuota(data)
      })
      .catch(() => {})
      .finally(() => setQuotaLoading(false))
  }, [user?.sub])

  // Initialize active tab from URL param (e.g. /account?tab=chatProfile)
  useEffect(() => {
    const tab = (searchParams?.get("tab") || "").trim()
    if (tab === "chatProfile") setActiveTab("chatProfile")
    if (tab === "subscription") setActiveTab("subscription")
  }, [searchParams])

  // Load chat profile for the current user
  useEffect(() => {
    const sub = user?.sub || "anonymous"
    const p = loadChatUserProfile(sub)
    setAboutMe(p.aboutMe || "")
    setAdditionalInstructions(p.additionalInstructions || "")
  }, [user?.sub])

  const planLabel = (quota?.plan || "").toString()
  const runsLimit = typeof quota?.monthly_runs_limit === "number" ? quota.monthly_runs_limit : null
  const runsUsed = typeof quota?.monthly_runs_used === "number" ? quota.monthly_runs_used : 0
  const usagePercent =
    runsLimit && runsLimit > 0 ? Math.min(Math.round((runsUsed / runsLimit) * 100), 100) : null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span>{t("account.backToChat")}</span>
          </button>
          <h1 className="text-xl font-semibold">{t("account.title")}</h1>
          <div className="w-[100px]"></div> {/* Spacer for alignment */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sidebar */}
          <div className="space-y-4">
            {/* User profile card */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border border-border">
                  {user?.picture ? (
                    <Image
                      src={user.picture || "/placeholder.svg"}
                      alt={user.name || "User"}
                      width={48}
                      height={48}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <User size={24} />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="font-medium">{user?.name}</h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <a
                href={HUB_BILLING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard size={16} />
                <span>{t("account.subscription.manageCta")}</span>
              </a>
            </div>

            {/* Navigation */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "overview" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("overview")}
              >
                <User size={18} />
                <span>{t("account.nav.overview")}</span>
              </button>
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "subscription" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("subscription")}
              >
                <CreditCard size={18} />
                <span>{t("account.nav.subscription")}</span>
              </button>
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "chatProfile" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("chatProfile")}
              >
                <Sparkles size={18} />
                <span>{t("account.nav.chatProfile")}</span>
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="md:col-span-2">
            {activeTab === "overview" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">{t("account.overview.title")}</h2>

                <h3 className="font-medium mb-3">{t("account.details.title")}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("account.details.email")}</span>
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("account.details.subscription")}</span>
                    <span className="capitalize">
                      {quotaLoading ? "…" : planLabel || t("account.subscription.noPlan")}
                    </span>
                  </div>
                </div>

                <h3 className="font-medium mb-3 mt-6">{t("account.installation.title")}</h3>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Download size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">{t("account.installation.cardTitle")}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {isInstalled
                          ? t("account.installation.installed")
                          : t("account.installation.notInstalled")}
                      </p>
                      {!isInstalled && (
                        <button
                          onClick={() => setShowPWAGuide(true)}
                          className="py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          <Download size={16} />
                          <span>{t("account.installation.installButton")}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "subscription" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">{t("account.subscription.title")}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t("account.subscription.currentPlan")}
                    </div>
                    <div className="text-2xl font-bold capitalize">
                      {quotaLoading ? "…" : planLabel || t("account.subscription.noPlan")}
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t("account.subscription.runsThisMonth")}
                    </div>
                    <div className="text-2xl font-bold">
                      {quotaLoading
                        ? "…"
                        : runsLimit !== null
                          ? `${runsUsed} / ${runsLimit}`
                          : `${runsUsed}`}
                    </div>
                  </div>
                </div>

                {usagePercent !== null && (
                  <div className="mb-6">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${usagePercent >= 90 ? "bg-red-500" : "bg-primary"}`}
                        style={{ width: `${usagePercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("account.subscription.usageHint").replace("{percent}", String(usagePercent))}
                    </p>
                  </div>
                )}

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-6">
                  <div className="flex items-start gap-3">
                    <Info size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">{t("account.subscription.byokNote")}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={HUB_BILLING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors items-center gap-2"
                  >
                    <ArrowUpRight size={16} />
                    <span>{t("account.subscription.manageCta")}</span>
                  </a>
                  <a
                    href={HUB_KEYS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex py-2 px-4 border border-border rounded-md hover:bg-muted transition-colors items-center gap-2"
                  >
                    <KeyRound size={16} />
                    <span>{t("account.subscription.manageKeysCta")}</span>
                  </a>
                </div>
              </div>
            )}

            {activeTab === "chatProfile" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">{t("account.chatProfile.title")}</h2>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t("account.chatProfile.aboutMeLabel")}</label>
                    <textarea
                      value={aboutMe}
                      onChange={(e) => setAboutMe(e.target.value)}
                      rows={6}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={t("account.chatProfile.aboutMePlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground mt-2">{t("account.chatProfile.aboutMeHint")}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t("account.chatProfile.additionalInstructionsLabel")}
                    </label>
                    <textarea
                      value={additionalInstructions}
                      onChange={(e) => setAdditionalInstructions(e.target.value)}
                      rows={5}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={t("account.chatProfile.additionalInstructionsPlaceholder")}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("account.chatProfile.additionalInstructionsHint")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      onClick={() => {
                        const sub = user?.sub || "anonymous"
                        saveChatUserProfile(sub, { aboutMe, additionalInstructions })
                        setProfileSavedAt(Date.now())
                      }}
                    >
                      {t("common.save")}
                    </button>
                    <button
                      className="py-2 px-4 border border-border rounded-md hover:bg-muted transition-colors"
                      onClick={() => {
                        const sub = user?.sub || "anonymous"
                        clearChatUserProfile(sub)
                        setAboutMe("")
                        setAdditionalInstructions("")
                        setProfileSavedAt(Date.now())
                      }}
                    >
                      {t("common.clear")}
                    </button>

                    {profileSavedAt ? (
                      <span className="ml-auto text-xs text-muted-foreground">{t("common.saved")}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pb-6">
          <LegalLinks />
        </div>
      </div>

      {showPWAGuide && <PWAInstallGuide onClose={() => setShowPWAGuide(false)} />}
    </div>
  )
}
