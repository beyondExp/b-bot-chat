"use client"

const TRANSFORMERS_CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0"

export const DEFAULT_LOCAL_WEBGPU_MODEL = "onnx-community/Qwen3-4B-Instruct-2507-ONNX"

type LocalMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: unknown[]
}

type ToolDefinition = {
  type?: string
  function?: {
    name?: string
    description?: string
    parameters?: unknown
  }
  name?: string
}

type ProgressPayload = {
  progress?: number
  text?: string
}

type NavigatorWithWebGpu = Navigator & {
  gpu?: {
    requestAdapter: (options?: { powerPreference?: "high-performance" | "low-power" }) => Promise<unknown>
  }
}

let runtimePromise: Promise<any> | null = null
let pipelinePromise: Promise<any> | null = null

function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import(/* webpackIgnore: true */ TRANSFORMERS_CDN_URL)
  }
  return runtimePromise
}

async function ensureWebGpu() {
  const gpu = typeof navigator === "undefined" ? null : (navigator as NavigatorWithWebGpu).gpu
  if (!gpu) {
    throw new Error("WebGPU is not available in this browser")
  }

  let adapter = await gpu.requestAdapter({ powerPreference: "high-performance" })
  if (!adapter) adapter = await gpu.requestAdapter({ powerPreference: "low-power" })
  if (!adapter) adapter = await gpu.requestAdapter()
  if (!adapter) throw new Error("No WebGPU adapter available")

  try {
    if (navigator.storage && typeof navigator.storage.persist === "function") {
      await navigator.storage.persist()
    }
  } catch {
    // The browser may evict the model cache when persistent storage is unavailable.
  }
}

function normalizeProgress(payload: any): ProgressPayload {
  const progress = Number(payload?.progress)
  return {
    progress: Number.isFinite(progress) ? (progress > 1 ? progress / 100 : progress) : undefined,
    text: String(payload?.file || payload?.status || "Loading local model"),
  }
}

async function getPipeline(onProgress?: (payload: ProgressPayload) => void) {
  if (pipelinePromise) return pipelinePromise

  pipelinePromise = (async () => {
    await ensureWebGpu()
    const runtime = await loadRuntime()
    return runtime.pipeline("text-generation", DEFAULT_LOCAL_WEBGPU_MODEL, {
      dtype: "q4f16",
      device: "webgpu",
      progress_callback: (payload: unknown) => onProgress?.(normalizeProgress(payload)),
    })
  })().catch((error) => {
    pipelinePromise = null
    throw error
  })

  return pipelinePromise
}

function normalizeMessages(messages: LocalMessage[]): LocalMessage[] {
  const normalized = messages
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").trim(),
      ...(message.name ? { name: message.name } : {}),
      ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
      ...(message.role === "assistant" && Array.isArray(message.tool_calls)
        ? { tool_calls: message.tool_calls }
        : {}),
    }))
    .filter((message) => message.content)

  return normalized.length ? normalized : [{ role: "user", content: "" }]
}

function extractText(output: any): string {
  const item = Array.isArray(output) ? output[0] : output
  const generated = item?.generated_text ?? item?.text ?? item?.content ?? output

  if (typeof generated === "string") return generated.trim()
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1]
    if (typeof last === "string") return last.trim()
    if (last && typeof last === "object") {
      return String(last.content || last.text || "").trim()
    }
  }

  return String(generated || "").trim()
}

function parseLooseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw)
  } catch {
    const args: Record<string, unknown> = {}
    const pairs = /([A-Za-z_][\w-]*)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,}]+))/g
    let match: RegExpExecArray | null
    while ((match = pairs.exec(raw))) {
      const value = String(match[2] ?? match[3] ?? match[4] ?? "").trim()
      args[match[1]] = value
    }
    return args
  }
}

function extractToolCalls(text: string, tools: ToolDefinition[]) {
  const allowedNames = new Set(
    tools
      .map((tool) => tool.function?.name || tool.name || "")
      .filter(Boolean),
  )
  const calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = []
  const add = (name: string, args: unknown) => {
    if (!name || (allowedNames.size > 0 && !allowedNames.has(name))) return
    calls.push({
      id: `call_local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: "function",
      function: {
        name,
        arguments: JSON.stringify(args && typeof args === "object" ? args : {}),
      },
    })
  }

  const qwenToolPattern = /<\|tool_call>call:([A-Za-z_][\w-]*)\{([\s\S]*?)\}<tool_call\|>/g
  let match: RegExpExecArray | null
  while ((match = qwenToolPattern.exec(text))) {
    add(match[1], parseLooseArgs(match[2]))
  }

  const jsonToolPattern = /\{[\s\S]*?"name"\s*:\s*"([^"]+)"[\s\S]*?"arguments"\s*:\s*(\{[\s\S]*?\})[\s\S]*?\}/g
  while ((match = jsonToolPattern.exec(text))) {
    try {
      add(match[1], JSON.parse(match[2]))
    } catch {
      add(match[1], parseLooseArgs(match[2]))
    }
  }
  return calls
}

export async function preloadLocalWebGpuChat(
  onProgress?: (payload: ProgressPayload) => void,
): Promise<void> {
  await getPipeline(onProgress)
}

export async function inferLocalWebGpuChat(options: {
  messages: LocalMessage[]
  maxTokens?: number
  temperature?: number
  onProgress?: (payload: ProgressPayload) => void
  onToken?: (piece: string, text: string) => void
  tools?: ToolDefinition[]
  toolChoice?: unknown
}): Promise<{
  text: string
  tool_calls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>
}> {
  const pipeline = await getPipeline(options.onProgress)
  const runtime = await loadRuntime()
  let streamedText = ""
  const streamer = new runtime.TextStreamer(pipeline.tokenizer, {
    skip_prompt: true,
    // Qwen's tool-call delimiters are special tokens and must survive parsing.
    skip_special_tokens: false,
    callback_function: (piece: string) => {
      const next = String(piece || "")
      if (!next) return
      streamedText += next
      options.onToken?.(next, streamedText)
    },
  })
  const output = await pipeline(normalizeMessages(options.messages), {
    tools: options.tools?.length ? options.tools : undefined,
    tool_choice: options.toolChoice ?? undefined,
    max_new_tokens: options.maxTokens ?? 512,
    do_sample: (options.temperature ?? 0.2) > 0,
    temperature: options.temperature ?? 0.2,
    streamer,
  })
  const rawText = streamedText.trim() || extractText(output)
  const tool_calls = extractToolCalls(rawText, options.tools || [])
  const text = tool_calls.length
    ? ""
    : rawText
        .replace(/<\|tool_call>call:[\s\S]*?<tool_call\|>/g, "")
        .replace(/<\|tool_response>$/g, "")
        .trim()
  if (!text && !tool_calls.length) throw new Error("Local model returned an empty response")
  return { text, tool_calls }
}
