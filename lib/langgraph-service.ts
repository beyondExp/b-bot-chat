"use client"

import { useCallback, useState, useEffect } from "react"
import { getAuthToken } from "./api"

export function useLangGraphService() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = getAuthToken()
    setToken(storedToken)
  }, [])

  const createThread = useCallback(
    async (data: { user_id?: string; agent_id?: string } = {}): Promise<any> => {
      try {
        // Check if this is a B-Bot request
        const isBBotRequest = data.agent_id === "b-bot"
        console.log(`Creating thread for agent: ${data.agent_id}, is B-Bot: ${isBBotRequest}`)

        // Get auth token
        const authToken = token || getAuthToken()

        // For B-Bot, we'll use a simpler approach if no auth token is available
        if (isBBotRequest && !authToken) {
          console.log("Creating anonymous thread for B-Bot")
          // Return a mock thread for B-Bot when no authentication is available
          return {
            thread_id: `bbot-anonymous-${Date.now()}`,
            created_at: new Date().toISOString(),
            user_id: "anonymous",
            agent_id: "b-bot",
            metadata: { anonymous: true },
          }
        }

        // If not a B-Bot request and no auth token, throw error
        if (!isBBotRequest && !authToken) {
          console.error("No authentication token available for non-B-Bot agent")
          throw new Error("Authentication required for this agent")
        }

        // Set up headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
        }

        // Add auth token if available
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`
        }

        console.log(
          "Making API request to create thread with headers:",
          Object.keys(headers)
            .map((k) => `${k}: ${k === "Authorization" ? "Bearer [REDACTED]" : headers[k]}`)
            .join(", "),
        )

        const response = await fetch("https://api-staging.b-bot.space/api/v2/threads", {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to create thread: ${response.status} - ${errorText}`)

          // For B-Bot, provide a fallback even if the API call fails
          if (isBBotRequest) {
            console.log("Using fallback anonymous thread for B-Bot")
            return {
              thread_id: `bbot-anonymous-${Date.now()}`,
              created_at: new Date().toISOString(),
              user_id: "anonymous",
              agent_id: "b-bot",
              metadata: { anonymous: true, fallback: true },
            }
          }

          throw new Error(`Failed to create thread: ${response.status} - ${errorText}`)
        }

        const threadData = await response.json()
        console.log("Thread created successfully:", threadData)
        return threadData
      } catch (error) {
        console.error("Error in createThread:", error)

        // Provide a fallback for B-Bot even if there's an exception
        if (data.agent_id === "b-bot") {
          console.log("Using fallback anonymous thread for B-Bot after error")
          return {
            thread_id: `bbot-anonymous-${Date.now()}`,
            created_at: new Date().toISOString(),
            user_id: "anonymous",
            agent_id: "b-bot",
            metadata: { anonymous: true, fallback: true, error: true },
          }
        }

        throw error
      }
    },
    [token],
  )

  const runThread = useCallback(
    async (threadId: string, assistantId: string, input: any): Promise<any> => {
      try {
        // Check if this is a B-Bot request
        const isBBotRequest = assistantId === "b-bot"

        // Check if this is an anonymous thread
        const isAnonymousThread = threadId.startsWith("bbot-anonymous-")

        console.log(
          `Running thread ${threadId} for agent: ${assistantId}, is B-Bot: ${isBBotRequest}, is anonymous: ${isAnonymousThread}`,
        )

        // For anonymous B-Bot threads, use a simplified approach
        if (isAnonymousThread) {
          console.log("Using simplified response for anonymous B-Bot thread")
          // Return a mock response for anonymous B-Bot threads
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

        // Get auth token
        const authToken = token || getAuthToken()

        // If not a B-Bot request and no auth token, throw error
        if (!isBBotRequest && !authToken) {
          console.error("No authentication token available for non-B-Bot agent")
          throw new Error("Authentication required for this agent")
        }

        // Set up headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
        }

        // Add auth token if available
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`
        }

        console.log(
          "Making API request to run thread with headers:",
          Object.keys(headers)
            .map((k) => `${k}: ${k === "Authorization" ? "Bearer [REDACTED]" : headers[k]}`)
            .join(", "),
        )

        const response = await fetch(
          `https://api-staging.b-bot.space/api/v2/threads/${threadId}/graph?assistant_id=${assistantId}`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(input),
          },
        )

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to run thread: ${response.status} - ${errorText}`)

          // For B-Bot, provide a fallback even if the API call fails
          if (isBBotRequest) {
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

        return response
      } catch (error) {
        console.error("Error in runThread:", error)

        // Provide a fallback for B-Bot even if there's an exception
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
    },
    [token],
  )

  const addThreadMessage = useCallback(
    async (threadId: string, message: any): Promise<any> => {
      try {
        // Check if this is an anonymous thread
        const isAnonymousThread = threadId.startsWith("bbot-anonymous-")

        console.log(`Adding message to thread ${threadId}, is anonymous: ${isAnonymousThread}`)

        // For anonymous threads, just return a mock response
        if (isAnonymousThread) {
          console.log("Using simplified response for anonymous thread message")
          return {
            id: `msg-${Date.now()}`,
            thread_id: threadId,
            role: message.role || "user",
            content: message.content,
            created_at: new Date().toISOString(),
          }
        }

        // Check if this is a B-Bot thread (we'll need to pass this info)
        const isBBotThread = message.isBBotThread || false

        // Get auth token
        const authToken = token || getAuthToken()

        // If not a B-Bot thread and no auth token, throw error
        if (!isBBotThread && !authToken) {
          console.error("No authentication token available for non-B-Bot thread")
          throw new Error("Authentication required for this thread")
        }

        // Set up headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
        }

        // Add auth token if available
        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`
        }

        console.log(
          "Making API request to add message with headers:",
          Object.keys(headers)
            .map((k) => `${k}: ${k === "Authorization" ? "Bearer [REDACTED]" : headers[k]}`)
            .join(", "),
        )

        const response = await fetch(`https://api-staging.b-bot.space/api/v2/threads/${threadId}/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify(message),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to add message to thread: ${response.status} - ${errorText}`)

          // For B-Bot threads, provide a fallback
          if (isBBotThread) {
            console.log("Using fallback response for B-Bot thread message")
            return {
              id: `msg-${Date.now()}`,
              thread_id: threadId,
              role: message.role || "user",
              content: message.content,
              created_at: new Date().toISOString(),
            }
          }

          throw new Error(`Failed to add message to thread: ${response.status} - ${errorText}`)
        }

        return response.json()
      } catch (error) {
        console.error("Error in addThreadMessage:", error)

        // Provide a fallback for B-Bot threads even if there's an exception
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
    },
    [token],
  )

  return { createThread, runThread, addThreadMessage }
}
