"use client"

import { LogOut, Settings, User, LogIn, Languages, Sparkles } from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppAuth } from "@/lib/app-auth"
import { clearAuthData, isLocallyAuthenticated } from "@/lib/api"
import { flagForLocale, SUPPORTED_LOCALES, useI18n, type Locale } from "@/lib/i18n"

export function UserProfile() {
  const { user, logout, isAuthenticated, loginWithRedirect, isLoading } = useAppAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [localAuthState, setLocalAuthState] = useState(false)
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)
  const router = useRouter()
  const { t, locale, setLocale } = useI18n()

  // Check for local storage auth state on mount
  useEffect(() => {
    setLocalAuthState(isLocallyAuthenticated())

    // Log auth state for debugging
    console.log("Auth state:", {
      isAuthenticated,
      isLoading,
      localAuth: isLocallyAuthenticated(),
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
        title={t("auth.signIn")}
      >
        <LogIn size={20} className="text-muted-foreground hover:text-primary" />
      </button>
    )
  }

  const handleLogout = () => {
    clearAuthData()

    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    })
  }

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label={t("auth.userProfile")}
      >
        <div className="w-8 h-8 rounded-[1rem] overflow-hidden border border-border">
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
              <div className="w-10 h-10 rounded-[1rem] overflow-hidden border border-border">
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
              onClick={() => setShowLanguagePicker((v) => !v)}
              aria-label={t("settings.language")}
            >
              <Languages size={16} />
              <span>{t("settings.language")}</span>
              <span className="ml-auto text-lg leading-none">{flagForLocale(locale)}</span>
            </button>

            {showLanguagePicker && (
              <div className="px-2 pb-2">
                <div className="grid grid-cols-4 gap-1 rounded-md border border-border bg-background p-2">
                  {(SUPPORTED_LOCALES as readonly Locale[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={[
                        "flex items-center justify-center rounded-md p-2 text-xl leading-none hover:bg-muted",
                        l === locale ? "bg-muted" : "",
                      ].join(" ")}
                      onClick={() => {
                        setLocale(l)
                        setShowLanguagePicker(false)
                      }}
                      aria-label={t(`lang.${l}`)}
                      title={t(`lang.${l}`)}
                    >
                      {flagForLocale(l)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="w-full flex items-center gap-2 p-2 text-sm hover:bg-muted rounded-md transition-colors"
              onClick={() => {
                router.push("/account?tab=chatProfile")
                setShowDropdown(false)
              }}
            >
              <Sparkles size={16} />
              <span>{t("account.nav.chatProfile")}</span>
            </button>

            <button
              className="w-full flex items-center gap-2 p-2 text-sm hover:bg-muted rounded-md transition-colors"
              onClick={() => {
                router.push("/account")
                setShowDropdown(false)
              }}
            >
              <Settings size={16} />
              <span>{t("auth.accountBilling")}</span>
            </button>
            <button
              className="w-full flex items-center gap-2 p-2 text-sm hover:bg-muted rounded-md transition-colors"
              onClick={() => {
                router.push("/account?tab=chatProfile")
                setShowDropdown(false)
              }}
            >
              <User size={16} />
              <span>{t("account.nav.chatProfile")}</span>
            </button>
            <button
              className="w-full flex items-center gap-2 p-2 text-sm text-destructive hover:bg-muted rounded-md transition-colors"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              <span>{t("auth.signOut")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
