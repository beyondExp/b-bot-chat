"use client"
import { Info, X } from "lucide-react"
import { BBOT_TOKEN_RATE } from "@/lib/stripe"

interface WelcomePricingBannerProps {
  onDismiss: () => void
}

export function WelcomePricingBanner({ onDismiss }: WelcomePricingBannerProps) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Info size={18} className="text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-sm mb-1">Pay-Per-Use Pricing Model</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Beyond-Bot.ai now uses a token-based pricing model. You only pay for what you use at a rate of ${BBOT_TOKEN_RATE} per
            B-Bot Token, with 30% of revenue going to AI Agent creators.
          </p>
          <div className="flex justify-end">
            <button onClick={onDismiss} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
              <X size={12} />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
