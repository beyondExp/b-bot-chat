"use client"

import { useAuth0 } from "@auth0/auth0-react"
import { useCallback } from "react"
import { LANGGRAPH_AUDIENCE } from "./api"

export function useLangGraphService() {
  const { getAccessTokenSilently } = useAuth0()

  // Function to get the auth token
  const getAuthToken = useCallback(async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: LANGGRAPH_AUDIENCE,
        },
      })
      return token
    } catch (error) {
      console.error("Error getting auth token:", error)
      return null
    }
  }, [getAccessTokenSilently])

  // Create a new thread
  const createThread = useCallback(
    async (data: { user_id?: string; agent_id?: string } = {}) => {
      try {
        const token = await getAuthToken()
        if (!token) {
          throw new Error("No authentication token available")
        }

        const response = await fetch("https://api-staging.b-bot.space/api/v2/threads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
          },
          body: JSON.stringify(data),
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
    },
    [getAuthToken],
  )

  // Add a message to a thread
  const addThreadMessage = useCallback(
    async (threadId: string, content: string) => {
      try {
        const token = await getAuthToken()
        if (!token) {
          throw new Error("No authentication token available")
        }

        const response = await fetch(`https://api-staging.b-bot.space/api/v2/threads/${threadId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
          },
          body: JSON.stringify({
            role: "user",
            content,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to add message: ${response.status} - ${errorText}`)
        }

        return await response.json()
      } catch (error) {
        console.error("Error adding message:", error)
        throw error
      }
    },
    [getAuthToken],
  )

  // Run a thread
  const runThread = useCallback(
    async (
      threadId: string,
      assistantId: string,
      tools: any = {},
      options: { streamMode?: string[]; metadata?: any } = {},
    ) => {
      try {
        const token = await getAuthToken()
        if (!token) {
          throw new Error("No authentication token available")
        }

        const response = await fetch(`https://api-staging.b-bot.space/api/v2/threads/${threadId}/runs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
          },
          body: JSON.stringify({
            assistant_id: assistantId,
            tools,
            stream_mode: options.streamMode || ["messages"],
            metadata: options.metadata || {},
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Failed to run thread: ${response.status} - ${errorText}`)
        }

        return await response.json()
      } catch (error) {
        console.error("Error running thread:", error)
        throw error
      }
    },
    [getAuthToken],
  )

  return {
    createThread,
    addThreadMessage,
    runThread,
  }
}
