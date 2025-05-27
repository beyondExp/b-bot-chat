import { createParser } from 'eventsource-parser';

export class StreamingHandlerService {
  constructor() {
    console.log('[StreamingHandlerService] VERSION: fallback-for-all-events');
  }

  /**
   * Process a streaming response from the backend.
   * @param {Response} response - The fetch response object (with .body as ReadableStream)
   * @param {Object} callbacks - Callback functions for UI updates
   */
  async processStream(
    response: Response,
    callbacks: Partial<{
      onMessage: (msg: { id?: string; content: string }) => void;
      onToolEvent: (event: any) => void;
      onUpdate: (messages: any[]) => void;
      onError: (err: string) => void;
      onScrollDown: () => void;
      onSetLoading: (loading: boolean) => void;
      onInterrupt: (interruptMsg: any) => void;
    }> = {},
  ) {
    console.log('[DEBUG] processStream called', response, callbacks);
    const {
      onMessage = (msg: { id?: string; content: string }) => {},
      onToolEvent = (event: any) => {},
      onUpdate = (messages: any[]) => {},
      onError = (err: string) => {},
      onScrollDown = () => {},
      onSetLoading = (loading: boolean) => {},
      onInterrupt = (interruptMsg: any) => {},
    } = callbacks;

    try {
      onSetLoading(true)
      if (!response || !response.body) {
        console.log('[DEBUG] Early return: response or response.body missing', response);
        onError("Invalid response format")
        onSetLoading(false)
        return
      }

      const decoder = new TextDecoder()
      const reader = response.body.getReader()

      // Track the last assistant message ID
      let lastAssistantMessageId: string | undefined = undefined;

      // Use eventsource-parser for robust SSE parsing
      const parser = createParser({
        onEvent(event: any) {
          console.log('[SSE][onEvent][TOP]', event);
          // Always run fallback for any event with data
          const eventData = event.data;
          if (!eventData) {
            console.log('[SSE][Event] Skipping event due to missing eventData:', event);
            return;
          }
          try {
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
                  console.log('[SSE][onInterrupt] interruptMessage:', interruptMessage);
                  onInterrupt(interruptMessage)
                }
              } catch (e) {
                console.error('[SSE][ERROR][interrupt]', e);
              }
            }
            // Fallback for all events: try to parse and call onUpdate if messages array found
            console.log('[SSE][Fallback][onUpdate] ENTERED for event:', event);
            try {
              const parsed = JSON.parse(eventData);
              console.log('[SSE][Fallback][onUpdate] After parse:', parsed, 'typeof:', typeof parsed, 'isArray:', Array.isArray(parsed));
              if (Array.isArray(parsed)) {
                console.log('[SSE][Fallback][onUpdate] parsed is array, length:', parsed.length);
                if (parsed.length > 0 && parsed[0].content !== undefined) {
                  console.log('[SSE][Fallback][onUpdate] Array[0] has content, FORCING onUpdate:', parsed);
                  console.log('[SSE][CALLING onUpdate] (fallback array)', parsed);
                  if (typeof onUpdate === 'function') {
                    onUpdate(parsed);
                    onSetLoading(false);
                    onScrollDown();
                  } else {
                    console.log('[SSE][Fallback][onUpdate] onUpdate is NOT a function:', onUpdate);
                  }
                } else {
                  console.log('[SSE][Fallback][onUpdate] Array[0] missing content or array empty:', parsed);
                }
              } else if (parsed && typeof parsed === 'object') {
                console.log('[SSE][Fallback][onUpdate] parsed is object, keys:', Object.keys(parsed));
                if (Array.isArray(parsed.messages)) {
                  console.log('[SSE][Fallback][onUpdate] Object has messages array, FORCING onUpdate:', parsed.messages);
                  console.log('[SSE][CALLING onUpdate] (fallback object)', parsed.messages);
                  if (typeof onUpdate === 'function') {
                    onUpdate(parsed.messages);
                    onSetLoading(false);
                    onScrollDown();
                  } else {
                    console.log('[SSE][Fallback][onUpdate] onUpdate is NOT a function:', onUpdate);
                  }
                } else {
                  console.log('[SSE][Fallback][onUpdate] Object missing messages array:', parsed);
                }
              } else {
                console.log('[SSE][Fallback][onUpdate] parsed is neither array nor object:', parsed);
              }
              console.log('[SSE][Fallback][onUpdate] EXIT fallback for eventData:', eventData);
            } catch (e) {
              console.error('[SSE][ERROR][fallback]', e);
              console.error('[SSE][Fallback][onUpdate] ERROR in fallback:', e, 'eventData:', eventData);
            }
          } catch (e) {
            console.error('[SSE][ERROR][main handler]', e);
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
