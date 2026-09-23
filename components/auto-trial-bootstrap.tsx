"use client"

import { useEffect, useRef } from "react"
import { useAppAuth } from "@/lib/app-auth"

const DONE_KEY = "bbot_auto_trial_done"
const ATTEMPT_KEY = "bbot_auto_trial_attempted"

/**
 * Starts the promised 15-day trial for freshly signed-up users.
 *
 * After login, if the resolved plan is still "free" (no subscription yet),
 * this fires one best-effort auto-trial request. Success is remembered in
 * localStorage; failures (e.g. the Datacenter user record not being synced
 * yet) are retried at most once per browser session.
 */
export function AutoTrialBootstrap() {
  const { isAuthenticated, getAccessTokenSilently } = useAppAuth()
  const startedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || startedRef.current) return
    if (typeof window === "undefined") return
    if (localStorage.getItem(DONE_KEY)) return
    if (sessionStorage.getItem(ATTEMPT_KEY)) return

    startedRef.current = true
    sessionStorage.setItem(ATTEMPT_KEY, "1")

    const run = async () => {
      let token = ""
      try {
        token = await getAccessTokenSilently()
      } catch {
        return
      }
      if (!token) return
      const headers = { Authorization: `Bearer ${token}` }

      // Skip when the user already has a paying/trialing plan.
      try {
        const quotaRes = await fetch("/api/quota", { headers })
        if (quotaRes.ok) {
          const quota = await quotaRes.json().catch(() => ({}))
          const plan = String(quota?.plan || "").toLowerCase()
          if (plan && plan !== "free") {
            localStorage.setItem(DONE_KEY, "1")
            return
          }
        }
      } catch {
        // quota endpoint unavailable — still attempt the trial below
      }

      try {
        const res = await fetch("/api/auto-trial", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ industry: "chat", plan: "starter", interval: "monthly" }),
        })
        if (res.ok) {
          localStorage.setItem(DONE_KEY, "1")
          console.log("[AutoTrial] Trial subscription started")
        } else {
          console.log("[AutoTrial] Trial not started (status", res.status + "), will retry next session")
        }
      } catch (error) {
        console.log("[AutoTrial] Trial request failed, will retry next session:", error)
      }
    }

    void run()
  }, [isAuthenticated, getAccessTokenSilently])

  return null
}
