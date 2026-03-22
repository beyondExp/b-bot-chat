"use client"

import { useState } from "react"
import { X, AlertCircle, CreditCard } from "lucide-react"
import { formatPrice } from "@/lib/stripe"
import { PaymentModal } from "./payment-modal"
import { useI18n } from "@/lib/i18n"

interface PaymentRequiredModalProps {
  isOpen: boolean
  onClose: () => void
  currentBalance: number
  onBalanceUpdated: (newBalance: number) => void
  onAutoRechargeChange?: (enabled: boolean) => void
}

export function PaymentRequiredModal({
  isOpen,
  onClose,
  currentBalance,
  onBalanceUpdated,
  onAutoRechargeChange,
}: PaymentRequiredModalProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showAutoRechargeOption, setShowAutoRechargeOption] = useState(true)
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false)
  const { t } = useI18n()

  // Don't render if not open
  if (!isOpen) {
    return null
  }

  const handlePaymentSuccess = () => {
    // In a real app, this would fetch the updated balance from the server
    // For demo purposes, we'll add $20 to the balance
    onBalanceUpdated(currentBalance + 2000)

    // Update auto recharge setting if enabled
    if (autoRechargeEnabled && onAutoRechargeChange) {
      onAutoRechargeChange(true)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      {showPaymentModal ? (
        <PaymentModal onClose={() => setShowPaymentModal(false)} currentBalance={currentBalance} tokensUsed={0} />
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-border">
            <h2 className="font-semibold text-lg">{t("paymentRequired.title")}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300 rounded-lg">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium">{t("paymentRequired.balanceTooLowTitle")}</h3>
                <p className="text-sm mt-1">
                  {t("paymentRequired.balanceTooLowBody").replace("{balance}", formatPrice(currentBalance))}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("paymentRequired.body")}
            </p>

            {showAutoRechargeOption && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-primary" />
                    <span className="font-medium">{t("paymentRequired.enableAutoRecharge")}</span>
                  </div>
                  <div className="relative inline-block w-10 h-5 transition duration-200 ease-in-out rounded-full">
                    <input
                      type="checkbox"
                      id="auto-recharge-toggle-modal"
                      className="absolute w-0 h-0 opacity-0"
                      checked={autoRechargeEnabled}
                      onChange={() => setAutoRechargeEnabled(!autoRechargeEnabled)}
                    />
                    <label
                      htmlFor="auto-recharge-toggle-modal"
                      className={`block h-5 overflow-hidden rounded-full cursor-pointer ${
                        autoRechargeEnabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`block h-5 w-5 rounded-full transform transition-transform duration-200 ease-in-out bg-white ${
                          autoRechargeEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {autoRechargeEnabled
                    ? t("paymentRequired.autoRechargeEnabledBlurb")
                    : t("paymentRequired.autoRechargeDisabledBlurb")}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 border border-border rounded-md hover:bg-muted transition-colors"
              >
                {t("payment.cancel")}
              </button>
              <button
                onClick={() => setShowPaymentModal(true)}
                className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard size={16} />
                <span>{autoRechargeEnabled ? t("paymentRequired.ctaAddFundsEnableAutoRecharge") : t("payment.addFunds")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
