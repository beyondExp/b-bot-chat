import type { NextRequest } from "next/server"

// Allow streaming responses up to 30 seconds
export const maxDuration = 30

// Helper function to safely read the request body
async function safelyReadBody(req: NextRequest): Promise<any> {
  try {
    // Check if the request has a body
    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("application/json")) {
      console.log("Request doesn't have JSON content type:", contentType)
      return null
    }

    // Try to read the body as text first
    const bodyText = await req.text()
    console.log("Request body text length:", bodyText.length)

    if (!bodyText || bodyText.trim() === "") {
      console.log("Request body is empty")
      return null
    }

    // Then parse the text as JSON
    try {
      return JSON.parse(bodyText)
    } catch (parseError) {
      console.error("Error parsing JSON from body text:", parseError)
      return null
    }
  } catch (error) {
    console.error("Error reading request body:", error)
    return null
  }
}

// Update the handleThreadBasedChat function to better handle thread-based chat
async function handleThreadBasedChat(req: NextRequest, parsedBody?: any) {
  try {
    // Get the authorization header from the incoming request
    const authHeader = req.headers.get("Authorization")
    const bbotApiKey = req.headers.get("bbot-api-key") || "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid"

    // Log all incoming headers for debugging
    console.log("Incoming request headers:", Object.fromEntries([...req.headers.entries()]))

    // Use the parsed body if provided, otherwise try to parse it again
    let requestData = parsedBody
    if (!requestData) {
      console.log("No parsed body provided to handler, attempting to read body")
      requestData = await safelyReadBody(req.clone())
    }

    // If we still don't have request data, use default values
    if (!requestData) {
      console.log("Unable to parse request body, using default values")
      requestData = {
        messages: [],
        agent: "b-bot",
        threadId: null,
      }
    }

    // Extract data from the request
    const { messages = [], agent = "b-bot", threadId = null, token, synapseToken } = requestData

    // Validate messages
    if (!Array.isArray(messages)) {
      console.error("Messages is not an array:", messages)
      return new Response(
        JSON.stringify({
          error: "Invalid request",
          details: "The 'messages' field must be an array",
          message: "I'm sorry, there was an error processing your request. Please try again.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    console.log("Request data received:", {
      agent,
      threadId,
      messageCount: messages.length,
      hasToken: !!token,
      hasSynapseToken: !!synapseToken,
    })

    // Check if this is a B-Bot request
    const isBBotRequest = agent === "b-bot"

    // Try to get auth token from various sources
    let authToken = null

    // 1. Try from synapseToken in request body (matching the Vue implementation)
    if (synapseToken) {
      authToken = synapseToken
      console.log("Using synapseToken from request body")
    }
    // 2. Try from Authorization header
    else if (authHeader) {
      authToken = authHeader.replace("Bearer ", "")
      console.log("Using token from Authorization header")
    }
    // 3. Try from token in request body
    else if (token) {
      authToken = token
      console.log("Using token from request body")
    }

    // Set up headers with the auth token if available
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`
    }

    if (bbotApiKey) {
      headers["bbot-api-key"] = bbotApiKey
    }

    console.log("Using headers:", {
      contentType: headers["Content-Type"],
      authorization: headers.Authorization ? "Bearer " + headers.Authorization.substring(0, 15) + "..." : "missing",
      bbotApiKey: headers["bbot-api-key"] ? "present" : "missing",
    })

    // If we have a threadId, use it to add a message and run the thread
    if (threadId) {
      // Get the latest user message
      const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null

      if (!latestMessage) {
        return new Response(
          JSON.stringify({
            error: "No message provided",
            message: "I'm sorry, I didn't receive any message to respond to.",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }

      // Check if this is an anonymous B-Bot thread
      if (threadId.startsWith("bbot-anonymous-")) {
        console.log("Handling anonymous B-Bot thread")

        // Create a simple response for anonymous B-Bot threads
        const responseData = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `I'm B-Bot, your AI assistant. I'm currently in anonymous mode with limited capabilities. ${
            latestMessage.content?.toLowerCase().includes("hello") ||
            latestMessage.content?.toLowerCase().includes("hi")
              ? "Hello! How can I help you today?"
              : "How can I assist you further?"
          }`,
          createdAt: new Date().toISOString(),
        }

        // Create a stream from the response
        const stream = new ReadableStream({
          start(controller) {
            // Add the response to the stream
            controller.enqueue(JSON.stringify(responseData))
            controller.close()
          },
        })

        // Return the stream
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }

      // Add the message to the thread
      const messageUrl = `https://api-staging.b-bot.space/api/v2/threads/${threadId}/messages`
      console.log(`Adding message to thread ${threadId}`)

      const messageResponse = await fetch(messageUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          role: "user",
          content: latestMessage.content || "",
        }),
      })

      console.log(`Message response status: ${messageResponse.status}`)

      if (!messageResponse.ok) {
        const errorText = await messageResponse.text()
        console.error(`Error adding message to thread (${messageResponse.status}): ${errorText}`)
        throw new Error(`Failed to add message to thread: ${messageResponse.status} - ${errorText}`)
      }

      // Run the thread with the selected assistant
      const runUrl = `https://api-staging.b-bot.space/api/v2/threads/${threadId}/graph`
      console.log(`Running thread ${threadId} with assistant ${agent || "default"}`)

      const runResponse = await fetch(`${runUrl}?assistant_id=${agent || "default"}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [latestMessage.content || ""],
        }),
      })

      console.log(`Run response status: ${runResponse.status}`)

      if (!runResponse.ok) {
        const errorText = await runResponse.text()
        console.error(`Error running thread (${runResponse.status}): ${errorText}`)
        throw new Error(`Failed to run thread: ${runResponse.status} - ${errorText}`)
      }

      // Get the response data
      const responseData = await runResponse.json()

      // Create a stream from the response
      const stream = new ReadableStream({
        start(controller) {
          // Add the response to the stream
          controller.enqueue(
            JSON.stringify(
              responseData.response || {
                role: "assistant",
                content: "I'm sorry, I couldn't process your request.",
                id: `msg-${Date.now()}`,
                created_at: new Date().toISOString(),
              },
            ),
          )
          controller.close()
        },
      })

      // Return the stream
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    // If no threadId, fall back to the direct chat endpoint
    const apiUrl = `https://api-staging.b-bot.space/api/v2/assistants/${agent || "default"}/chat`
    console.log(`Making direct chat request to ${apiUrl}`)

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        metadata: {},
      }),
    })

    console.log(`API response status: ${response.status}`)

    // Check if the response is ok
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`LangGraph API error (${response.status}): ${errorText}`)
      throw new Error(`Error from LangGraph API: ${response.status} - ${errorText}`)
    }

    // Return the response from the LangGraph API
    const responseData = await response.json()

    // Create a stream from the response
    const stream = new ReadableStream({
      start(controller) {
        // Add the response to the stream
        controller.enqueue(JSON.stringify(responseData))
        controller.close()
      },
    })

    // Return the stream
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error in thread-based chat:", error)
    // Return a more detailed error response
    return new Response(
      JSON.stringify({
        error: "Error in thread-based chat",
        details: error instanceof Error ? error.message : String(error),
        message: "I'm sorry, something went wrong. Please try again later.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}

// Update the POST function to use the new thread-based handler
export async function POST(req: NextRequest) {
  try {
    console.log("Chat API request received")

    // Try to safely read the request body
    const parsedBody = await safelyReadBody(req.clone())

    if (!parsedBody) {
      console.log("Failed to parse request body, providing fallback response")

      // Return a simple response for empty or invalid requests
      return new Response(
        JSON.stringify({
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: "I'm sorry, I couldn't process your request. Please try again with a valid message.",
          createdAt: new Date().toISOString(),
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    // Pass the parsed body to the handler
    return await handleThreadBasedChat(req, parsedBody)
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
        message: "I'm sorry, something went wrong. Please try again later.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
