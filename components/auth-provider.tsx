"use client"

import type React from "react"
import { Auth0Provider } from "@auth0/auth0-react"
import { useState, useEffect } from "react"

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isClient, setIsClient] = useState(false)

  // Only render Auth0Provider on the client side
  useEffect(() => {
    setIsClient(true)

    // Log auth state from localStorage for debugging
    const localAuth = localStorage.getItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.is.authenticated")
    console.log("Local storage auth state:", localAuth)
  }, [])

  // Handle Auth0 initialization errors
  const onError = (error: Error) => {
    console.error("Auth0 initialization error:", error)
  }

  // If not on client side yet, render children without Auth0Provider
  if (!isClient) {
    return <>{children}</>
  }

  return (
    <Auth0Provider
      domain="b-bot-ai.eu.auth0.com"
      clientId="RShGzaeQqPJwM850f6MwzyODEDD4wMwK"
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: "https://api.b-bot.space",
        scope: "openid profile email",
      }}
      onError={onError}
      skipRedirectCallback={window.location.pathname === "/api/auth/callback"}
      cacheLocation="localstorage" // Use localStorage instead of cookies
    >
      {children}
    </Auth0Provider>
  )
}
