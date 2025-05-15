import { getAuthToken, isLocallyAuthenticated } from "@/lib/api"

export class LangGraphService {
  private baseURL: string

  constructor() {
    // Use the API proxy endpoint instead of direct LangGraph API
    this.baseURL = "/api/proxy"
  }

  // Helper method to get headers with proper authentication
  private getHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // We don't need to set the API key here - the server will handle it
    // Just set the Authorization header if we have a token
    if (isLocallyAuthenticated()) {
      const token = getAuthToken()
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
    }

    return headers
  }

  // Create a new thread
  async createThread(config: any = {}) {
    try {
      const response = await fetch(`${this.baseURL}/threads`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          metadata: config,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create thread: ${response.status} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Error creating thread:", error)
      throw error
    }
  }

  // Get thread details
  async getThread(threadId: string) {
    try {
      const response = await fetch(`${this.baseURL}/threads/${threadId}`, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get thread: ${response.status} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Error getting thread ${threadId}:`, error)
      throw error
    }
  }

  // Get thread history
  async getThreadHistory(threadId: string, options: any = {}) {
    try {
      const queryParams = new URLSearchParams()

      if (options.limit) queryParams.append("limit", options.limit.toString())
      if (options.before) queryParams.append("before", options.before)
      if (options.checkpoint) queryParams.append("checkpoint", options.checkpoint)

      const url = `${this.baseURL}/threads/${threadId}/history?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get thread history: ${response.status} - ${errorText}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Error getting history for thread ${threadId}:`, error)
      throw error
    }
  }

  // Invoke a graph with streaming
  async invokeGraphStream(graphName: string, threadId: string, inputs: any = {}) {
    try {
      // Use the proxy endpoint for streaming
      const url = `${this.baseURL}/threads/${threadId}/runs/stream`

      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(inputs),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to invoke streaming graph: ${response.status} - ${errorText}`)
      }

      return response
    } catch (error) {
      console.error(`Failed to invoke streaming graph ${graphName}:`, error)
      throw error
    }
  }

  // Get messages from a thread
  async getThreadMessages(threadId: string) {
    try {
      // Get thread history with runs
      const history = await this.getThreadHistory(threadId)

      // Extract messages from runs
      if (!history || !history.runs) {
        return []
      }

      const messages: any[] = []
      const sortedRuns = [...history.runs].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )

      sortedRuns.forEach((run) => {
        // Extract user messages
        if (run.inputs && run.inputs.messages) {
          for (const msg of run.inputs.messages) {
            messages.push({
              role: "user",
              content: msg,
              timestamp: run.created_at,
              run_id: run.id,
            })
          }
        }

        // Extract assistant responses
        if (run.outputs && run.outputs.output) {
          messages.push({
            role: "assistant",
            content: run.outputs.output,
            timestamp: run.completed_at || run.created_at,
            intermediate_steps: run.outputs.intermediate_steps || [],
            run_id: run.id,
          })
        }
      })

      return messages
    } catch (error) {
      console.error(`Failed to get messages for thread ${threadId}:`, error)
      throw error
    }
  }
}
