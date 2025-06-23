import { getAuthToken, isLocallyAuthenticated } from "@/lib/api"

export class LangGraphService {
  private baseURL: string

  constructor() {
    // Use the API proxy endpoint instead of direct LangGraph API
    this.baseURL = "/api/proxy"
  }

  // Helper method to get headers with proper authentication
  private async getHeaders(authToken?: string) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Use provided token first, then fallback to localStorage
    const token = authToken || getAuthToken()
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
      console.log("[LangGraphService] Using auth token for request")
    } else {
      console.warn("[LangGraphService] No auth token available")
    }

    return headers
  }

  // Create a new thread
  async createThread(config: any = {}, headersOverride?: Record<string, string>) {
    try {
      const headers = headersOverride || await this.getHeaders()
      const response = await fetch(`${this.baseURL}/threads`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          assistant_id: config.agent_id || "bbot",
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
      const headers = await this.getHeaders()
      const response = await fetch(`${this.baseURL}/threads/${threadId}`, {
        method: "GET",
        headers,
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

      const headers = await this.getHeaders()
      const response = await fetch(url, {
        method: "GET",
        headers,
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
  async addThreadMessage(threadId: string, message: { role: string; content: string }, headersOverride?: Record<string, string>) {
    try {
      const headers = headersOverride || await this.getHeaders()
      const response = await fetch(`${this.baseURL}/threads/${threadId}/messages`, {
        method: "POST",
        headers,
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
  async invokeGraphStream(agentId: string, threadId: string, options: any = {}, headersOverride?: Record<string, string>) {
    try {
      // Use the proxy endpoint for streaming
      const url = `${this.baseURL}/threads/${threadId}/runs/stream`

      // Build the messages array as an array of objects
      let messages: any[] = []
      if (options.messages && Array.isArray(options.messages)) {
        messages = options.messages.map((msg: any) =>
          typeof msg === "string"
            ? { role: "user", content: msg }
            : msg
        )
      } else if (
        options.input &&
        options.input.messages &&
        Array.isArray(options.input.messages)
      ) {
        messages = options.input.messages.map((msg: any) =>
          typeof msg === "string"
            ? { role: "user", content: msg }
            : msg
        )
      } else if (typeof options.input === "string") {
        messages = [{ role: "user", content: options.input }]
      }

      // Compute entity_id as a mix of user id and agent id
      let userId = options.config?.user_id || options.input?.user_id || "anonymous-user"
      let entityId = "anonymous-entity"
      if (userId && agentId) {
        entityId = userId.replace(/[|\-]/g, '') + '_' + agentId
      }

      // Format the request body according to the expected payload structure
      const requestBody = {
        assistant_id: agentId || "bbot",
        input: { entity_id: entityId, messages },
        config: {
          thread_id: threadId,
          agent_id: agentId,
          user_id: userId,
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

      const headers = headersOverride || await this.getHeaders()
      const response = await fetch(url, {
        method: "POST",
        headers,
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
