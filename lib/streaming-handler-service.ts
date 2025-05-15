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
      onError = (error: string) => {},
      onScrollDown = () => {},
      onSetLoading = (loading: boolean) => {},
      onInterrupt = (interruptMessage: any) => {},
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

      // Dynamically import eventsource-parser
      const { createParser } = await import("eventsource-parser")

      const parser = createParser({
        onEvent: (event) => {
          try {
            // Handle interrupt events
            if (event.data && typeof event.data === "string" && event.data.includes("__interrupt__")) {
              let interruptData
              try {
                interruptData = JSON.parse(event.data)
              } catch (e) {
                interruptData = null
              }

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
                return
              }
            }

            // Handle different event types
            switch (event.event) {
              case "messages/metadata":
                // Optionally handle metadata
                break

              case "messages/partial": {
                let partialData
                try {
                  partialData = JSON.parse(event.data)
                } catch (e) {
                  partialData = null
                }

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
                break
              }

              case "updates": {
                let updatesData
                try {
                  updatesData = JSON.parse(event.data)
                } catch (e) {
                  updatesData = null
                }

                if (updatesData && updatesData.agent && updatesData.agent.messages) {
                  onUpdate(updatesData.agent.messages)
                  onSetLoading(false)
                  onScrollDown()
                }
                break
              }

              case "values": {
                let valuesData
                try {
                  valuesData = JSON.parse(event.data)
                } catch (e) {
                  valuesData = null
                }

                if (valuesData && valuesData.messages) {
                  onUpdate(valuesData.messages)
                  onSetLoading(false)
                  onScrollDown()
                }

                if (valuesData && valuesData.tool_events) {
                  onToolEvent(valuesData.tool_events)
                }
                break
              }

              case "error": {
                let errorData
                try {
                  errorData = JSON.parse(event.data).message
                } catch (e) {
                  errorData = event.data
                }

                onError(errorData)
                onSetLoading(false)
                break
              }

              default:
                // Optionally handle other event types
                break
            }
          } catch (e) {
            onError("[SSE-PARSER] Error handling event: " + e)
            onSetLoading(false)
          }
        },
      })

      // Process the stream
      const done = false
      while (!done) {
        const { value, done: streamDone } = await reader.read()
        if (streamDone) break
        const decoded = decoder.decode(value)
        parser.feed(decoded)
      }

      onSetLoading(false)
    } catch (error) {
      onError(error as string)
      onSetLoading(false)
    }
  }
}
