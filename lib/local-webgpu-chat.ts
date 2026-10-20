"use client"

const TRANSFORMERS_CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0"

export const DEFAULT_LOCAL_WEBGPU_MODEL = "onnx-community/Qwen3-4B-Instruct-2507-ONNX"

type LocalMessage = {
  role: "system" | "user" | "assistant"
  content: string
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
}): Promise<string> {
  const pipeline = await getPipeline(options.onProgress)
  const output = await pipeline(normalizeMessages(options.messages), {
    max_new_tokens: options.maxTokens ?? 512,
    do_sample: (options.temperature ?? 0.2) > 0,
    temperature: options.temperature ?? 0.2,
  })
  const text = extractText(output)
  if (!text) throw new Error("Local model returned an empty response")
  return text
}
