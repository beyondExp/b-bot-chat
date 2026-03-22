"use client"

import { useState, useEffect } from "react"
import {
  User,
  Coins,
  CreditCard,
  Clock,
  ArrowLeft,
  Info,
  DollarSign,
  Users,
  Sparkles,
  BarChart3,
  Download,
} from "lucide-react"
import Image from "next/image"
import { formatPrice, formatTokenCount, calculateTokenCost, BBOT_TOKEN_RATE } from "@/lib/stripe"
import { PaymentModal } from "@/components/payment-modal"
import { useRouter, useSearchParams } from "next/navigation"
import { PWAInstallGuide } from "@/components/pwa-install-guide"
import { getFullAuth0User } from "@/lib/api"
import { BbotTokenIcon } from "@/components/ui/bbot-token-icon"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { useAppAuth } from "@/lib/app-auth"
import { useI18n } from "@/lib/i18n"
import { clearChatUserProfile, loadChatUserProfile, saveChatUserProfile } from "@/lib/chat-user-profile"

console.log("AccountPage file loaded");

export default function AccountPage() {
  console.log("AccountPage component rendered");
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAppAuth()
  const { t } = useI18n()
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "usage" | "billing" | "pricing" | "chatProfile">("overview")
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false)
  const [rechargeThreshold, setRechargeThreshold] = useState(200) // $2.00
  const [rechargeAmount, setRechargeAmount] = useState(2000) // $20.00
  const [showPWAGuide, setShowPWAGuide] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [tokensUsed, setTokensUsed] = useState(0)
  const [balance, setBalance] = useState(0)
  const [usageHistory, setUsageHistory] = useState<any[]>([])
  const [billingHistory, setBillingHistory] = useState<any[]>([])
  const [aboutMe, setAboutMe] = useState("")
  const [additionalInstructions, setAdditionalInstructions] = useState("")
  const [profileSavedAt, setProfileSavedAt] = useState<number | null>(null)

  // Check if app is installed
  useEffect(() => {
    if (typeof window === "undefined") return

    // Check if in standalone mode (already installed)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      localStorage.getItem("pwa-installed") === "true"
    ) {
      setIsInstalled(true)
    }
  }, [])

  useEffect(() => {
    const fullUserObj = getFullAuth0User();
    console.log('Full Auth0 user:', fullUserObj);

    // The real user data is in fullUserObj.decodedToken.user
    const user = fullUserObj?.decodedToken?.user;
    if (user) {
      const meta = user.hub_user_metadata || {};
      console.log('hub_user_metadata:', meta);
      console.log('meta.total_used_tokens:', meta.total_used_tokens);
      console.log('meta.token_budget:', meta.token_budget);
      console.log('meta.chat_used_tokens:', meta.chat_used_tokens);

      setTokensUsed(
        meta.total_used_tokens ??
        meta.chat_used_tokens ??
        user.total_used_tokens ??
        user.chat_used_tokens ??
        0
      );
      setBalance(
        meta.token_budget ??
        user.token_budget ??
        0
      );
      setUsageHistory(meta.usage_history ?? user.usage_history ?? []);
      setBillingHistory(meta.billing_history ?? user.billing_history ?? []);
    } else {
      console.warn('No user found in decodedToken');
    }
  }, []);

  // Initialize active tab from URL param (e.g. /account?tab=chatProfile)
  useEffect(() => {
    const tab = (searchParams?.get("tab") || "").trim()
    if (tab === "chatProfile") setActiveTab("chatProfile")
  }, [searchParams])

  // Load chat profile for the current user
  useEffect(() => {
    const sub = user?.sub || "anonymous"
    const p = loadChatUserProfile(sub)
    setAboutMe(p.aboutMe || "")
    setAdditionalInstructions(p.additionalInstructions || "")
  }, [user?.sub])

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

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-3">
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-primary" />
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-pointer">
                        {formatTokenCount(balance)}
                        <BbotTokenIcon size={18} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t("account.tokensTooltip")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard size={16} />
                <span>{t("account.addFunds")}</span>
              </button>
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
                  activeTab === "chatProfile" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("chatProfile")}
              >
                <Sparkles size={18} />
                <span>{t("account.nav.chatProfile")}</span>
              </button>
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "usage" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("usage")}
              >
                <Coins size={18} />
                <span>{t("account.nav.usage")}</span>
              </button>
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "billing" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("billing")}
              >
                <CreditCard size={18} />
                <span>{t("account.nav.billing")}</span>
              </button>
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "pricing" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("pricing")}
              >
                <DollarSign size={18} />
                <span>{t("account.nav.pricing")}</span>
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="md:col-span-2">
            {activeTab === "overview" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">{t("account.overview.title")}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">{t("account.currentBalance")}</div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-pointer">
                            {formatTokenCount(balance)}
                            <BbotTokenIcon size={20} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t("account.tokensTooltip")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">{t("account.totalTokensUsed")}</div>
                    <div className="text-2xl font-bold">{formatTokenCount(tokensUsed)}</div>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-6">
                  <div className="flex items-start gap-3">
                    <Info size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium mb-1">{t("account.payPerUseTitle")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("account.payPerUseBody")
                          .replace("{rate}", `$${BBOT_TOKEN_RATE}`)
                          .replace("{creatorShare}", "30")}
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="font-medium mb-3">{t("account.details.title")}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("account.details.email")}</span>
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("account.details.created")}</span>
                    <span>{t("account.details.createdValuePlaceholder")}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">{t("account.details.subscription")}</span>
                    <span>{t("account.subscription.payPerUse")}</span>
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

            {activeTab === "usage" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">{t("account.usage.title")}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">{t("account.totalTokensUsed")}</div>
                    <div className="text-2xl font-bold">{formatTokenCount(tokensUsed)}</div>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">{t("account.usage.estimatedCost")}</div>
                    <div className="text-2xl font-bold">${calculateTokenCost(tokensUsed).toFixed(6)}</div>
                  </div>
                </div>

                <h3 className="font-medium mb-3">{t("account.usage.history")}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">{t("account.table.date")}</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">{t("account.table.agent")}</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">{t("account.table.tokens")}</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">{t("account.table.cost")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageHistory.map((item, index) => (
                        <tr key={index} className="border-b border-border">
                          <td className="py-2 px-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock size={14} className="text-muted-foreground" />
                              {item.date}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-sm">{item.agent}</td>
                          <td className="py-2 px-3 text-sm text-right">{formatTokenCount(item.tokens)}</td>
                          <td className="py-2 px-3 text-sm text-right">{formatPrice(item.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">{t("account.billing.title")}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">{t("account.currentBalance")}</div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-pointer">
                            {formatTokenCount(balance)}
                            <BbotTokenIcon size={20} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t("account.tokensTooltip")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="p-4 bg-muted rounded-lg flex flex-col justify-between">
                    <div className="text-sm text-muted-foreground mb-1">{t("account.addFunds")}</div>
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <CreditCard size={14} />
                      <span>{t("account.addFunds")}</span>
                    </button>
                  </div>
                </div>

                <h3 className="font-medium mb-3">{t("account.billing.transactionHistory")}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">{t("account.table.date")}</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">{t("account.billing.table.description")}</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">{t("account.billing.table.amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistory.map((item, index) => (
                        <tr key={index} className="border-b border-border">
                          <td className="py-2 px-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock size={14} className="text-muted-foreground" />
                              {item.date}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-sm">{item.description}</td>
                          <td
                            className={`py-2 px-3 text-sm text-right ${item.type === "credit" ? "text-green-600" : ""}`}
                          >
                            {item.type === "credit" ? "+" : "-"}
                            {formatPrice(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium mb-2">{t("account.billing.paymentMethods")}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("account.billing.paymentMethodsDesc")}
                  </p>
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="py-1.5 px-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <CreditCard size={14} />
                    <span>{t("account.billing.addPaymentMethod")}</span>
                  </button>
                </div>

                <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <h3 className="font-medium mb-3">{t("account.billing.autoRecharge")}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t("account.billing.autoRechargeDesc")}
                  </p>

                  <div className="flex items-center justify-between mb-4">
                    <span className="font-medium">{t("account.billing.enableAutoRecharge")}</span>
                    <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out rounded-full">
                      <input
                        type="checkbox"
                        id="auto-recharge-toggle"
                        className="absolute w-0 h-0 opacity-0"
                        checked={autoRechargeEnabled}
                        onChange={() => setAutoRechargeEnabled(!autoRechargeEnabled)}
                      />
                      <label
                        htmlFor="auto-recharge-toggle"
                        className={`block h-6 overflow-hidden rounded-full cursor-pointer ${
                          autoRechargeEnabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`block h-6 w-6 rounded-full transform transition-transform duration-200 ease-in-out bg-white ${
                            autoRechargeEnabled ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </label>
                    </div>
                  </div>

                  {autoRechargeEnabled && (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="threshold" className="block text-sm font-medium mb-1">
                          {t("account.billing.rechargeBelow")}
                        </label>
                        <div className="flex items-center">
                          <span className="mr-2">$</span>
                          <input
                            type="number"
                            id="threshold"
                            min="1"
                            max="100"
                            step="1"
                            value={rechargeThreshold / 100}
                            onChange={(e) => setRechargeThreshold(Math.round(Number.parseFloat(e.target.value) * 100))}
                            className="w-full p-2 border border-border rounded-md"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("account.minimum").replace("{amount}", "$1.00")}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="amount" className="block text-sm font-medium mb-1">
                          {t("account.billing.rechargeAmount")}
                        </label>
                        <div className="flex items-center">
                          <span className="mr-2">$</span>
                          <input
                            type="number"
                            id="amount"
                            min="5"
                            max="100"
                            step="5"
                            value={rechargeAmount / 100}
                            onChange={(e) => setRechargeAmount(Math.round(Number.parseFloat(e.target.value) * 100))}
                            className="w-full p-2 border border-border rounded-md"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("account.minimum").replace("{amount}", "$5.00")}
                        </p>
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg text-sm">
                        <p>
                          {t("account.billing.autoRechargeSummary")
                            .replace("{amount}", formatPrice(rechargeAmount))
                            .replace("{threshold}", formatPrice(rechargeThreshold))}
                        </p>
                      </div>

                      <button className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                        <CreditCard size={16} />
                        <span>{t("account.billing.saveAutoRecharge")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "pricing" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">{t("account.pricing.title")}</h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                    <DollarSign size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium mb-1">{t("account.pricing.fairTitle")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("account.pricing.fairBody").replace("{rate}", `$${BBOT_TOKEN_RATE}`)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                    <Users size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium mb-1">{t("account.pricing.creatorsTitle")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("account.pricing.creatorsBody").replace("{creatorShare}", "30")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                    <Sparkles size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium mb-1">{t("account.pricing.premiumTitle")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("account.pricing.premiumBody")}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-medium mb-3">{t("account.pricing.exampleCosts")}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={16} className="text-muted-foreground" />
                          <span>{t("account.pricing.example.short").replace("{tokens}", "1,000")}</span>
                        </div>
                        <span className="font-medium">${calculateTokenCost(1000).toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={16} className="text-muted-foreground" />
                          <span>{t("account.pricing.example.medium").replace("{tokens}", "5,000")}</span>
                        </div>
                        <span className="font-medium">${calculateTokenCost(5000).toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={16} className="text-muted-foreground" />
                          <span>{t("account.pricing.example.long").replace("{tokens}", "10,000")}</span>
                        </div>
                        <span className="font-medium">${calculateTokenCost(10000).toFixed(6)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <CreditCard size={16} />
                      <span>{t("account.pricing.addFundsCta")}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isPaymentModalOpen && (
        <PaymentModal onClose={() => setIsPaymentModalOpen(false)} currentBalance={balance} tokensUsed={tokensUsed} />
      )}
      {showPWAGuide && <PWAInstallGuide onClose={() => setShowPWAGuide(false)} />}
    </div>
  )
}
