"use client"

import { useState } from "react"
import { Wallet } from "lucide-react"
import { formatPrice } from "@/lib/stripe"
import { PaymentModal } from "./payment-modal"

interface UserWalletProps {
  balance: number
  tokensUsed: number
}

export function UserWallet({ balance, tokensUsed }: UserWalletProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
        onClick={() => setIsPaymentModalOpen(true)}
      >
        <Wallet size={16} />
        <span className="font-medium">{formatPrice(balance)}</span>
      </button>

      {isPaymentModalOpen && (
        <PaymentModal onClose={() => setIsPaymentModalOpen(false)} currentBalance={balance} tokensUsed={tokensUsed} />
      )}
    </div>
  )
}
