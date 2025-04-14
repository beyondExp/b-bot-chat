"use client"

import { useState, useEffect } from "react"
import { CreditCard, X } from "lucide-react"
import { formatPrice } from "@/lib/stripe"

interface AutoRechargeNotificationProps {
  amount: number
  onClose: () => void
}

export function AutoRechargeNotification({ amount, onClose }: AutoRechargeNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Allow time for fade-out animation
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  if (!isVisible) return null

  return (
    <div
      className={`fixed bottom-4 right-4 max-w-sm w-full bg-card border border-primary/20 rounded-lg shadow-lg p-4 transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-full">
          <CreditCard size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-medium">Auto Recharge Successful</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Your account has been automatically recharged with {formatPrice(amount)}.
          </p>
        </div>
      </div>
    </div>
  )
}
