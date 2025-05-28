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
      onUpdate: (messages: any[], options?: { replace: boolean }) => void;
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
      onUpdate = (messages: any[], options?: { replace: boolean }) => {},
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

      // Buffer for incomplete JSON chunks
      let buffer = '';

      // Use eventsource-parser for robust SSE parsing
      let lastEventType: string | null = null;
      const parser = createParser({
        onEvent(event: any) {
          console.log('[SSE][onEvent][TOP]', event);
          try {
            // Track last event type
            if (event.event) {
              lastEventType = event.event;
            }
            // Skip blank or heartbeat data
            if (!event.data || event.data.trim() === '' || event.data.includes('heartbeat')) {
              return;
            }
            // If last event was 'values' and this is a data line, process as values
            if (lastEventType === 'values') {
              let parsed;
              try {
                parsed = JSON.parse(event.data);
              } catch (e) {
                return;
              }
              if (parsed && Array.isArray(parsed.messages)) {
                onUpdate(parsed.messages, { replace: true });
                onSetLoading(false);
                onScrollDown();
              }
              lastEventType = null; // Reset after processing
              return;
            }
            // Interrupt handling (unchanged)
            if (event.data && typeof event.data === 'string' && event.data.includes('__interrupt__')) {
              let interruptData;
              try {
                interruptData = JSON.parse(event.data);
              } catch (e) {
                interruptData = null;
              }
              if (interruptData && interruptData.__interrupt__) {
                // Format as a chat message for HITL
                const interrupt = interruptData.__interrupt__;
                let hitl = null;
                let checkpointId = undefined;
                if (interrupt && interrupt[0] && interrupt[0].value && interrupt[0].value[0] && interrupt[0].value[0].action_request) {
                  hitl = interrupt[0].value[0];
                  checkpointId = (interrupt[0].ns && interrupt[0].ns[0]) || undefined;
                }
                const interruptMessage = {
                  id: `interrupt-${Date.now()}`,
                  type: 'interrupt',
                  sender: 'tool',
                  content: '',
                  interrupt: hitl,
                  timestamp: new Date().toISOString(),
                  checkpointId,
                };
                onInterrupt(interruptMessage);
                return;
              }
            }

            // Robust event-based handling
            switch (event.event) {
              case 'messages/metadata': {
                // Optionally handle metadata for tool/agent run tracking
                // (Omitted for brevity, add if needed)
                break;
              }
              case 'messages/partial': {
                let partialData;
                try {
                  partialData = JSON.parse(event.data);
                } catch (e) {
                  partialData = null;
                }
                // Robust subgraph/metadata detection
                if (Array.isArray(partialData) && Array.isArray(partialData[0]) && partialData.length > 1 && partialData[1] && typeof partialData[1] === 'object') {
                  const namespace = partialData[0];
                  const data = partialData[1];
                  const values = data ? Object.values(data) : [];
                  const messageData: any = values.length > 0 ? values[0] : null;
                  if (namespace.length > 0 && messageData) {
                    // Tool event
                    if (messageData.status === 'success') {
                      messageData.status = 'success';
                    } else {
                      messageData.status = 'processing';
                    }
                    onToolEvent([messageData]);
                    return;
                  } else if (messageData) {
                    // Main AI message (full object)
                    onMessage(messageData);
                    return;
                  }
                }
                // Fallback: treat as main AI message (full object)
                if (Array.isArray(partialData) && partialData[0]) {
                  const message = partialData[0];
                  onMessage(message);
                }
                break;
              }
              case 'updates': {
                let updatesData;
                try {
                  updatesData = JSON.parse(event.data);
                } catch (e) {
                  updatesData = null;
                }
                if (updatesData && updatesData.agent && updatesData.agent.messages) {
                  onUpdate(updatesData.agent.messages, { replace: false });
                  onSetLoading(false);
                  onScrollDown();
                }
                break;
              }
              case 'values': {
                let valuesData;
                try {
                  valuesData = JSON.parse(event.data);
                } catch (e) {
                  valuesData = null;
                }
                if (valuesData && valuesData.messages) {
                  onUpdate(valuesData.messages, { replace: true });
                  onSetLoading(false);
                  onScrollDown();
                }
                if (valuesData && valuesData.tool_events) {
                  onToolEvent(valuesData.tool_events);
                }
                break;
              }
              case 'error': {
                let errorData;
                try {
                  errorData = JSON.parse(event.data).message;
                } catch (e) {
                  errorData = event.data;
                }
                onError(errorData);
                onSetLoading(false);
                break;
              }
              case 'messages/complete': {
                // Optionally handle completion/cleanup
                break;
              }
              default: {
                // Fallback: try to parse and call onUpdate if messages array found
                let parsed;
                try {
                  parsed = JSON.parse(event.data);
                } catch (e) {
                  // If JSON is incomplete, skip
                  return;
                }
                if (parsed && (parsed.tool_calls || (parsed.additional_kwargs && parsed.additional_kwargs.tool_calls))) {
                  if (typeof onToolEvent === 'function') {
                    onToolEvent(parsed.tool_calls || parsed.additional_kwargs.tool_calls);
                  }
                }
                if (Array.isArray(parsed)) {
                  if (parsed.length > 0 && parsed[0].content !== undefined) {
                    if (typeof onUpdate === 'function') {
                      onUpdate(parsed);
                      onSetLoading(false);
                      onScrollDown();
                    }
                  }
                } else if (parsed && typeof parsed === 'object') {
                  if (Array.isArray(parsed.messages)) {
                    if (typeof onUpdate === 'function') {
                      onUpdate(parsed.messages);
                      onSetLoading(false);
                      onScrollDown();
                    }
                  }
                }
                break;
              }
            }
          } catch (e) {
            console.error('[SSE][ERROR][main handler]', e);
            onError('[SSE][ERROR][main handler] ' + e);
            onSetLoading(false);
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
