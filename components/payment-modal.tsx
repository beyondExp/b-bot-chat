"use client"

import type React from "react"

import { useState } from "react"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { stripePromise, formatPrice, formatTokenCount } from "@/lib/stripe"
import { X, CreditCard, Coins, Info, Check, AlertCircle } from "lucide-react"

interface PaymentFormProps {
  clientSecret: string
  onSuccess: () => void
  onCancel: () => void
}

function PaymentForm({ clientSecret, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment-success`,
      },
      redirect: "if_required",
    })

    if (error) {
      setMessage(error.message || "An error occurred while processing your payment.")
      setIsSuccess(false)
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      setMessage("Payment successful!")
      setIsSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 2000)
    } else {
      setMessage("Something went wrong.")
      setIsSuccess(false)
    }

    setIsProcessing(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {message && (
        <div
          className={`p-3 rounded-md flex items-center gap-2 ${isSuccess ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
          {isSuccess ? <Check size={16} /> : <AlertCircle size={16} />}
          <span>{message}</span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 px-4 border border-border rounded-md hover:bg-muted transition-colors"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || !elements || isProcessing}
          className="flex-1 py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isProcessing ? "Processing..." : "Add Funds"}
        </button>
      </div>
    </form>
  )
}

interface PaymentModalProps {
  onClose: () => void
  currentBalance: number
  tokensUsed: number
}

export function PaymentModal({ onClose, currentBalance, tokensUsed }: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [selectedAmount, setSelectedAmount] = useState(1000) // $10.00 default
  const [isCustomAmount, setIsCustomAmount] = useState(false)
  const [customAmount, setCustomAmount] = useState("10.00")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)

  const predefinedAmounts = [
    { value: 500, label: "$5" },
    { value: 1000, label: "$10" },
    { value: 2000, label: "$20" },
    { value: 5000, label: "$50" },
  ]

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount)
    setIsCustomAmount(false)
  }

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow numbers and a single decimal point
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setCustomAmount(value)
      // Convert to cents
      const amountInCents = Math.round(Number.parseFloat(value || "0") * 100)
      setSelectedAmount(amountInCents)
    }
  }

  const createPaymentIntent = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: selectedAmount }),
      })

      const data = await response.json()

      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setStep(2)
      } else {
        console.error("Failed to create payment intent:", data.error)
      }
    } catch (error) {
      console.error("Error creating payment intent:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuccess = () => {
    // In a real app, you would update the user's balance in the database
    // and then refresh the UI
    onClose()
  }

  // Calculate token estimates
  const estimatedTokens = Math.floor(selectedAmount / 0.2) // At $0.002 per token

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Your Wallet</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {step === 1 ? (
            <>
              <div className="mb-6 space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Coins size={18} className="text-primary" />
                    <span className="font-medium">Current Balance</span>
                  </div>
                  <span className="font-semibold">{formatPrice(currentBalance)}</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info size={18} className="text-primary" />
                    <span className="font-medium">Tokens Used</span>
                  </div>
                  <span className="font-semibold">{formatTokenCount(tokensUsed)}</span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-medium mb-2">Add Funds</h3>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {predefinedAmounts.map((amount) => (
                    <button
                      key={amount.value}
                      className={`p-2 rounded-md border ${
                        selectedAmount === amount.value && !isCustomAmount
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                      onClick={() => handleAmountSelect(amount.value)}
                    >
                      {amount.label}
                    </button>
                  ))}
                </div>

                <div className="mb-4">
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="custom-amount"
                      checked={isCustomAmount}
                      onChange={() => setIsCustomAmount(!isCustomAmount)}
                      className="mr-2"
                    />
                    <label htmlFor="custom-amount" className="text-sm">
                      Custom amount
                    </label>
                  </div>

                  {isCustomAmount && (
                    <div className="flex items-center">
                      <span className="mr-2">$</span>
                      <input
                        type="text"
                        value={customAmount}
                        onChange={handleCustomAmountChange}
                        className="w-full p-2 border border-border rounded-md"
                        placeholder="Enter amount"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                <div className="p-3 bg-muted/50 rounded-lg mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm">Estimated tokens</span>
                    <span className="font-medium">{formatTokenCount(estimatedTokens)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">At a rate of $0.002 per token</div>
                </div>

                <button
                  onClick={createPaymentIntent}
                  disabled={selectedAmount < 100 || isLoading}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    "Processing..."
                  ) : (
                    <>
                      <CreditCard size={16} />
                      <span>Continue to Payment</span>
                    </>
                  )}
                </button>
              </div>

              <div className="border-t border-border pt-4 text-sm text-muted-foreground space-y-2">
                <p className="flex items-start gap-2">
                  <Info size={16} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Pay only for what you use. Charges are based on token usage at a rate of $0.002 per token.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <Info size={16} className="flex-shrink-0 mt-0.5" />
                  <span>
                    30% of all revenue is distributed to AI Agent creators, supporting a fair and decentralized AI
                    ecosystem.
                  </span>
                </p>
              </div>
            </>
          ) : (
            <>
              {clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm clientSecret={clientSecret} onSuccess={handleSuccess} onCancel={() => setStep(1)} />
                </Elements>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
