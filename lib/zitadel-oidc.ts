"use client"

import type { UserManagerSettings } from "oidc-client-ts"
import { WebStorageStateStore } from "oidc-client-ts"

export function getZitadelUserManagerSettings(): UserManagerSettings {
  if (typeof window === "undefined") {
    throw new Error("Zitadel OIDC settings require a browser environment.")
  }

  const authority = process.env.NEXT_PUBLIC_ZITADEL_AUTHORITY || ""
  const client_id = process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID || ""
  const scope = process.env.NEXT_PUBLIC_ZITADEL_SCOPES || "openid profile email"
  const resource = process.env.NEXT_PUBLIC_ZITADEL_RESOURCE || ""

  if (!authority) throw new Error("Missing NEXT_PUBLIC_ZITADEL_AUTHORITY")
  if (!client_id) throw new Error("Missing NEXT_PUBLIC_ZITADEL_CLIENT_ID")

  const settings: UserManagerSettings = {
    authority,
    client_id,
    redirect_uri: `${window.location.origin}/auth/callback`,
    silent_redirect_uri: `${window.location.origin}/auth/silent-renew`,
    post_logout_redirect_uri: window.location.origin,
    response_type: "code",
    scope,
    automaticSilentRenew: true,
    loadUserInfo: true,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
  }

  if (resource) {
    settings.extraQueryParams = { resource }
  }

  return settings
}

