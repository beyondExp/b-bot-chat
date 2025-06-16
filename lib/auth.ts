import type { Auth0ProviderOptions } from "@auth0/auth0-react"

export const auth0Config: Auth0ProviderOptions = {
  domain: "b-bot-ai.eu.auth0.com",
  clientId: "RShGzaeQqPJwM850f6MwzyODEDD4wMwK",
  authorizationParams: {
    redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
    audience: "https://b-bot-synapse-7da200fd4cf05d3d8cc7f6262aaa05ee.eu.langgraph.app",
    scope: "openid profile email",
  },
}
