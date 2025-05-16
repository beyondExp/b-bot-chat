import type { Auth0ProviderOptions } from "@auth0/auth0-react"

export const auth0Config: Auth0ProviderOptions = {
  domain: "b-bot-ai.eu.auth0.com",
  clientId: "RShGzaeQqPJwM850f6MwzyODEDD4wMwK",
  authorizationParams: {
    redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
    audience: "https://b-bot-synapse-d77722348fc853d1b327916929e45307.us.langgraph.app",
    scope: "openid profile email",
  },
}
