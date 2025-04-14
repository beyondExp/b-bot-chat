// Allow streaming responses up to 30 seconds
export const maxDuration = 30

// Update this function to handle thread-based communication with more resilient auth handling
async function handleThreadBasedChat(req: Request) {
  try {
    // Get the authorization header from the incoming request
    const authHeader = req.headers.get("Authorization")
    const bbotApiKey = req.headers.get("bbot-api-key") || "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid"

    // Log all incoming headers for debugging
    console.log("Incoming request headers:", Object.fromEntries([...req.headers.entries()]))

    // Parse request body
    const requestData = await req.json()
    const { messages, agent, threadId, token } = requestData

    console.log("Request data received:", {
      agent,
      threadId,
      messageCount: messages?.length || 0,
      hasToken: !!token,
    })

    // Try to get auth token from various sources
    let authToken = null

    // 1. Try from Authorization header
    if (authHeader) {
      authToken = authHeader.replace("Bearer ", "")
      console.log("Using token from Authorization header")
    }
    // 2. Try from request body
    else if (token) {
      authToken = token
      console.log("Using token from request body")
    }
    // 3. Try from Vercel's special header
    else {
      try {
        const vercelScHeaders = req.headers.get("x-vercel-sc-headers")
        if (vercelScHeaders) {
          const parsedHeaders = JSON.parse(vercelScHeaders)
          if (parsedHeaders.Authorization) {
            authToken = parsedHeaders.Authorization.replace("Bearer ", "")
            console.log("Using token from x-vercel-sc-headers")
          }
        }
      } catch (e) {
        console.error("Error parsing x-vercel-sc-headers:", e)
      }
    }

    // If we still don't have a token, try to proceed without it
    if (!authToken) {
      console.warn("No authorization token found, proceeding with default headers")
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
      const latestMessage = messages[messages.length - 1]

      // Add the message to the thread
      const messageUrl = `https://api-staging.b-bot.space/api/v2/threads/${threadId}/messages`
      console.log(`Adding message to thread ${threadId}`)

      const messageResponse = await fetch(messageUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          role: "user",
          content: latestMessage.content,
        }),
      })

      console.log(`Message response status: ${messageResponse.status}`)

      if (!messageResponse.ok) {
        const errorText = await messageResponse.text()
        console.error(`Error adding message to thread (${messageResponse.status}): ${errorText}`)
        throw new Error(`Failed to add message to thread: ${messageResponse.status} - ${errorText}`)
      }

      // Run the thread with the selected assistant
      const runUrl = `https://api-staging.b-bot.space/api/v2/threads/${threadId}/runs`
      console.log(`Running thread ${threadId} with assistant ${agent || "default"}`)

      const runResponse = await fetch(runUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          assistant_id: agent || "default",
          stream_mode: ["messages"],
          metadata: { conversation_id: threadId },
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
export async function POST(req: Request) {
  try {
    console.log("Chat API request received")

    // Simply pass the request to the handler
    return await handleThreadBasedChat(req)
  } catch (error) {
    console.error("Chat API error:", error)
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
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
