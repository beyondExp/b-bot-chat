"use client"

import type React from "react"
import { Auth0Provider } from "@auth0/auth0-react"
import { AuthProvider as OidcProvider, useAuth as useOidcAuth } from "react-oidc-context"
import { useAuth0 } from "@auth0/auth0-react"
import { useMemo, useState, useEffect } from "react"
import { WebStorageStateStore } from "oidc-client-ts"
import { AppAuthContext, type AppAuth } from "@/lib/app-auth"

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isClient, setIsClient] = useState(false)

  const provider = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "zitadel" ? "zitadel" : "auth0"

  // Only render Auth0Provider on the client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // If not on client side yet, render children without Auth0Provider
  if (!isClient) {
    return <>{children}</>
  }

  const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN || "b-bot-ai.eu.auth0.com"
  const auth0ClientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || "RShGzaeQqPJwM850f6MwzyODEDD4wMwK"
  const auth0Audience =
    process.env.NEXT_PUBLIC_AUTH0_AUDIENCE || process.env.NEXT_PUBLIC_SYNAPSE_URL || "http://localhost:2024"

  const zitadelAuthority = process.env.NEXT_PUBLIC_ZITADEL_AUTHORITY || ""
  const zitadelClientId = process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || ""
  const zitadelScope = process.env.NEXT_PUBLIC_ZITADEL_SCOPES || "openid profile email"
  const zitadelResource = process.env.NEXT_PUBLIC_ZITADEL_RESOURCE || ""
  const isZitadelCallbackPath =
    window.location.pathname === "/auth/callback" || window.location.pathname === "/auth/silent-renew"
  const zitadelUserStore = new WebStorageStateStore({ store: window.localStorage })

  if (provider === "zitadel") {
    return (
      <OidcProvider
        authority={zitadelAuthority}
        client_id={zitadelClientId}
        redirect_uri={`${window.location.origin}/auth/callback`}
        silent_redirect_uri={`${window.location.origin}/auth/silent-renew`}
        post_logout_redirect_uri={window.location.origin}
        response_type="code"
        scope={zitadelScope}
        automaticSilentRenew={true}
        loadUserInfo={true}
        extraQueryParams={zitadelResource ? { resource: zitadelResource } : undefined}
        skipSigninCallback={isZitadelCallbackPath}
        userStore={zitadelUserStore}
        stateStore={zitadelUserStore}
      >
        <ZitadelBridge>{children}</ZitadelBridge>
      </OidcProvider>
    )
  }

  return (
    <Auth0Provider
      domain={auth0Domain}
      clientId={auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: auth0Audience,
        scope: "openid profile email",
      }}
      skipRedirectCallback={window.location.pathname === "/api/auth/callback"}
      cacheLocation="localstorage"
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  )
}

function Auth0Bridge({ children }: { children: React.ReactNode }) {
  const auth0 = useAuth0()

  const value: AppAuth = useMemo(() => {
    return {
      provider: "auth0",
      user: (auth0.user ?? undefined) as any,
      isAuthenticated: auth0.isAuthenticated,
      isLoading: auth0.isLoading,
      error: auth0.error,
      loginWithRedirect: async (options?: unknown) => {
        await auth0.loginWithRedirect(options as any)
      },
      logout: (options?: unknown) => {
        auth0.logout(options as any)
      },
      getAccessTokenSilently: async (options?: unknown) => {
        const token = (await auth0.getAccessTokenSilently(options as any)) as unknown as string
        localStorage.setItem("auth_token", token)
        return token
      },
    }
  }, [
    auth0.user,
    auth0.isAuthenticated,
    auth0.isLoading,
    auth0.error,
    auth0.loginWithRedirect,
    auth0.logout,
    auth0.getAccessTokenSilently,
  ])

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}

function ZitadelBridge({ children }: { children: React.ReactNode }) {
  const oidc = useOidcAuth()

  const value: AppAuth = useMemo(() => {
    const user = (oidc.user?.profile ?? undefined) as any

    return {
      provider: "zitadel",
      user,
      isAuthenticated: oidc.isAuthenticated,
      isLoading: oidc.isLoading,
      error: oidc.error,
      loginWithRedirect: async (options?: unknown) => {
        await oidc.signinRedirect(options as any)
      },
      logout: () => {
        oidc
          .signoutRedirect()
          .catch(() => oidc.removeUser().catch(() => undefined))
          .catch(() => undefined)
      },
      getAccessTokenSilently: async () => {
        // Don't trigger silent auth if the user isn't logged in yet
        if (!oidc.user || !oidc.isAuthenticated) {
          throw new Error("No access token available from Zitadel session.")
        }
        if (oidc.user && !oidc.user.expired && oidc.user.access_token) {
          localStorage.setItem("auth_token", oidc.user.access_token)
          return oidc.user.access_token
        }

        const refreshed = await oidc.signinSilent()
        if (!refreshed?.access_token) {
          throw new Error("No access token available from Zitadel session.")
        }
        localStorage.setItem("auth_token", refreshed.access_token)
        return refreshed.access_token
      },
    }
  }, [
    oidc.user,
    oidc.isAuthenticated,
    oidc.isLoading,
    oidc.error,
    oidc.signinRedirect,
    oidc.signoutRedirect,
    oidc.removeUser,
    oidc.signinSilent,
  ])

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}
