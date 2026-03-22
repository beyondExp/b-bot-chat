"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle } from "lucide-react"
import { useI18n } from "@/lib/i18n"

export default function PaymentSuccessPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)
  const { t } = useI18n()

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push("/")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full p-6 bg-card border border-border rounded-xl shadow-lg text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle size={64} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("payment.success")}</h1>
        <p className="text-muted-foreground mb-6">
          {t("paymentSuccess.body")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("paymentSuccess.redirect").replace("{seconds}", String(countdown))}
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          {t("paymentSuccess.returnNow")}
        </button>
      </div>
    </div>
  )
}
