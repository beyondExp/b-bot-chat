import { createParser } from 'eventsource-parser';

export class StreamingHandlerService {
  /**
   * Process a streaming response from the backend.
   * @param {Response} response - The fetch response object (with .body as ReadableStream)
   * @param {Object} callbacks - Callback functions for UI updates
   */
  async processStream(
    response: Response,
    {
      onMessage = (msg: { id?: string; content: string }) => {},
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

      // Use eventsource-parser for robust SSE parsing
      const parser = createParser({
        onEvent(event: any) {
          console.log('[SSE][Parser onEvent]', event);
          if (event.type === 'event') {
            const eventName = event.event;
            const eventData = event.data;
            console.log('[SSE][Raw Event]', eventName, eventData);
            if (!eventName || !eventData) return;

            try {
              // Handle different event types
              switch (eventName) {
                case "messages/partial": {
                  try {
                    const partialData = JSON.parse(eventData)
                    // Try to extract id/run_id from the event data
                    let id = partialData.id || partialData.run_id
                    let content = partialData.content
                    if (Array.isArray(partialData[0])) {
                      // Subgraph or parent graph event
                      const messageData = Array.isArray(partialData[1])
                        ? Object.values(partialData[1])[0]
                        : partialData[0]
                      id = messageData.id || messageData.run_id
                      content = messageData.content
                      if (content !== undefined) {
                        onMessage({ id, content })
                        onScrollDown()
                      }
                    } else if (content !== undefined) {
                      onMessage({ id, content })
                      onScrollDown()
                    }
                  } catch (e) {
                    console.error('[SSE][Parse Error][messages/partial]', eventName, eventData, e);
                  }
                  break
                }
                case "updates": {
                  try {
                    const updatesData = JSON.parse(eventData)
                    console.log('[StreamingHandler] updatesData:', updatesData)
                    // If messages have IDs, pass them along
                    if (updatesData && updatesData.agent && updatesData.agent.messages) {
                      onUpdate(updatesData.agent.messages)
                      onSetLoading(false)
                      onScrollDown()
                    }
                  } catch (e) {
                    console.error('[SSE][Parse Error][updates]', eventName, eventData, e);
                  }
                  break
                }
                case "values": {
                  try {
                    const valuesData = JSON.parse(eventData)
                    console.log('[StreamingHandler] valuesData:', valuesData)
                    if (valuesData && valuesData.messages) {
                      onUpdate(valuesData.messages)
                      onSetLoading(false)
                      onScrollDown()
                    }
                    if (valuesData && valuesData.tool_events) {
                      onToolEvent(valuesData.tool_events)
                    }
                  } catch (e) {
                    console.error('[SSE][Parse Error][values]', eventName, eventData, e);
                  }
                  break
                }
                case "error": {
                  try {
                    const errorData = JSON.parse(eventData).message || eventData
                    onError(errorData)
                    onSetLoading(false)
                  } catch (e) {
                    console.error('[SSE][Parse Error][error]', eventName, eventData, e);
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
                  console.error('[SSE][Parse Error][interrupt]', eventName, eventData, e);
                }
              }
            } catch (e) {
              console.error('[SSE][Event Handler Error]', eventName, eventData, e);
            }
          }
        }
      });

      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) {
          done = true;
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        console.log('[SSE][Chunk]', chunk);
        parser.feed(chunk);
      }

      onSetLoading(false)
    } catch (error) {
      onError("Error processing stream: " + error)
      onSetLoading(false)
    }
  }
}
