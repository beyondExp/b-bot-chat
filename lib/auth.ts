import type { Auth0ProviderOptions } from "@auth0/auth0-react"

export const auth0Config: Auth0ProviderOptions = {
  domain: "b-bot-ai.eu.auth0.com",
  clientId: "RShGzaeQqPJwM850f6MwzyODEDD4wMwK",
  authorizationParams: {
    redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
    audience: process.env.NEXT_PUBLIC_SYNAPSE_URL || "http://localhost:2024",
    scope: "openid profile email",
  },
}
