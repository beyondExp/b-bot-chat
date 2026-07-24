/** Helpers to recover full assistant text after a truncated live stream. */

export function previewTextLength(content: unknown): number {
  try {
    if (typeof content === "string") return content.trim().length
    if (Array.isArray(content)) {
      return content
        .filter((b: any) => b && typeof b === "object" && b.type === "text" && typeof b.text === "string")
        .map((b: any) => String(b.text || ""))
        .join(" ")
        .trim().length
    }
    if (content == null) return 0
    return String(content).trim().length
  } catch {
    return 0
  }
}

export function lastAssistantTextLength(messages: any[]): number {
  if (!Array.isArray(messages)) return 0
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const type = String(messages[i]?.type || messages[i]?.role || "").toLowerCase()
    if (type === "ai" || type === "assistant") {
      return previewTextLength(messages[i]?.content)
    }
    if (type === "human" || type === "user") break
  }
  return 0
}

/** Prefer the snapshot that has more of the assistant reply (stream can freeze mid-token). */
export function preferRicherMessages(
  ...candidates: Array<any[] | null | undefined>
): any[] {
  let best: any[] = []
  for (const candidate of candidates) {
    const next = Array.isArray(candidate) ? candidate : []
    if (!best.length) {
      best = next
      continue
    }
    if (!next.length) continue
    if (next.length !== best.length) {
      best = next.length > best.length ? next : best
      continue
    }
    if (lastAssistantTextLength(next) > lastAssistantTextLength(best)) {
      best = next
    }
  }
  return best
}

export function extractMessagesFromHistory(history: any): any[] | null {
  const states = Array.isArray(history)
    ? history
    : Array.isArray(history?.states)
      ? history.states
      : null
  if (!states?.length) return null
  for (const state of states) {
    const msgs = state?.values?.messages
    if (Array.isArray(msgs) && msgs.length) return msgs
  }
  return null
}
