export class StreamingHandlerService {
  /**
   * Process a streaming response from the backend.
   * @param {Response} response - The fetch response object (with .body as ReadableStream)
   * @param {Object} callbacks - Callback functions for UI updates
   */
  async processStream(
    response: Response,
    {
      onMessage = (msg: string) => {},
      onToolEvent = (event: any) => {},
      onUpdate = (messages: any[]) => {},
      onError = (err: string) => {},
      onScrollDown = () => {},
      onSetLoading = (loading: boolean) => {},
      onInterrupt = (interruptMsg: any) => {},
    } = {},
  ) {
    try {
      onSetLoading(true)
      if (!response || !response.body) {
        onError("Invalid response format")
        onSetLoading(false)
        return
      }

      const decoder = new TextDecoder()
      const reader = response.body.getReader()

      // Simple event parser
      const parseEvent = (data: string) => {
        const lines = data.split("\n")
        let eventName = ""
        let eventData = ""

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.substring(6).trim()
          } else if (line.startsWith("data:")) {
            eventData = line.substring(5).trim()
          }
        }

        return { eventName, eventData }
      }

      let buffer = ""
      let done = false

      while (!done) {
        const { value, done: streamDone } = await reader.read()
        if (streamDone) {
          done = true
          break
        }

        // Decode the chunk and add it to the buffer
        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Process complete events in the buffer
        const events = buffer.split("\n\n")
        buffer = events.pop() || "" // Keep the last incomplete event in the buffer

        for (const eventText of events) {
          if (!eventText.trim()) continue

          const { eventName, eventData } = parseEvent(eventText)
          if (!eventName || !eventData) continue

          try {
            // Handle different event types
            switch (eventName) {
              case "messages/partial": {
                try {
                  const partialData = JSON.parse(eventData)
                  if (partialData) {
                    if (Array.isArray(partialData[0])) {
                      // Subgraph or parent graph event
                      const messageData = Array.isArray(partialData[1])
                        ? Object.values(partialData[1])[0]
                        : partialData[0]
                      if (messageData && messageData.content !== undefined) {
                        onMessage(messageData.content)
                        onScrollDown()
                      }
                    } else if (partialData.content !== undefined) {
                      onMessage(partialData.content)
                      onScrollDown()
                    }
                  }
                } catch (e) {
                  // Silent error handling
                }
                break
              }
              case "updates": {
                try {
                  const updatesData = JSON.parse(eventData)
                  if (updatesData && updatesData.agent && updatesData.agent.messages) {
                    onUpdate(updatesData.agent.messages)
                    onSetLoading(false)
                    onScrollDown()
                  }
                } catch (e) {
                  // Silent error handling
                }
                break
              }
              case "values": {
                try {
                  const valuesData = JSON.parse(eventData)
                  if (valuesData && valuesData.messages) {
                    onUpdate(valuesData.messages)
                    onSetLoading(false)
                    onScrollDown()
                  }
                  if (valuesData && valuesData.tool_events) {
                    onToolEvent(valuesData.tool_events)
                  }
                } catch (e) {
                  // Silent error handling
                }
                break
              }
              case "error": {
                try {
                  const errorData = JSON.parse(eventData).message || eventData
                  onError(errorData)
                  onSetLoading(false)
                } catch (e) {
                  onError(eventData)
                  onSetLoading(false)
                }
                break
              }
            }

            // Check for interrupt messages
            if (eventData.includes("__interrupt__")) {
              try {
                const interruptData = JSON.parse(eventData)
                if (interruptData && interruptData.__interrupt__) {
                  // Format as a chat message for HITL
                  const interrupt = interruptData.__interrupt__
                  let hitl = null
                  let checkpointId = undefined
                  if (
                    interrupt &&
                    interrupt[0] &&
                    interrupt[0].value &&
                    interrupt[0].value[0] &&
                    interrupt[0].value[0].action_request
                  ) {
                    hitl = interrupt[0].value[0]
                    checkpointId = (interrupt[0].ns && interrupt[0].ns[0]) || undefined
                  }
                  const interruptMessage = {
                    id: `interrupt-${Date.now()}`,
                    type: "interrupt",
                    sender: "tool",
                    content: "",
                    interrupt: hitl,
                    timestamp: new Date().toISOString(),
                    checkpointId,
                  }
                  onInterrupt(interruptMessage)
                }
              } catch (e) {
                // Silent error handling
              }
            }
          } catch (e) {
            // Silent error handling for event processing
          }
        }
      }

      onSetLoading(false)
    } catch (error) {
      onError("Error processing stream")
      onSetLoading(false)
    }
  }
}
