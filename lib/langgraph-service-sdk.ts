import { Client } from "@langchain/langgraph-sdk"

export class LangGraphService {
  private client: Client
  private baseURL: string

  constructor(baseURL = "https://api-staging.b-bot.space/api/v2") {
    this.baseURL = baseURL

    // Initialize the client with the token from localStorage
    const token = this.getAuthToken()

    this.client = new Client({
      apiUrl: baseURL,
      credentials: "include",
      defaultHeaders: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
      },
    })
  }

  // Helper method to get auth token from various sources
  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null

    // Try to get the token from auth_token (set by useAuthenticatedFetch)
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

  // Thread operations
  async createThread(metadata: any = {}): Promise<any> {
    try {
      console.log("Creating thread with metadata:", metadata)

      // For B-Bot without authentication, create a mock thread
      if (metadata.agent_id === "b-bot" && !this.getAuthToken()) {
        console.log("Creating anonymous thread for B-Bot")
        return {
          thread_id: `bbot-anonymous-${Date.now()}`,
          created_at: new Date().toISOString(),
          user_id: "anonymous",
          agent_id: "b-bot",
          metadata: { anonymous: true },
        }
      }

      // Use the SDK client to create a thread
      return await this.client.threads.create({ metadata })
    } catch (error) {
      console.error("Failed to create thread:", error)

      // Provide a fallback for B-Bot
      if (metadata.agent_id === "b-bot") {
        console.log("Using fallback anonymous thread for B-Bot after error")
        return {
          thread_id: `bbot-anonymous-${Date.now()}`,
          created_at: new Date().toISOString(),
          user_id: "anonymous",
          agent_id: "b-bot",
          metadata: { anonymous: true, fallback: true },
        }
      }

      throw error
    }
  }

  async getThread(threadId: string): Promise<any> {
    try {
      // For anonymous B-Bot threads, return a mock thread
      if (threadId.startsWith("bbot-anonymous-")) {
        return {
          id: threadId,
          created_at: new Date().toISOString(),
          metadata: { anonymous: true },
        }
      }

      return await this.client.threads.get(threadId)
    } catch (error) {
      console.error(`Failed to get thread ${threadId}:`, error)
      throw error
    }
  }

  async addThreadMessage(threadId: string, message: any): Promise<any> {
    try {
      // For anonymous threads, return a mock message
      if (threadId.startsWith("bbot-anonymous-")) {
        console.log("Using simplified response for anonymous thread message")
        return {
          id: `msg-${Date.now()}`,
          thread_id: threadId,
          role: message.role || "user",
          content: message.content,
          created_at: new Date().toISOString(),
        }
      }

      // Use the SDK client to add a message
      return await this.client.threads.addMessage(threadId, message)
    } catch (error) {
      console.error(`Failed to add message to thread ${threadId}:`, error)

      // Provide a fallback for B-Bot threads
      if (message.isBBotThread) {
        console.log("Using fallback response for B-Bot thread message after error")
        return {
          id: `msg-${Date.now()}`,
          thread_id: threadId,
          role: message.role || "user",
          content: message.content,
          created_at: new Date().toISOString(),
        }
      }

      throw error
    }
  }

  // Graph operations
  async runThread(threadId: string, assistantId: string, inputs: any = {}): Promise<any> {
    try {
      // For anonymous B-Bot threads, return a mock response
      if (threadId.startsWith("bbot-anonymous-")) {
        console.log("Using simplified response for anonymous B-Bot thread")
        return {
          id: `run-${Date.now()}`,
          thread_id: threadId,
          assistant_id: assistantId,
          status: "completed",
          response: {
            role: "assistant",
            content: "Hello! I'm B-Bot, your AI assistant. How can I help you today?",
            id: `msg-${Date.now()}`,
            created_at: new Date().toISOString(),
          },
        }
      }

      // Use direct fetch for better control over the request
      const token = this.getAuthToken()
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
      }

      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      console.log(`Running thread ${threadId} for assistant ${assistantId}`)

      const response = await fetch(`${this.baseURL}/threads/${threadId}/graph?assistant_id=${assistantId}`, {
        method: "POST",
        headers,
        body: JSON.stringify(inputs),
        credentials: "include",
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to run thread: ${response.status} - ${errorText}`)

        // Provide a fallback for B-Bot
        if (assistantId === "b-bot") {
          console.log("Using fallback response for B-Bot")
          return {
            id: `run-${Date.now()}`,
            thread_id: threadId,
            assistant_id: assistantId,
            status: "completed",
            response: {
              role: "assistant",
              content:
                "I'm sorry, I'm having trouble connecting to my knowledge base. How can I assist you with something simple?",
              id: `msg-${Date.now()}`,
              created_at: new Date().toISOString(),
            },
          }
        }

        throw new Error(`Failed to run thread: ${response.status} - ${errorText}`)
      }

      return response.json()
    } catch (error) {
      console.error("Error in runThread:", error)

      // Provide a fallback for B-Bot
      if (assistantId === "b-bot") {
        console.log("Using fallback response for B-Bot after error")
        return {
          id: `run-${Date.now()}`,
          thread_id: threadId,
          assistant_id: assistantId,
          status: "completed",
          response: {
            role: "assistant",
            content:
              "I apologize, but I'm experiencing technical difficulties. Please try again later or ask me a simple question.",
            id: `msg-${Date.now()}`,
            created_at: new Date().toISOString(),
          },
        }
      }

      throw error
    }
  }

  async runThreadStream(threadId: string, assistantId: string, inputs: any = {}): Promise<Response> {
    try {
      // For anonymous B-Bot threads, we can't stream, so throw an error
      if (threadId.startsWith("bbot-anonymous-")) {
        throw new Error("Streaming not supported for anonymous threads")
      }

      const token = this.getAuthToken()
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
      }

      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      console.log(`Streaming thread ${threadId} for assistant ${assistantId}`)

      const response = await fetch(`${this.baseURL}/threads/${threadId}/runs/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...inputs,
          assistant_id: assistantId,
        }),
        credentials: "include",
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error ${response.status}: ${errorText}`)
      }

      return response
    } catch (error) {
      console.error("Error in runThreadStream:", error)
      throw error
    }
  }

  // Assistant operations
  async getAssistants(limit = 10, offset = 0, metadata: any = {}, graphId: string | null = null): Promise<any> {
    try {
      const searchParams = {
        limit,
        offset,
        ...(Object.keys(metadata).length > 0 && { metadata }),
        ...(graphId && { graph_id: graphId }),
      }

      return await this.client.assistants.search(searchParams)
    } catch (error) {
      console.error("Failed to get assistants:", error)
      throw error
    }
  }

  async getAssistant(assistantId: string): Promise<any> {
    try {
      return await this.client.assistants.get(assistantId)
    } catch (error) {
      console.error(`Failed to get assistant ${assistantId}:`, error)
      throw error
    }
  }
}
