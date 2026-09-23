// Per-session daily message cap for anonymous/embed traffic.
//
// Counters are kept in process memory: on serverless/multi-instance deploys
// each instance counts independently, so the effective cap is approximate.
// That is acceptable here — the goal is to stop unbounded free usage, not to
// provide exact billing-grade metering (paid usage is metered in MainAPI).

const DEFAULT_DAILY_LIMIT = 20
const MAX_TRACKED_SESSIONS = 50_000

type Counter = { day: string; count: number }

const counters = new Map<string, Counter>()

function currentDay(): string {
  return new Date().toISOString().slice(0, 10)
}

export function anonymousDailyLimit(): number {
  const raw = Number(process.env.ANON_DAILY_MESSAGE_LIMIT || process.env.EMBED_DAILY_MESSAGE_LIMIT || "")
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  return DEFAULT_DAILY_LIMIT
}

/**
 * Consume one anonymous message for the given session key.
 * Returns whether the message is allowed plus limit/remaining for headers.
 */
export function consumeAnonymousMessage(sessionKey: string): {
  allowed: boolean
  limit: number
  remaining: number
} {
  const limit = anonymousDailyLimit()
  const key = String(sessionKey || "unknown").slice(0, 128)
  const day = currentDay()

  if (counters.size > MAX_TRACKED_SESSIONS) {
    for (const [k, v] of counters) {
      if (v.day !== day) counters.delete(k)
    }
    // Still oversized after purging stale days: drop everything rather than grow unbounded.
    if (counters.size > MAX_TRACKED_SESSIONS) counters.clear()
  }

  const existing = counters.get(key)
  const counter = existing && existing.day === day ? existing : { day, count: 0 }

  if (counter.count >= limit) {
    counters.set(key, counter)
    return { allowed: false, limit, remaining: 0 }
  }

  counter.count += 1
  counters.set(key, counter)
  return { allowed: true, limit, remaining: Math.max(0, limit - counter.count) }
}
