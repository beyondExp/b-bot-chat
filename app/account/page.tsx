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
import { formatPrice, formatTokenCount, calculateTokenCost } from "@/lib/stripe"
import { useAuth0 } from "@auth0/auth0-react"
import { PaymentModal } from "@/components/payment-modal"
import { useRouter } from "next/navigation"
import { PWAInstallGuide } from "@/components/pwa-install-guide"
import { getFullAuth0User } from "@/lib/api"
import { BbotTokenIcon } from "@/components/ui/bbot-token-icon"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

console.log("AccountPage file loaded");

export default function AccountPage() {
  console.log("AccountPage component rendered");
  const router = useRouter()
  const { user } = useAuth0()
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "usage" | "billing" | "pricing">("overview")
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false)
  const [rechargeThreshold, setRechargeThreshold] = useState(200) // $2.00
  const [rechargeAmount, setRechargeAmount] = useState(2000) // $20.00
  const [showPWAGuide, setShowPWAGuide] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [tokensUsed, setTokensUsed] = useState(0)
  const [balance, setBalance] = useState(0)
  const [usageHistory, setUsageHistory] = useState<any[]>([])
  const [billingHistory, setBillingHistory] = useState<any[]>([])

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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Back to chat</span>
          </button>
          <h1 className="text-xl font-semibold">Account Information</h1>
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
                    <TooltipContent>B-Bot Tokens</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard size={16} />
                <span>Add Funds</span>
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
                <span>Account Overview</span>
              </button>
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "usage" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("usage")}
              >
                <Coins size={18} />
                <span>Token Usage</span>
              </button>
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "billing" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("billing")}
              >
                <CreditCard size={18} />
                <span>Billing</span>
              </button>
              <button
                className={`w-full text-left px-4 py-3 flex items-center gap-2 ${
                  activeTab === "pricing" ? "bg-primary/10 text-primary" : "hover:bg-muted"
                }`}
                onClick={() => setActiveTab("pricing")}
              >
                <DollarSign size={18} />
                <span>Pricing</span>
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="md:col-span-2">
            {activeTab === "overview" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Account Overview</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-pointer">
                            {formatTokenCount(balance)}
                            <BbotTokenIcon size={20} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>B-Bot Tokens</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Total Tokens Used</div>
                    <div className="text-2xl font-bold">{formatTokenCount(tokensUsed)}</div>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-6">
                  <div className="flex items-start gap-3">
                    <Info size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium mb-1">Pay-Per-Use Pricing</h3>
                      <p className="text-sm text-muted-foreground">
                        You are charged based on token usage at a rate of $0.0000001 per B-Bot Token. 30% of all revenue is
                        distributed to AI Agent creators, supporting a fair and decentralized AI ecosystem.
                      </p>
                    </div>
                  </div>
                </div>

                <h3 className="font-medium mb-3">Account Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Email</span>
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Account Created</span>
                    <span>April 1, 2023</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Subscription</span>
                    <span>Pay-per-use</span>
                  </div>
                </div>

                <h3 className="font-medium mb-3 mt-6">App Installation</h3>
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Download size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">Install Beyond-Bot.ai as an App</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {isInstalled
                          ? "You have already installed Beyond-Bot.ai as an app on your device."
                          : "Install Beyond-Bot.ai on your device for quick access and offline functionality."}
                      </p>
                      {!isInstalled && (
                        <button
                          onClick={() => setShowPWAGuide(true)}
                          className="py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          <Download size={16} />
                          <span>Install App</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "usage" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Token Usage</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Total Tokens Used</div>
                    <div className="text-2xl font-bold">{formatTokenCount(tokensUsed)}</div>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Estimated Cost</div>
                    <div className="text-2xl font-bold">${calculateTokenCost(tokensUsed).toFixed(6)}</div>
                  </div>
                </div>

                <h3 className="font-medium mb-3">Usage History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Agent</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Tokens</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Cost</th>
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
                <h2 className="text-lg font-semibold mb-4">Billing</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-1 cursor-pointer">
                            {formatTokenCount(balance)}
                            <BbotTokenIcon size={20} />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>B-Bot Tokens</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="p-4 bg-muted rounded-lg flex flex-col justify-between">
                    <div className="text-sm text-muted-foreground mb-1">Add Funds</div>
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <CreditCard size={14} />
                      <span>Add Funds</span>
                    </button>
                  </div>
                </div>

                <h3 className="font-medium mb-3">Transaction History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Description</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Amount</th>
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
                  <h3 className="font-medium mb-2">Payment Methods</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Your payment information is securely processed by Stripe.
                  </p>
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="py-1.5 px-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <CreditCard size={14} />
                    <span>Add Payment Method</span>
                  </button>
                </div>

                <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <h3 className="font-medium mb-3">Auto Recharge</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Automatically add funds to your account when your balance falls below a specified threshold.
                  </p>

                  <div className="flex items-center justify-between mb-4">
                    <span className="font-medium">Enable Auto Recharge</span>
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
                          Recharge when balance falls below
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
                        <p className="text-xs text-muted-foreground mt-1">Minimum: $1.00</p>
                      </div>

                      <div>
                        <label htmlFor="amount" className="block text-sm font-medium mb-1">
                          Recharge amount
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
                        <p className="text-xs text-muted-foreground mt-1">Minimum: $5.00</p>
                      </div>

                      <div className="p-3 bg-muted/50 rounded-lg text-sm">
                        <p>
                          Your account will be automatically recharged with{" "}
                          <strong>{formatPrice(rechargeAmount)}</strong> when your balance falls below{" "}
                          <strong>{formatPrice(rechargeThreshold)}</strong>.
                        </p>
                      </div>

                      <button className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
                        <CreditCard size={16} />
                        <span>Save Auto Recharge Settings</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "pricing" && (
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">Pay-Per-Use Pricing</h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                    <DollarSign size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium mb-1">Fair & Transparent Pricing</h3>
                      <p className="text-sm text-muted-foreground">
                        You only pay for what you use. Charges are based on token usage at a rate of $0.0000001 per B-Bot Token.
                        There are no subscription fees or hidden costs.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                    <Users size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium mb-1">Supporting Creators</h3>
                      <p className="text-sm text-muted-foreground">
                        30% of all revenue is distributed to AI Agent creators, supporting a fair and decentralized AI
                        ecosystem. This incentivizes the development of high-quality, specialized agents.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                    <Sparkles size={20} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-medium mb-1">Premium Experience</h3>
                      <p className="text-sm text-muted-foreground">
                        Access to all specialized AI agents with advanced capabilities and continuous improvements. Our
                        agents are designed to provide expert knowledge in their specific domains.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <h3 className="font-medium mb-3">Example Costs</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={16} className="text-muted-foreground" />
                          <span>Short conversation (1,000 B-Bot Tokens)</span>
                        </div>
                        <span className="font-medium">${calculateTokenCost(1000).toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={16} className="text-muted-foreground" />
                          <span>Medium conversation (5,000 B-Bot Tokens)</span>
                        </div>
                        <span className="font-medium">${calculateTokenCost(5000).toFixed(6)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={16} className="text-muted-foreground" />
                          <span>Long conversation (10,000 B-Bot Tokens)</span>
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
                      <span>Add Funds to Your Account</span>
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
