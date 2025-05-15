import { Client } from "@langchain/langgraph-sdk"

// Update the LangGraphService class to use the correct authentication method
export class LangGraphService {
  private apiBaseUrl = "https://api-staging.b-bot.space/api/v2"
  private bbotApiKey = "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid"

  // Helper method to get headers with authentication
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "bbot-api-key": this.bbotApiKey,
    }

    // If we have a token in localStorage, add it as a backup
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token")
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
    }

    return headers
  }

  // Create a new thread
  async createThread(options: { user_id?: string; agent_id?: string }): Promise<any> {
    try {
      const { user_id, agent_id } = options

      const requestBody: any = {
        assistant_id: agent_id || "b-bot",
      }

      if (user_id) {
        requestBody.user_id = user_id
      }

      const response = await fetch(`${this.apiBaseUrl}/threads`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Error creating thread (${response.status}): ${errorText}`)
        throw new Error(`Failed to create thread: ${response.status} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Error in createThread:", error)
      throw error
    }
  }

  // Add a message to a thread
  async addThreadMessage(
    threadId: string,
    message: { role: string; content: string; isBBotThread?: boolean },
  ): Promise<any> {
    try {
      // If this is an anonymous B-Bot thread, just return a success response
      if (message.isBBotThread && threadId.startsWith("bbot-anonymous-")) {
        console.log("Skipping message addition for anonymous B-Bot thread")
        return { success: true }
      }

      const response = await fetch(`${this.apiBaseUrl}/threads/${threadId}/messages`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          role: message.role,
          content: message.content,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Error adding message to thread (${response.status}): ${errorText}`)
        throw new Error(`Failed to add message to thread: ${response.status} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Error in addThreadMessage:", error)
      throw error
    }
  }

  // Run a thread with a specific assistant
  async runThread(threadId: string, assistantId: string, options: { messages: string[] }): Promise<any> {
    try {
      // If this is an anonymous B-Bot thread, return a simple response
      if (threadId.startsWith("bbot-anonymous-")) {
        console.log("Generating simple response for anonymous B-Bot thread")

        const userMessage = options.messages[0] || ""

        return {
          response: {
            role: "assistant",
            content: `I'm B-Bot, your AI assistant. I'm currently in anonymous mode with limited capabilities. ${
              userMessage.toLowerCase().includes("hello") || userMessage.toLowerCase().includes("hi")
                ? "Hello! How can I help you today?"
                : "How can I assist you further?"
            }`,
            id: `msg-${Date.now()}`,
            created_at: new Date().toISOString(),
          },
        }
      }

      const response = await fetch(`${this.apiBaseUrl}/threads/${threadId}/graph?assistant_id=${assistantId}`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages: options.messages,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Error running thread (${response.status}): ${errorText}`)
        throw new Error(`Failed to run thread: ${response.status} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Error in runThread:", error)
      throw error
    }
  }

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
  // async createThread(metadata: any = {}): Promise<any> {
  //   try {
  //     console.log("Creating thread with metadata:", metadata)

  //     // For B-Bot without authentication, create a mock thread
  //     if (metadata.agent_id === "b-bot" && !this.getAuthToken()) {
  //       console.log("Creating anonymous thread for B-Bot")
  //       return {
  //         thread_id: `bbot-anonymous-${Date.now()}`,
  //         created_at: new Date().toISOString(),
  //         user_id: "anonymous",
  //         agent_id: "b-bot",
  //         metadata: { anonymous: true },
  //       }
  //     }

  //     // Use the SDK client to create a thread
  //     return await this.client.threads.create({ metadata })
  //   } catch (error) {
  //     console.error("Failed to create thread:", error)

  //     // Provide a fallback for B-Bot
  //     if (metadata.agent_id === "b-bot") {
  //       console.log("Using fallback anonymous thread for B-Bot after error")
  //       return {
  //         thread_id: `bbot-anonymous-${Date.now()}`,
  //         created_at: new Date().toISOString(),
  //         user_id: "anonymous",
  //         agent_id: "b-bot",
  //         metadata: { anonymous: true, fallback: true },
  //       }
  //     }

  //     throw error
  //   }
  // }

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

  // async addThreadMessage(threadId: string, message: any): Promise<any> {
  //   try {
  //     // For anonymous threads, return a mock message
  //     if (threadId.startsWith("bbot-anonymous-")) {
  //       console.log("Using simplified response for anonymous thread message")
  //       return {
  //         id: `msg-${Date.now()}`,
  //         thread_id: threadId,
  //         role: message.role || "user",
  //         content: message.content,
  //         created_at: new Date().toISOString(),
  //       }
  //     }

  //     // Use the SDK client to add a message
  //     return await this.client.threads.addMessage(threadId, message)
  //   } catch (error) {
  //     console.error(`Failed to add message to thread ${threadId}:`, error)

  //     // Provide a fallback for B-Bot threads
  //     if (message.isBBotThread) {
  //       console.log("Using fallback response for B-Bot thread message after error")
  //       return {
  //         id: `msg-${Date.now()}`,
  //         thread_id: threadId,
  //         role: message.role || "user",
  //         content: message.content,
  //         created_at: new Date().toISOString(),
  //       }
  //     }

  //     throw error
  //   }
  // }

  // Graph operations
  // async runThread(threadId: string, assistantId: string, inputs: any = {}): Promise<any> {
  //   try {
  //     // For anonymous B-Bot threads, return a mock response
  //     if (threadId.startsWith("bbot-anonymous-")) {
  //       console.log("Using simplified response for anonymous B-Bot thread")
  //       return {
  //         id: `run-${Date.now()}`,
  //         thread_id: threadId,
  //         assistant_id: assistantId,
  //         status: "completed",
  //         response: {
  //           role: "assistant",
  //           content: "Hello! I'm B-Bot, your AI assistant. How can I help you today?",
  //           id: `msg-${Date.now()}`,
  //           created_at: new Date().toISOString(),
  //         },
  //       }
  //     }

  //     // Use direct fetch for better control over the request
  //     const token = this.getAuthToken()
  //     const headers: Record<string, string> = {
  //       "Content-Type": "application/json",
  //       "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
  //     }

  //     if (token) {
  //       headers["Authorization"] = `Bearer ${token}`
  //     }

  //     console.log(`Running thread ${threadId} for assistant ${assistantId}`)

  //     const response = await fetch(`${this.baseURL}/threads/${threadId}/graph?assistant_id=${assistantId}`, {
  //       method: "POST",
  //       headers,
  //       body: JSON.stringify(inputs),
  //       credentials: "include",
  //     })

  //     if (!response.ok) {
  //       const errorText = await response.text()
  //       console.error(`Failed to run thread: ${response.status} - ${errorText}`)

  //       // Provide a fallback for B-Bot
  //       if (assistantId === "b-bot") {
  //         console.log("Using fallback response for B-Bot")
  //         return {
  //           id: `run-${Date.now()}`,
  //           thread_id: threadId,
  //           assistant_id: assistantId,
  //           status: "completed",
  //           response: {
  //             role: "assistant",
  //             content:
  //               "I'm sorry, I'm having trouble connecting to my knowledge base. How can I assist you with something simple?",
  //             id: `msg-${Date.now()}`,
  //             created_at: new Date().toISOString(),
  //           },
  //         }
  //       }

  //       throw new Error(`Failed to run thread: ${response.status} - ${errorText}`)
  //     }

  //     return response.json()
  //   } catch (error) {
  //     console.error("Error in runThread:", error)

  //     // Provide a fallback for B-Bot
  //     if (assistantId === "b-bot") {
  //       console.log("Using fallback response for B-Bot after error")
  //       return {
  //         id: `run-${Date.now()}`,
  //         thread_id: threadId,
  //         assistant_id: assistantId,
  //         status: "completed",
  //         response: {
  //           role: "assistant",
  //           content:
  //             "I apologize, but I'm experiencing technical difficulties. Please try again later or ask me a simple question.",
  //           id: `msg-${Date.now()}`,
  //           created_at: new Date().toISOString(),
  //         },
  //       }
  //     }

  //     throw error
  //   }
  // }

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
