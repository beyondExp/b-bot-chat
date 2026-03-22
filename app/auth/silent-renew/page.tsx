"use client"

import { useEffect, useState } from "react"
import { UserManager } from "oidc-client-ts"
import { getZitadelUserManagerSettings } from "@/lib/zitadel-oidc"

export default function ZitadelSilentRenewPage() {
  const [status, setStatus] = useState<"working" | "ok" | "error">("working")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const mgr = new UserManager(getZitadelUserManagerSettings())
        await mgr.signinSilentCallback()
        if (cancelled) return
        setStatus("ok")
      } catch (e) {
        if (cancelled) return
        setStatus("error")
        setError(e instanceof Error ? e.message : String(e))
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center text-sm text-muted-foreground">
        {status === "working" ? "Refreshing session…" : null}
        {status === "ok" ? "OK" : null}
        {status === "error" ? <div className="text-red-600 break-words">{error}</div> : null}
      </div>
    </div>
  )
}

