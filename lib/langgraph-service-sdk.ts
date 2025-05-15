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
          assistant_id: config.agent_id || "b-bot",
          user_id: config.user_id,
          metadata: config,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create thread: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
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
        throw new Error(`Failed to get thread: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
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
        throw new Error(`Failed to get thread history: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Add a message to a thread
  async addThreadMessage(threadId: string, message: { role: string; content: string }) {
    try {
      const response = await fetch(`${this.baseURL}/threads/${threadId}/messages`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          role: message.role,
          content: message.content,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to add message to thread: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Invoke a graph with streaming - updated to match the example payload structure
  async invokeGraphStream(agentId: string, threadId: string, options: any = {}) {
    try {
      // Use the proxy endpoint for streaming
      const url = `${this.baseURL}/threads/${threadId}/runs/stream`

      // Extract the user message from options
      let userMessage = ""
      if (options.messages && Array.isArray(options.messages) && options.messages.length > 0) {
        userMessage = options.messages[0]
      } else if (
        options.input &&
        options.input.messages &&
        Array.isArray(options.input.messages) &&
        options.input.messages.length > 0
      ) {
        userMessage = options.input.messages[0]
      } else if (typeof options.input === "string") {
        userMessage = options.input
      }

      // Format the request body according to the example payload structure
      const requestBody = {
        input: userMessage,
        config: {
          thread_id: threadId,
          agent_id: agentId,
          user_id: options.config?.entity_id || options.input?.entity_id || "anonymous-user",
          ability_id: options.config?.ability_id,
          model_id: options.config?.query_model || options.config?.response_model,
          apps: options.config?.apps || options.input?.apps || {},
          tool_activation: options.config?.tool_activation || {},
          document_urls: options.config?.document_urls || [],
          conversation_history: options.config?.conversation_history || [],
          temperature: options.config?.temperature,
          max_tokens: options.config?.max_tokens,
          top_p: options.config?.top_p,
          instructions: options.config?.instructions || options.config?.system_message,
          // Include any other fields from the config
          ...options.config,
        },
        stream_mode: ["values", "messages", "updates"],
        stream_subgraphs: true,
        subgraphs: true,
      }

      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Failed to invoke streaming graph: ${response.status}`)
      }

      return response
    } catch (error) {
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
      return []
    }
  }
}
