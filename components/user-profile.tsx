"use client"

import { useAuth0 } from "@auth0/auth0-react"
import { LogOut, Settings } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function UserProfile() {
  const { user, logout, isAuthenticated } = useAuth0()
  const [showDropdown, setShowDropdown] = useState(false)
  const router = useRouter()

  if (!isAuthenticated || !user) {
    return null
  }

  const handleLogout = () => {
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
          {user.picture ? (
            <Image
              src={user.picture || "/placeholder.svg"}
              alt={user.name || "User"}
              width={32}
              height={32}
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Image src="/logo.svg" alt="Beyond-Bot.ai Logo" width={16} height={16} className="dark:invert" />
            </div>
          )}
        </div>
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-lg border border-border z-50 overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-border">
                {user.picture ? (
                  <Image
                    src={user.picture || "/placeholder.svg"}
                    alt={user.name || "User"}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Image src="/logo.svg" alt="Beyond-Bot.ai Logo" width={20} height={20} className="dark:invert" />
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <p className="font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
