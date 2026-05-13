type WorkerPending = {
  resolve: (value: any) => void
  reject: (reason?: any) => void
  onProgress?: (payload: any) => void
}

const workerState: {
  worker: Worker | null
  pending: Record<string, WorkerPending>
  nextId: number
  unavailable: boolean
} = {
  worker: null,
  pending: {},
  nextId: 1,
  unavailable: false,
}

function getWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null
  if (workerState.unavailable) return null
  if (workerState.worker) return workerState.worker

  try {
    const worker = new Worker("/local-tts-worker.js", {
      type: "module",
      name: "bbot-chat-local-tts",
    })
    worker.onmessage = (event) => {
      const msg = event.data || {}
      const pending = workerState.pending[msg.id]
      if (!pending) return
      if (msg.type === "progress") {
        pending.onProgress?.(msg.payload)
        return
      }
      delete workerState.pending[msg.id]
      if (msg.type === "result") pending.resolve(msg.payload)
      else pending.reject(new Error(msg.payload?.message || "Local TTS worker failed"))
    }
    worker.onerror = (event) => {
      workerState.unavailable = true
      try { worker.terminate() } catch {}
      workerState.worker = null
      const pending = workerState.pending
      workerState.pending = {}
      const err = new Error(event.message || "Local TTS worker crashed")
      Object.values(pending).forEach((entry) => entry.reject(err))
    }
    workerState.worker = worker
    return worker
  } catch {
    workerState.unavailable = true
    return null
  }
}

function callWorker(action: string, payload: any, onProgress?: (payload: any) => void): Promise<any> {
  const worker = getWorker()
  if (!worker) return Promise.reject(new Error("Local TTS worker is not available"))
  const id = `local-tts-${Date.now()}-${workerState.nextId++}`
  return new Promise((resolve, reject) => {
    workerState.pending[id] = { resolve, reject, onProgress }
    try {
      worker.postMessage({ id, action, payload })
    } catch (error) {
      delete workerState.pending[id]
      reject(error)
    }
  })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function isLocalKokoroTtsModality(modality: any): boolean {
  const modelName = String(modality?.model_name || modality?.model || "").toLowerCase()
  const provider = String(modality?.provider || "").toLowerCase()
  return (
    provider === "client-webgpu"
    || provider === "client_webgpu"
    || modelName === "client-webgpu/kokoro-82m"
    || modelName.includes("kokoro")
  )
}

export async function generateLocalKokoroTts({
  text,
  modality,
  onProgress,
}: {
  text: string
  modality: any
  onProgress?: (payload: any) => void
}): Promise<{ dataUrl: string; mime: string; stats?: any; attempt?: any }> {
  const result = await callWorker("generate", {
    text,
    model: modality?.model_id || "onnx-community/Kokoro-82M-v1.0-ONNX",
    voice: modality?.voice || "af_bella",
    dtype: modality?.dtype || "fp32",
    device: modality?.device || "webgpu",
    speed: modality?.speed || 1,
  }, onProgress)
  if (!result?.buffer) throw new Error("Local TTS worker returned no audio")
  const mime = result.mime || "audio/wav"
  return {
    dataUrl: `data:${mime};base64,${arrayBufferToBase64(result.buffer)}`,
    mime,
    stats: result.stats || null,
    attempt: result.attempt || null,
  }
}
