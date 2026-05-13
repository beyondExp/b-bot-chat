const KOKORO_JS_CDN_URL = "https://esm.sh/kokoro-js?bundle";
const DEFAULT_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

let runtimePromise = null;
let ttsPromise = null;
let ttsKey = null;

function post(id, type, payload, transfer) {
  self.postMessage({ id, type, payload }, transfer || []);
}

async function loadRuntime() {
  if (!runtimePromise) runtimePromise = import(KOKORO_JS_CDN_URL);
  return runtimePromise;
}

async function getKokoro(payload = {}, id) {
  const model = payload.model || payload.model_id || DEFAULT_MODEL_ID;
  const dtype = payload.dtype || "q4f16";
  const device = payload.device || "webgpu";
  const key = `${model}:${dtype}:${device}`;
  if (ttsPromise && ttsKey === key) return ttsPromise;
  ttsKey = key;
  ttsPromise = (async () => {
    post(id, "progress", { text: `Loading local Kokoro TTS (${device}, ${dtype})`, progress: 0 });
    const runtime = await loadRuntime();
    const KokoroTTS = runtime.KokoroTTS || runtime.default?.KokoroTTS || runtime.default;
    if (!KokoroTTS || typeof KokoroTTS.from_pretrained !== "function") {
      throw new Error("kokoro-js did not expose KokoroTTS.from_pretrained");
    }
    const tts = await KokoroTTS.from_pretrained(model, {
      dtype,
      device,
      progress_callback: (info) => {
        const raw = Number(info?.progress);
        const progress = Number.isFinite(raw) ? (raw > 1 ? raw / 100 : raw) : 0;
        post(id, "progress", {
          progress: Math.max(0, Math.min(1, progress)),
          text: info?.file || info?.status || "Loading local Kokoro TTS",
        });
      },
    });
    post(id, "progress", { text: "Local Kokoro TTS ready", progress: 1 });
    return tts;
  })().catch((err) => {
    if (ttsKey === key) {
      ttsPromise = null;
      ttsKey = null;
    }
    throw err;
  });
  return ttsPromise;
}

function samplesFrom(value) {
  if (!value) return null;
  if (value instanceof Float32Array || Array.isArray(value)) {
    if (Array.isArray(value) && Array.isArray(value[0])) return value.flat();
    return value;
  }
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) return Array.from(value);
  return null;
}

function normalizedSamples(samples) {
  const source = samplesFrom(samples) || [];
  const length = source.length || 0;
  if (!length) return new Float32Array(0);
  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    const value = Number(source[i]);
    if (!Number.isFinite(value)) continue;
    const abs = Math.abs(value);
    if (abs > peak) peak = abs;
  }
  const gain = peak > 0 && peak < 0.9 ? Math.min(16, 0.9 / peak) : 1;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const value = Number(source[i]);
    out[i] = Number.isFinite(value) ? Math.max(-1, Math.min(1, value * gain)) : 0;
  }
  return out;
}

