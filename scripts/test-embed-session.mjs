/**
 * Lightweight checks for embed session binding helpers.
 * Run: node --experimental-strip-types scripts/test-embed-session.mjs
 * (or compile via tsx if available). Uses plain crypto replication of the
 * server hashing contract so we don't need a Next.js runtime here.
 */
import crypto from "crypto"
import assert from "assert"

function hashEmbedSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex")
}

function authorize({
  boundHash,
  presentedToken,
  channelId,
  agentId,
  assistantId,
  presentedChannel,
  boundOrigin,
  presentedOrigin,
  legacy = true,
}) {
  if (boundHash) {
    if (!presentedToken) return "embed_session_required"
    const presentedHash = hashEmbedSessionToken(presentedToken)
    const a = Buffer.from(boundHash, "utf8")
    const b = Buffer.from(presentedHash, "utf8")
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return "embed_session_mismatch"
    const boundChannelIds = [agentId, assistantId, channelId]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
    if (
      boundChannelIds.length > 0 &&
      presentedChannel &&
      !boundChannelIds.includes(presentedChannel)
    ) {
      return "embed_channel_mismatch"
    }
    if (boundOrigin && presentedOrigin && boundOrigin !== presentedOrigin) return "embed_origin_mismatch"
    return null
  }
  return legacy ? null : "embed_session_required"
}

const tokenA = crypto.randomBytes(32).toString("hex")
const tokenB = crypto.randomBytes(32).toString("hex")
const hashA = hashEmbedSessionToken(tokenA)

assert.strictEqual(
  authorize({
    boundHash: hashA,
    presentedToken: tokenA,
    channelId: "channel-1",
    presentedChannel: "channel-1",
    boundOrigin: "https://swiss-chat.ch",
    presentedOrigin: "https://swiss-chat.ch",
  }),
  null,
  "matching session must be allowed",
)

assert.strictEqual(
  authorize({
    boundHash: hashA,
    presentedToken: tokenB,
    channelId: "channel-1",
    presentedChannel: "channel-1",
  }),
  "embed_session_mismatch",
  "other visitor session must be denied",
)

assert.strictEqual(
  authorize({
    boundHash: hashA,
    presentedToken: tokenA,
    channelId: "channel-1",
    presentedChannel: "channel-2",
  }),
  "embed_channel_mismatch",
  "cross-channel reuse must be denied",
)

assert.strictEqual(
  authorize({
    boundHash: hashA,
    presentedToken: tokenA,
    agentId: "bbot",
    assistantId: "184bb292-b6eb-57e2-8d16-3df9d060716d",
    presentedChannel: "bbot",
  }),
  null,
  "public channel id must match even when assistant_id was rewritten to Synapse UUID",
)

assert.strictEqual(
  authorize({
    boundHash: hashA,
    presentedToken: tokenA,
    agentId: "bbot",
    assistantId: "184bb292-b6eb-57e2-8d16-3df9d060716d",
    presentedChannel: "184bb292-b6eb-57e2-8d16-3df9d060716d",
  }),
  null,
  "Synapse assistant UUID must also be accepted when present on the thread",
)

assert.strictEqual(
  authorize({
    boundHash: "",
    presentedToken: "",
    legacy: true,
  }),
  null,
  "legacy threads remain readable during migration",
)

assert.strictEqual(
  authorize({
    boundHash: "",
    presentedToken: "",
    legacy: false,
  }),
  "embed_session_required",
  "legacy must be denyable after migration window",
)

console.log("embed-session checks passed")
