"use client"

import { createContext, useContext } from "react"

export type AppAuthUser = {
  sub?: string
  name?: string
  email?: string
  picture?: string
  [key: string]: unknown
}

export type AppAuth = {
  provider: "auth0" | "zitadel"
  user: AppAuthUser | undefined
  isAuthenticated: boolean
  isLoading: boolean
  error: unknown
  loginWithRedirect: (options?: unknown) => Promise<void>
  logout: (options?: unknown) => void
  getAccessTokenSilently: (options?: unknown) => Promise<string>
}

export const AppAuthContext = createContext<AppAuth | null>(null)

export function useAppAuth(): AppAuth {
  const ctx = useContext(AppAuthContext)
  if (ctx) return ctx

  // During SSR/prerender (and during the initial client pass before providers mount),
  // we intentionally don't have an auth provider. Return a safe fallback.
  const provider = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "zitadel" ? "zitadel" : "auth0"

  return {
    provider,
    user: undefined,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    loginWithRedirect: async () => {
      throw new Error("Auth provider not initialized.")
    },
    logout: () => undefined,
    getAccessTokenSilently: async () => {
      throw new Error("Auth provider not initialized.")
    },
  }
}

