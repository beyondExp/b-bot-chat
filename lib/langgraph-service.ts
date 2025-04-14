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
      const authToken = token || getAuthToken()
      if (!authToken) {
        throw new Error("No authentication token available")
      }

      const response = await fetch("https://api-staging.b-bot.space/api/v2/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create thread: ${response.status} - ${errorText}`)
      }

      return await response.json()
    },
    [token],
  )

  const runThread = useCallback(
    async (threadId: string, assistantId: string, input: any): Promise<any> => {
      const authToken = token || getAuthToken()
      if (!authToken) {
        throw new Error("No authentication token available")
      }

      const response = await fetch(
        `https://api-staging.b-bot.space/api/v2/threads/${threadId}/graph?assistant_id=${assistantId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
          },
          body: JSON.stringify(input),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to invoke graph: ${response.status} - ${errorText}`)
      }

      return response
    },
    [token],
  )

  const addThreadMessage = useCallback(
    async (threadId: string, message: any): Promise<any> => {
      const authToken = token || getAuthToken()
      if (!authToken) {
        throw new Error("No authentication token available")
      }

      const response = await fetch(`https://api-staging.b-bot.space/api/v2/threads/${threadId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          "bbot-api-key": "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid",
        },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to add message to thread: ${response.status} - ${errorText}`)
      }

      return response.json()
    },
    [token],
  )

  return { createThread, runThread, addThreadMessage }
}
