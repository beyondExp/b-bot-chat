"use client"

import { useEffect, useState } from "react"
import { UserManager } from "oidc-client-ts"
import { getZitadelUserManagerSettings } from "@/lib/zitadel-oidc"

export default function ZitadelCallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        // If Zitadel redirected back with an explicit OIDC error, show it directly.
        try {
          const params = new URLSearchParams(window.location.search || "")
          const err = params.get("error")
          const desc = params.get("error_description")
          if (err || desc) {
            const msg = [err, desc].filter(Boolean).join(": ")
            setError(msg || "Authentication error")
            setDetails(`url=${window.location.href}`)
            return
          }
        } catch {}

        const mgr = new UserManager(getZitadelUserManagerSettings())
        await mgr.signinRedirectCallback()
        if (cancelled) return
        window.location.replace("/")
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        // Add a high-signal hint for the most common Zitadel misconfig:
        // using a confidential "web app" client for a browser-only SPA PKCE flow.
        const lower = String(msg || "").toLowerCase()
        if (
          lower.includes("invalid_client") ||
          lower.includes("unauthorized_client") ||
          lower.includes("client authentication") ||
          lower.includes("invalid_client_secret") ||
          lower.includes("token endpoint") ||
          lower.includes("client_secret")
        ) {
          setDetails(
            [
              "Hint: This usually means the Zitadel application is configured as a confidential client (requires a client secret).",
              "For swiss-chat (browser SPA with PKCE), the Zitadel app must allow public clients (token auth method: none).",
              `Expected redirect URIs: ${window.location.origin}/auth/callback and ${window.location.origin}/auth/silent-renew`,
              `Authority: ${process.env.NEXT_PUBLIC_ZITADEL_AUTHORITY || "(missing)"}`,
              `Client ID: ${process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || "(missing)"}`,
            ].join("\n"),
          )
        } else {
          setDetails(
            [
              `Authority: ${process.env.NEXT_PUBLIC_ZITADEL_AUTHORITY || "(missing)"}`,
              `Client ID: ${process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || "(missing)"}`,
              `url=${window.location.href}`,
            ].join("\n"),
          )
        }
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
        {details ? (
          <pre className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
            {details}
          </pre>
        ) : null}
      </div>
    </div>
  )
}

