"use client"

import { useAuth0 } from "@auth0/auth0-react"
import { LogOut, Settings, User, LogIn } from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export function UserProfile() {
  const { user, logout, isAuthenticated, loginWithRedirect, isLoading } = useAuth0()
  const [showDropdown, setShowDropdown] = useState(false)
  const [localAuthState, setLocalAuthState] = useState(false)
  const router = useRouter()

  // Check for local storage auth state on mount
  useEffect(() => {
    const localAuth = localStorage.getItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.is.authenticated") === "true"
    setLocalAuthState(localAuth)

    // Log auth state for debugging
    console.log("Auth state:", {
      isAuthenticated,
      isLoading,
      localAuth,
      hasUser: !!user,
    })
  }, [isAuthenticated, isLoading, user])

  // If still loading, show loading state
  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // If not authenticated (and not in a loading state), show login button
  if (!isAuthenticated && !localAuthState) {
    return (
      <button
        onClick={() => loginWithRedirect()}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
        title="Sign In"
      >
        <LogIn size={20} className="text-muted-foreground hover:text-primary" />
      </button>
    )
  }

  const handleLogout = () => {
    // Clear local storage auth state
    localStorage.removeItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.is.authenticated")

    // Call Auth0 logout
    logout({
      logoutParams: {
        returnTo: `${window.location.origin}/api/auth/logout`,
      },
    })
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="User profile"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
          {user?.picture ? (
            <Image
              src={user.picture || "/placeholder.svg"}
              alt={user.name || "User"}
              width={32}
              height={32}
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <User size={16} className="text-muted-foreground" />
            </div>
          )}
        </div>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-lg border border-border z-50 overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-border">
                {user?.picture ? (
                  <Image
                    src={user.picture || "/placeholder.svg"}
                    alt={user.name || "User"}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <User size={20} className="text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <p className="font-medium truncate">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || "user@example.com"}</p>
              </div>
            </div>
          </div>
          <div className="p-2">
            <button
              className="w-full flex items-center gap-2 p-2 text-sm hover:bg-muted rounded-md transition-colors"
              onClick={() => {
                router.push("/account")
                setShowDropdown(false)
              }}
            >
              <Settings size={16} />
              <span>Account & Billing</span>
            </button>
            <button
              className="w-full flex items-center gap-2 p-2 text-sm text-destructive hover:bg-muted rounded-md transition-colors"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
