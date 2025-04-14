"use client"

import type React from "react"
import { useAuth0 } from "@auth0/auth0-react"
import { LandingPage } from "./landing-page"
import { useEffect, useState } from "react"
import { PostLoginPWAPrompt } from "./post-login-pwa-prompt"
import { useSearchParams, useRouter } from "next/navigation"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, error, loginWithRedirect } = useAuth0()
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [showPWAPrompt, setShowPWAPrompt] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Check if user is trying to access B-Bot specifically
  const agent = searchParams.get("agent")
  const isBBotAccess = agent === "b-bot"

  // Add a timeout to prevent getting stuck in loading state
  useEffect(() => {
    // Set a timeout to bypass loading state if it takes too long
    const timer = setTimeout(() => {
      setLoadingTimeout(true)
    }, 5000) // 5 seconds timeout

    return () => clearTimeout(timer)
  }, [])

  // Handle Auth0 errors
  useEffect(() => {
    if (error) {
      console.error("Auth0 error:", error)
    }
  }, [error])

  // Show PWA prompt after successful login
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      // Check if this was a fresh login
      const lastLoginTime = localStorage.getItem("last-login-time")
      const currentTime = Date.now()

      if (!lastLoginTime || currentTime - Number.parseInt(lastLoginTime, 10) > 60 * 60 * 1000) {
        // It's been more than an hour since last login, consider it a fresh login
        setShowPWAPrompt(true)
      }

      // Update last login time
      localStorage.setItem("last-login-time", currentTime.toString())
    }
  }, [isAuthenticated, isLoading])

  // For development, bypass authentication
  const isDevelopment = process.env.NODE_ENV === "development"
  if (isDevelopment) {
    return (
      <>
        {children}
        {showPWAPrompt && <PostLoginPWAPrompt />}
      </>
    )
  }

  // If loading takes too long, show a retry button
  if (isLoading && !loadingTimeout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg mb-4">Loading...</div>
      </div>
    )
  }

  // If loading timed out or there was an error, show retry option
  if ((isLoading && loadingTimeout) || error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-lg mb-4">{error ? "Authentication error" : "Loading is taking longer than expected"}</div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-md">
          Retry
        </button>
        <button onClick={() => loginWithRedirect()} className="px-4 py-2 mt-2 bg-gray-200 text-gray-800 rounded-md">
          Sign in again
        </button>
      </div>
    )
  }

  // If not authenticated but trying to access B-Bot, allow access
  if (!isAuthenticated && isBBotAccess) {
    return <>{children}</>
  }

  // If not authenticated, show landing page
  if (!isAuthenticated) {
    return <LandingPage />
  }

  // If authenticated, show children
  return (
    <>
      {children}
      {showPWAPrompt && <PostLoginPWAPrompt />}
    </>
  )
}