function floatArrayToWav(samples, sampleRate = 24000) {
  const normalized = normalizedSamples(samples);
  const length = normalized.length || 0;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  const writeString = (value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    offset += value.length;
  };
  writeString("RIFF");
  view.setUint32(offset, 36 + length * 2, true); offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * 2, true); offset += 4;
  view.setUint16(offset, 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString("data");
  view.setUint32(offset, length * 2, true); offset += 4;
  for (let i = 0; i < length; i += 1) {
    const sample = normalized[i] || 0;
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function audioStats(samples) {
  try {
    const source = samplesFrom(samples) || [];
    const length = source.length || 0;
    if (!length) return { length: 0, peak: 0, rms: 0 };
    let peak = 0;
    let sumSquares = 0;
    for (let i = 0; i < length; i += 1) {
      const raw = Number(source[i]);
      const value = Number.isFinite(raw) ? raw : 0;
      const abs = Math.abs(value);
      if (abs > peak) peak = abs;
      sumSquares += value * value;
    }
    const gain = peak > 0 && peak < 0.9 ? Math.min(16, 0.9 / peak) : 1;
    return { length, peak, rms: Math.sqrt(sumSquares / length), appliedGain: gain };
  } catch {
    return { length: 0, peak: 0, rms: 0 };
  }
}

async function audioToArrayBuffer(audio) {
  if (!audio) throw new Error("Kokoro returned no audio");
  if (audio instanceof Blob) return { buffer: await audio.arrayBuffer(), mime: audio.type || "audio/wav" };
  if (samplesFrom(audio)) {
    return { buffer: floatArrayToWav(audio, audio.sample_rate || audio.sampleRate || 24000), mime: "audio/wav", stats: audioStats(audio) };
  }
  if (samplesFrom(audio.audio)) {
    return { buffer: floatArrayToWav(audio.audio, audio.sample_rate || audio.sampleRate || 24000), mime: "audio/wav", stats: audioStats(audio.audio) };
  }
  if (samplesFrom(audio.data)) {
    return { buffer: floatArrayToWav(audio.data, audio.sample_rate || audio.sampleRate || 24000), mime: "audio/wav", stats: audioStats(audio.data) };
  }
  if (typeof audio.toBlob === "function") {
    const blob = await audio.toBlob();
    return { buffer: await blob.arrayBuffer(), mime: blob.type || "audio/wav" };
  }
  if (audio.buffer instanceof ArrayBuffer) return { buffer: audio.buffer, mime: audio.mime || audio.type || "audio/wav" };
  throw new Error("Unsupported Kokoro audio output format");
}

function isSilentAudioResult(result) {
  const stats = result?.stats;
  return !!stats && (stats.length || 0) > 0 && (stats.peak || 0) <= 0.000001 && (stats.rms || 0) <= 0.000001;
}

async function generateAttempt(payload, id, overrides = {}) {
  const attemptPayload = {
    ...payload,
    dtype: overrides.dtype || payload.dtype || "q4f16",
    device: overrides.device || payload.device || "webgpu",
  };
  const tts = await getKokoro(attemptPayload, id);
  post(id, "progress", { text: `Generating local Kokoro speech (${attemptPayload.device}, ${attemptPayload.dtype})`, progress: 1 });
  const audio = await tts.generate(String(payload.text || "").trim(), {
    voice: payload.voice || "af_bella",
    speed: Number(payload.speed || 1) || 1,
  });
  post(id, "progress", {
    text: "Kokoro audio generated in worker",
    progress: 1,
    attempt: { device: attemptPayload.device, dtype: attemptPayload.dtype },
    shape: {
      ctor: audio?.constructor?.name || null,
      keys: audio && typeof audio === "object" ? Object.keys(audio).slice(0, 12) : [],
      hasAudio: !!audio?.audio,
      hasData: !!audio?.data,
      hasToBlob: typeof audio?.toBlob === "function",
      hasBuffer: !!audio?.buffer,
    },
  });
  const result = await audioToArrayBuffer(audio);
  result.attempt = { device: attemptPayload.device, dtype: attemptPayload.dtype };
  return result;
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const id = msg.id;
  try {
    if (msg.action === "generate") {
      const payload = msg.payload || {};
      const text = String(payload.text || "").trim();
      if (!text) throw new Error("No text provided for local TTS");
      let result = await generateAttempt({ ...payload, text }, id);
      if (isSilentAudioResult(result)) {
        post(id, "progress", {
          text: "Kokoro returned silent audio; retrying with WebGPU fp32 fallback",
          progress: 1,
          stats: result.stats,
          attempt: result.attempt,
        });
        try {
          const fp32 = await generateAttempt({ ...payload, text }, id, { device: "webgpu", dtype: "fp32" });
          if (!isSilentAudioResult(fp32)) {
            result = fp32;
          } else {
            post(id, "progress", {
              text: "Kokoro WebGPU fp32 was also silent; retrying with local WASM q8 fallback",
              progress: 1,
              stats: fp32.stats,
              attempt: fp32.attempt,
            });
            result = await generateAttempt({ ...payload, text }, id, { device: "wasm", dtype: "q8" });
          }
        } catch (err) {
          post(id, "progress", {
            text: `Kokoro WebGPU fp32 failed; retrying with local WASM q8 fallback: ${String(err?.message || err)}`,
            progress: 1,
          });
          result = await generateAttempt({ ...payload, text }, id, { device: "wasm", dtype: "q8" });
        }
      }
      post(id, "result", { mime: result.mime, buffer: result.buffer, stats: result.stats || null, attempt: result.attempt || null }, [result.buffer]);
      return;
    }
    if (msg.action === "reset") {
      ttsPromise = null;
      ttsKey = null;
      post(id, "result", true);
      return;
    }
    throw new Error(`Unknown local TTS action '${msg.action}'`);
  } catch (err) {
    post(id, "error", { message: String(err?.message || err || "Unknown local TTS error") });
  }
};
