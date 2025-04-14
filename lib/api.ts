// API utility functions

/**
 * Get the authentication token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null

  // Try to get the token from Auth0 storage
  try {
    const auth0Cache = localStorage.getItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.cache")
    if (auth0Cache) {
      const parsedCache = JSON.parse(auth0Cache)
      if (parsedCache?.body?.access_token) {
        return parsedCache.body.access_token
      }
    }
  } catch (e) {
    console.error("Error retrieving token from Auth0 cache:", e)
  }

  // Fallback to a direct token if stored
  return localStorage.getItem("synapseToken") || null
}

/**
 * Store a synapse token in localStorage
 */
export function storeSynapseToken(token: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem("synapseToken", token)
}

/**
 * Check if the user is authenticated based on localStorage
 */
export function isLocallyAuthenticated(): boolean {
  if (typeof window === "undefined") return false

  // Check Auth0 authentication flag
  const isAuth0Authenticated =
    localStorage.getItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.is.authenticated") === "true"

  // Check if we have a synapse token
  const hasSynapseToken = !!localStorage.getItem("synapseToken")

  return isAuth0Authenticated || hasSynapseToken
}

/**
 * Clear all authentication data from localStorage
 */
export function clearAuthData(): void {
  if (typeof window === "undefined") return

  localStorage.removeItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.is.authenticated")
  localStorage.removeItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.cache")
  localStorage.removeItem("synapseToken")
}
