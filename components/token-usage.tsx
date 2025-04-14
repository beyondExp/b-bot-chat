"use client"

import { useState } from "react"
import { Coins, Info } from "lucide-react"
import { formatPrice, calculateTokenCost, formatTokenCount } from "@/lib/stripe"

interface TokenUsageProps {
  tokensUsed: number
  isActive: boolean
}

export function TokenUsage({ tokensUsed, isActive }: TokenUsageProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const cost = calculateTokenCost(tokensUsed)

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
          isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        }`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Coins size={14} />
        <span>{formatTokenCount(tokensUsed)} tokens</span>
        <span className="text-muted-foreground">({formatPrice(cost)})</span>
      </div>

      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-popover text-popover-foreground rounded-lg shadow-lg text-xs z-50">
          <div className="flex items-start gap-2">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Token Usage Information</p>
              <p className="mb-1">Current session: {formatTokenCount(tokensUsed)} tokens</p>
              <p className="mb-1">Estimated cost: {formatPrice(cost)}</p>
              <p className="text-muted-foreground">Charged at $0.002 per token</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
