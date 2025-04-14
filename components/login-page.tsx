"use client"

import { useAuth0 } from "@auth0/auth0-react"
import { Sparkles } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

export function LoginPage() {
  const { loginWithRedirect, isLoading, error } = useAuth0()
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isAttemptingLogin, setIsAttemptingLogin] = useState(false)

  const handleLogin = async () => {
    try {
      setIsAttemptingLogin(true)
      await loginWithRedirect({
        appState: {
          returnTo: window.location.pathname,
        },
      })
    } catch (err) {
      console.error("Login error:", err)
      setLoginError("Failed to login. Please try again.")
      setIsAttemptingLogin(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-background to-muted">
      <div className="w-full max-w-md p-6 space-y-6 bg-card rounded-xl shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 relative flex items-center justify-center mb-4">
            <Image src="/logo.svg" alt="Beyond-Bot.ai Logo" width={64} height={64} className="dark:invert" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Beyond-Bot.ai</h1>
          <p className="text-muted-foreground mt-2">Chat with AI agents powered by advanced language models</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-2 p-4 bg-muted rounded-lg">
            <Sparkles size={20} className="text-primary" />
            <p className="text-sm">Access specialized AI agents for various domains</p>
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm">
              Authentication error. Please try again or contact support.
            </div>
          )}

          {loginError && <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm">{loginError}</div>}

          <button
            onClick={handleLogin}
            disabled={isLoading || isAttemptingLogin}
            className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center"
          >
            {isLoading || isAttemptingLogin ? (
              <>
                <span className="mr-2">Loading...</span>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </>
            ) : (
              "Sign in to continue"
            )}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Beyond-Bot.ai © {new Date().getFullYear()} | All rights reserved
        </p>
      </div>
    </div>
  )
}
