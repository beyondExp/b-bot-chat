"use client"

import { useEffect, useState } from "react"
import { UserManager } from "oidc-client-ts"
import { getZitadelUserManagerSettings } from "@/lib/zitadel-oidc"

export default function ZitadelCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const mgr = new UserManager(getZitadelUserManagerSettings())
        await mgr.signinRedirectCallback()
        if (cancelled) return
        window.location.replace("/")
      } catch (e) {
        if (cancelled) return
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
      <div className="max-w-md text-center">
        <div className="text-lg font-semibold">Signing you in…</div>
        {error ? <div className="mt-3 text-sm text-red-600 break-words">{error}</div> : null}
      </div>
    </div>
  )
}

