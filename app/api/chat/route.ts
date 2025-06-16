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

// Update the handleThreadBasedChat function to handle the new payload structure
async function handleThreadBasedChat(req: NextRequest, parsedBody?: any) {
  try {
    // Get the authorization header from the incoming request
    const authHeader = req.headers.get("Authorization")

    // Use a valid API key for B-Bot
    const bbotApiKey = "bbot_66e0fokzgaj8q2ze6u4uhov4wrg1td3iehpqxyec1j8ytsid"

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
        input: "",
        config: {
          thread_id: null,
          agent_id: "b-bot",
        },
      }
    }

    // Log the raw request data for debugging
    console.log("Raw request data:", JSON.stringify(requestData, null, 2))

    // Extract data from the request using the new structure
    // Handle both the new structure and the old structure for backward compatibility
    let input = ""
    let threadId = null
    let agent = "b-bot"
    let userId = null
    let abilityId = null
    let modelId = null
    let apps = {}
    let toolActivation = {}
    let documentUrls = []
    let conversationHistory = []
    let temperature = undefined
    let maxTokens = undefined
    let topP = undefined
    let instructions = undefined
    let token = null
    let synapseToken = null

    // Check if we have the new structure
    if (requestData.input !== undefined && requestData.config !== undefined) {
      console.log("Using new payload structure")
      input = requestData.input || ""

      // Extract config values
      const config = requestData.config || {}
      threadId = config.thread_id || null
      agent = config.agent_id || "b-bot"
      userId = config.user_id || null
      abilityId = config.ability_id || null
      modelId = config.model_id || null
      apps = config.apps || {}
      toolActivation = config.tool_activation || {}
      documentUrls = config.document_urls || []
      conversationHistory = config.conversation_history || []
      temperature = config.temperature
      maxTokens = config.max_tokens
      topP = config.top_p
      instructions = config.instructions
      token = config.token || null
      synapseToken = config.synapseToken || null
    } else {
      // Handle the old structure for backward compatibility
      console.log("Using old payload structure")
      const {
        messages = [],
        agent: oldAgent = "b-bot",
        threadId: oldThreadId = null,
        token: oldToken,
        synapseToken: oldSynapseToken,
      } = requestData

      // Extract the latest message content as input
      if (Array.isArray(messages) && messages.length > 0) {
        const latestMessage = messages[messages.length - 1]
        input = latestMessage.content || ""
      }

      threadId = oldThreadId
      agent = oldAgent
      token = oldToken
      synapseToken = oldSynapseToken
      conversationHistory = messages
    }

    console.log("Request data processed:", {
      input: input.substring(0, 50) + (input.length > 50 ? "..." : ""),
      threadId,
      agent,
      userId: userId ? "present" : "missing",
      abilityId: abilityId ? "present" : "missing",
      modelId: modelId ? "present" : "missing",
      hasApps: Object.keys(apps).length > 0,
      hasToolActivation: Object.keys(toolActivation).length > 0,
      documentUrlsCount: documentUrls.length,
      conversationHistoryCount: conversationHistory.length,
      hasToken: !!token,
      hasSynapseToken: !!synapseToken,
    })

    // Check if this is a B-Bot request
    const isBBotRequest = agent === "b-bot"

    // Set up headers with the auth token if available
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // IMPORTANT: Set the bbot-api-key header for authentication
    // This is the key that the proxy endpoint will use to get a token
    headers["bbot-api-key"] = bbotApiKey

    // If we have an auth token, also set the Authorization header as a backup
    if (synapseToken) {
      // Make sure the token has the Bearer prefix
      const formattedToken = synapseToken.startsWith("Bearer ") ? synapseToken : `Bearer ${synapseToken}`
      headers["Authorization"] = formattedToken
      console.log("Using synapseToken from request body")
    } else if (authHeader) {
      headers["Authorization"] = authHeader
      console.log("Using token from Authorization header")
    } else if (token) {
      // Make sure the token has the Bearer prefix
      const formattedToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`
      headers["Authorization"] = formattedToken
      console.log("Using token from request body")
    }

    console.log("Using headers:", {
      contentType: headers["Content-Type"],
      authorization: headers.Authorization ? headers.Authorization.substring(0, 20) + "..." : "missing",
      bbotApiKey: headers["bbot-api-key"] ? headers["bbot-api-key"].substring(0, 10) + "..." : "missing",
    })

    // If we have a threadId, use it to add a message and run the thread
    if (threadId) {
      // Check if this is an anonymous B-Bot thread
      if (threadId.startsWith("bbot-anonymous-")) {
        console.log("Handling anonymous B-Bot thread")

        // Create a simple response for anonymous B-Bot threads
        const responseData = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: `I'm B-Bot, your AI assistant. I'm currently in anonymous mode with limited capabilities. ${
            input.toLowerCase().includes("hello") || input.toLowerCase().includes("hi")
              ? "Hello! How can I help you today?"
              : "How can I assist you further?"
          }`,
          createdAt: new Date().toISOString(),
          thread_id: threadId, // Include the thread_id in the response
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
      const messageUrl = `https://api.b-bot.space/api/v2/threads/${threadId}/messages`
      console.log(`Adding message to thread ${threadId}`)

      const messageResponse = await fetch(messageUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          role: "user",
          content: input || "",
        }),
      })

      console.log(`Message response status: ${messageResponse.status}`)

      if (!messageResponse.ok) {
        const errorText = await messageResponse.text()
        console.error(`Error adding message to thread (${messageResponse.status}): ${errorText}`)
        throw new Error(`Failed to add message to thread: ${messageResponse.status} - ${errorText}`)
      }

      // Prepare the run request body with all the config options
      const entityId = userId ? userId.replace(/[|\-]/g, '') + '_' + agent : 'anonymous-entity';
      const runRequestBody: any = {
        assistant_id: agent || "b-bot",
        input: {
          entity_id: entityId,
          messages: [{ role: "user", content: input || "" }],
        },
      };
      // Add optional parameters if they exist
      if (abilityId) runRequestBody.ability_id = abilityId;
      if (modelId) runRequestBody.model_id = modelId;
      if (Object.keys(apps).length > 0) runRequestBody.apps = apps;
      if (Object.keys(toolActivation).length > 0) runRequestBody.tool_activation = toolActivation;
      if (documentUrls.length > 0) runRequestBody.document_urls = documentUrls;
      if (temperature !== undefined) runRequestBody.temperature = temperature;
      if (maxTokens !== undefined) runRequestBody.max_tokens = maxTokens;
      if (topP !== undefined) runRequestBody.top_p = topP;
      if (instructions) runRequestBody.instructions = instructions;

      // Run the thread with the selected assistant
      const runUrl = `https://api.b-bot.space/api/v2/threads/${threadId}/graph`
      console.log(`Running thread ${threadId} with assistant ${agent || "b-bot"}`)

      const runResponse = await fetch(`${runUrl}?assistant_id=${agent || "b-bot"}`, {
        method: "POST",
        headers,
        body: JSON.stringify(runRequestBody),
      })

      console.log(`Run response status: ${runResponse.status}`)

      if (!runResponse.ok) {
        const errorText = await runResponse.text()
        console.error(`Error running thread (${runResponse.status}): ${errorText}`)
        throw new Error(`Failed to run thread: ${runResponse.status} - ${errorText}`)
      }

      // Get the response data
      const responseData = await runResponse.json()

      // Add the thread_id to the response
      const responseWithThreadId = {
        ...responseData.response,
        thread_id: threadId,
      }

      // Create a stream from the response
      const stream = new ReadableStream({
        start(controller) {
          // Add the response to the stream
          controller.enqueue(
            JSON.stringify(
              responseWithThreadId || {
                role: "assistant",
                content: "I'm sorry, I couldn't process your request.",
                id: `msg-${Date.now()}`,
                created_at: new Date().toISOString(),
                thread_id: threadId,
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

    // If no threadId, create a new thread and then run it
    console.log("No threadId provided, creating a new thread")

    // Prepare the request body for creating a thread
    const createThreadBody: any = {
      assistant_id: agent || "b-bot",
    }

    if (userId) createThreadBody.user_id = userId

    // Create a new thread
    const createThreadUrl = `https://api.b-bot.space/api/v2/threads`
    const createThreadResponse = await fetch(createThreadUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(createThreadBody),
    })

    console.log(`Create thread response status: ${createThreadResponse.status}`)

    if (!createThreadResponse.ok) {
      const errorText = await createThreadResponse.text()
      console.error(`Error creating thread (${createThreadResponse.status}): ${errorText}`)

      // If we can't create a thread, fall back to the direct chat endpoint
      console.log("Falling back to direct chat endpoint")
      return handleDirectChat(input, agent, conversationHistory, headers)
    }

    // Get the thread data
    const threadData = await createThreadResponse.json()
    const newThreadId = threadData.thread_id

    console.log(`Created new thread with ID: ${newThreadId}`)

    // Add the message to the new thread
    const newMessageUrl = `https://api.b-bot.space/api/v2/threads/${newThreadId}/messages`
    console.log(`Adding message to new thread ${newThreadId}`)

    const newMessageResponse = await fetch(newMessageUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        role: "user",
        content: input || "",
      }),
    })

    console.log(`New message response status: ${newMessageResponse.status}`)

    if (!newMessageResponse.ok) {
      const errorText = await newMessageResponse.text()
      console.error(`Error adding message to new thread (${newMessageResponse.status}): ${errorText}`)
      throw new Error(`Failed to add message to new thread: ${newMessageResponse.status} - ${errorText}`)
    }

    // Prepare the run request body with all the config options for new thread
    const newEntityId = userId ? userId.replace(/[|\-]/g, '') + '_' + agent : 'anonymous-entity';
    const newRunRequestBody: any = {
      assistant_id: agent || "b-bot",
      input: {
        entity_id: newEntityId,
        messages: [{ role: "user", content: input || "" }],
      },
    };
    // Add optional parameters if they exist
    if (abilityId) newRunRequestBody.ability_id = abilityId;
    if (modelId) newRunRequestBody.model_id = modelId;
    if (Object.keys(apps).length > 0) newRunRequestBody.apps = apps;
    if (Object.keys(toolActivation).length > 0) newRunRequestBody.tool_activation = toolActivation;
    if (documentUrls.length > 0) newRunRequestBody.document_urls = documentUrls;
    if (temperature !== undefined) newRunRequestBody.temperature = temperature;
    if (maxTokens !== undefined) newRunRequestBody.max_tokens = maxTokens;
    if (topP !== undefined) newRunRequestBody.top_p = topP;
    if (instructions) newRunRequestBody.instructions = instructions;

    // Run the new thread with the selected assistant
    const newRunUrl = `https://api.b-bot.space/api/v2/threads/${newThreadId}/graph`
    console.log(`Running new thread ${newThreadId} with assistant ${agent || "b-bot"}`)

    const newRunResponse = await fetch(`${newRunUrl}?assistant_id=${agent || "b-bot"}`, {
      method: "POST",
      headers,
      body: JSON.stringify(newRunRequestBody),
    })

    console.log(`New run response status: ${newRunResponse.status}`)

    if (!newRunResponse.ok) {
      const errorText = await newRunResponse.text()
      console.error(`Error running new thread (${newRunResponse.status}): ${errorText}`)
      throw new Error(`Failed to run new thread: ${newRunResponse.status} - ${errorText}`)
    }

    // Get the response data
    const newResponseData = await newRunResponse.json()

    // Add the thread_id to the response
    const responseWithThreadId = {
      ...newResponseData.response,
      thread_id: newThreadId,
    }

    // Create a stream from the response
    const stream = new ReadableStream({
      start(controller) {
        // Add the response to the stream
        controller.enqueue(
          JSON.stringify(
            responseWithThreadId || {
              role: "assistant",
              content: "I'm sorry, I couldn't process your request.",
              id: `msg-${Date.now()}`,
              created_at: new Date().toISOString(),
              thread_id: newThreadId,
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

// Helper function to handle direct chat when thread creation fails
async function handleDirectChat(
  input: string,
  agent: string,
  conversationHistory: any[],
  headers: Record<string, string>,
) {
  try {
    // If no threadId, fall back to the direct chat endpoint
    const apiUrl = `https://api.b-bot.space/api/v2/assistants/${agent || "b-bot"}/chat`
    console.log(`Making direct chat request to ${apiUrl}`)

    // Convert conversation history to the expected format if needed
    const messages = conversationHistory.length > 0 ? conversationHistory : [{ role: "user", content: input }]

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
    console.error("Error in direct chat:", error)
    return new Response(
      JSON.stringify({
        error: "Error in direct chat",
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

// Handle both GET and POST methods
export async function GET(req: NextRequest) {
  return handleRequest(req)
}

export async function POST(req: NextRequest) {
  return handleRequest(req)
}

async function handleRequest(req: NextRequest) {
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
    return await handleThreadBasedChat(req as NextRequest, parsedBody)
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
