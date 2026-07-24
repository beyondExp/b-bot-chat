/**
 * Extract Synapse run config from a distribution-channel / assistant payload.
 *
 * Public channels (e.g. Rocket) store identity fields under
 * `config.configurable.*`, while some legacy assistants keep them on
 * `config.*`. Always check both.
 */

function asRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, any>
}

function pickString(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
  }
  return ""
}

export type ChannelRunConfig = {
  apps: Record<string, any>
  systemMessage: string
  instructions: string
  responseModel: string
  queryModel: string
  responseModelBaseUrl: string
  queryModelBaseUrl: string
  userProviderKeyId: string
  responseModelProviderKeyRef: Record<string, any> | null
}

/** Rewrite retired Infomaniak model ids that currently 404 at the provider. */
function rewriteRetiredModels(apps: Record<string, any>): Record<string, any> {
  const next: Record<string, any> = {}
  for (const [key, value] of Object.entries(apps)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      next[key] = value
      continue
    }
    const app = { ...(value as Record<string, any>) }
    for (const field of ["query_model", "response_model", "entity_extraction_model"]) {
      const model = typeof app[field] === "string" ? app[field] : ""
      if (model.includes("Kimi-K2.5") || model.includes("Kimi-K2")) {
        app[field] = "infomaniak/mistralai/Mistral-Small-4-119B-2603"
      }
    }
    next[key] = app
  }
  return next
}

export function extractChannelRunConfig(agentObj: any): ChannelRunConfig {
  const raw = asRecord(agentObj?.rawData) || asRecord(agentObj) || {}
  const config = asRecord(raw.config) || asRecord(raw.metadata?.config) || {}
  const configurable = asRecord(config.configurable) || {}
  const metadata = asRecord(agentObj?.metadata) || asRecord(raw.metadata) || {}

  const apps = rewriteRetiredModels(
    asRecord(configurable.apps) ||
      asRecord(config.apps) ||
      asRecord(raw.apps) ||
      {},
  )

  const systemMessage =
    pickString(
      configurable.system_message,
      configurable.systemMessage,
      config.system_message,
      config.systemMessage,
      metadata.system_message,
      metadata.systemMessage,
    ) || "Be helpful and concise."

  const instructions = pickString(
    configurable.instructions,
    config.instructions,
    metadata.instructions,
  )

  const providerKeyRef =
    asRecord(configurable.response_model_provider_key_ref) ||
    asRecord(config.response_model_provider_key_ref)

  return {
    apps,
    systemMessage,
    instructions,
    responseModel: pickString(configurable.response_model, config.response_model),
    queryModel: pickString(configurable.query_model, config.query_model),
    responseModelBaseUrl: pickString(
      configurable.response_model_base_url,
      config.response_model_base_url,
    ),
    queryModelBaseUrl: pickString(
      configurable.query_model_base_url,
      config.query_model_base_url,
    ),
    userProviderKeyId: pickString(
      configurable.user_provider_key_id,
      config.user_provider_key_id,
    ),
    responseModelProviderKeyRef: providerKeyRef,
  }
}
