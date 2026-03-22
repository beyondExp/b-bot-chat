const DEFAULT_BBOT_INFOMANIAK_MODEL = "infomaniak/moonshotai/Kimi-K2.5"

function readEnv(name: string): string {
  return String(process.env[name] || "").trim()
}

function buildDefaultBaseUrl(): string | null {
  const explicit =
    readEnv("BBOT_DEFAULT_RESPONSE_MODEL_BASE_URL") ||
    readEnv("INFOMANIAK_OPENAI_BASE_URL")
  if (explicit) return explicit

  const productId =
    readEnv("BBOT_INFOMANIAK_PRODUCT_ID") ||
    readEnv("INFOMANIAK_PRODUCT_ID") ||
    readEnv("INFOMANIAK_AI_PRODUCT_ID")
  if (!productId) return null

  return `https://api.infomaniak.com/2/ai/${productId}/openai/v1`
}

function readDefaultApiKey(): string {
  return (
    readEnv("BBOT_INFOMANIAK_API_KEY") ||
    readEnv("INFOMANIAK_API_KEY") ||
    readEnv("INFOMANIAK_LLM_API_KEY")
  )
}

export function isBBotAssistantId(value: unknown): boolean {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()

  return normalized === "bbot" || normalized === "b-bot"
}

export function applyDefaultBbotModel(body: any) {
  const configurable = body?.config?.configurable ?? body?.configurable
  if (!configurable || typeof configurable !== "object") return body

  const assistantCandidate =
    body?.assistant_id ||
    body?.assistantId ||
    configurable?.assistant_id ||
    configurable?.agent_id

  if (!isBBotAssistantId(assistantCandidate)) return body

  const configuredModel =
    typeof configurable.response_model === "string" ? configurable.response_model.trim() : ""
  const configuredBaseUrl =
    typeof configurable.response_model_base_url === "string"
      ? configurable.response_model_base_url.trim()
      : ""
  const configuredApiKey =
    typeof configurable.response_model_api_key === "string"
      ? configurable.response_model_api_key.trim()
      : ""

  const envModel = readEnv("BBOT_DEFAULT_RESPONSE_MODEL")
  const envBaseUrl = buildDefaultBaseUrl()
  const envApiKey = readDefaultApiKey()

  // Safe fallback: only default to the Infomaniak Kimi model when we also have
  // a usable base URL (derived from product_id or set explicitly).
  const fallbackModel = envBaseUrl ? DEFAULT_BBOT_INFOMANIAK_MODEL : ""
  const nextModel = envModel || fallbackModel

  if (!configuredModel && nextModel) {
    configurable.response_model = nextModel
  }

  if (!configuredBaseUrl && envBaseUrl) {
    configurable.response_model_base_url = envBaseUrl
  }

  if (!configuredApiKey && envApiKey) {
    configurable.response_model_api_key = envApiKey
  }

  return body
}
