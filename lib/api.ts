"use client"

import { useAuth0 } from "@auth0/auth0-react"
import { useCallback } from "react"

const API_BASE_URL = "https://api-staging.b-bot.space/api/v2"
const API_V3_BASE_URL = "https://api-staging.b-bot.space/api/v3"
export const LANGGRAPH_AUDIENCE = "https://b-bot-synapse-d77722348fc853d1b327916929e45307.us.langgraph.app"

// Token cache (client-side only)
let cachedToken: string | null = null
let tokenExpiryTime: number | null = null

// Function to fetch data with authentication
export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    // Retrieve the access token
    const accessToken = localStorage.getItem("access_token")

    if (!accessToken) {
      throw new Error("No access token found. User must be authenticated.")
    }

    // Ensure headers are properly set
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    }

    console.log(`Making ${options.method || "GET"} request to ${API_BASE_URL}${endpoint}`)
    if (options.body) {
      console.log(`Request body: ${options.body}`)
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API error (${response.status}): ${errorText}`)
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`Response from ${endpoint}:`, data)
    return data
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error)
    throw error
  }
}

// Update the fetchWithServerAuth function to use GET
export async function fetchWithServerAuth(endpoint: string): Promise<any> {
  try {
    console.log(`Making server-authenticated request to ${endpoint}`)

    const response = await fetch(`/api/agents`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // No body sent with the request
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API error (${response.status}): ${errorText}`)
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`Response from server-authenticated request:`, data)
    return data
  } catch (error) {
    console.error(`Error in server-authenticated request:`, error)
    throw error
  }
}

// Custom hook for API calls that need authentication (client-side only)
export function useAuthenticatedFetch() {
  const { getAccessTokenSilently } = useAuth0()

  const getToken = useCallback(async () => {
    // Check if we have a valid cached token
    if (cachedToken && tokenExpiryTime && Date.now() < tokenExpiryTime) {
      console.log("Using cached token:", cachedToken.substring(0, 15) + "...")
      return cachedToken
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: LANGGRAPH_AUDIENCE,
        },
      })

      // Cache the token with a 50-minute expiry (tokens typically last 1 hour)
      cachedToken = token
      tokenExpiryTime = Date.now() + 50 * 60 * 1000

      // Also store in localStorage for the server API route to use
      localStorage.setItem("auth_token", token)

      console.log("Got new token:", token.substring(0, 15) + "...")
      return token
    } catch (error) {
      console.error("Error getting access token:", error)
      throw error
    }
  }, [getAccessTokenSilently])

  return useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      try {
        const token = await getToken()

        // Ensure headers are properly set
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        }

        console.log(`Making ${options.method || "GET"} request to ${API_BASE_URL}${endpoint}`)
        if (options.body) {
          console.log(`Request body: ${options.body}`)
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`API error (${response.status}): ${errorText}`)
          throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const data = await response.json()
        console.log(`Response from ${endpoint}:`, data)
        return data
      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error)
        throw error
      }
    },
    [getToken],
  )
}

// Also update the useApiKeyFetch hook to use the server API route
// Update the useApiKeyFetch hook to use GET
export function useApiKeyFetch() {
  return useCallback(async () => {
    try {
      console.log(`Making server-authenticated request via hook`)

      const response = await fetch(`/api/agents`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // No body or filters sent with the request
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API error (${response.status}): ${errorText}`)
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log(`Response from server-authenticated request:`, data)
      return data
    } catch (error) {
      console.error(`Error in server-authenticated request:`, error)
      throw error
    }
  }, [])
}

// New utility functions for authentication

/**
 * Get the authentication token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null

  // First try to get the token from auth_token (set by useAuthenticatedFetch)
  const authToken = localStorage.getItem("auth_token")
  if (authToken) {
    return authToken
  }

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

  // Check if we have an auth token
  const hasAuthToken = !!localStorage.getItem("auth_token")

  return isAuth0Authenticated || hasSynapseToken || hasAuthToken
}

/**
 * Clear all authentication data from localStorage
 */
export function clearAuthData(): void {
  if (typeof window === "undefined") return

  localStorage.removeItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.is.authenticated")
  localStorage.removeItem("auth0.RShGzaeQqPJwM850f6MwzyODEDD4wMwK.cache")
  localStorage.removeItem("synapseToken")
  localStorage.removeItem("auth_token")

  // Also clear the cached token
  cachedToken = null
  tokenExpiryTime = null
}
