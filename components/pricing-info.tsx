"use client"

import { useState } from "react"
import { Info, X, DollarSign, Users, Sparkles } from "lucide-react"

export function PricingInfo() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
      >
        <Info size={14} />
        <span>Pricing</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h2 className="font-semibold text-lg">Pay-Per-Use Pricing</h2>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <DollarSign size={20} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium mb-1">Fair & Transparent Pricing</h3>
                  <p className="text-sm text-muted-foreground">
                    You only pay for what you use. Charges are based on token usage at a rate of $0.002 per token.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Users size={20} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium mb-1">Supporting Creators</h3>
                  <p className="text-sm text-muted-foreground">
                    30% of all revenue is distributed to AI Agent creators, supporting a fair and decentralized AI
                    ecosystem.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Sparkles size={20} className="text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium mb-1">Premium Experience</h3>
                  <p className="text-sm text-muted-foreground">
                    Access to all specialized AI agents with advanced capabilities and continuous improvements.
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="font-medium mb-2">Example Costs</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Short conversation (1,000 tokens)</span>
                    <span className="font-medium">$2.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medium conversation (5,000 tokens)</span>
                    <span className="font-medium">$10.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Long conversation (10,000 tokens)</span>
                    <span className="font-medium">$20.00</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
