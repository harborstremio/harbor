export type AiProvider = "openai" | "anthropic" | "gemini" | "meta" | "mistral" | "deepseek" | "xai" | "qwen" | "groq";

export type AiModel = {
  id: string;
  label: string;
  provider: AiProvider;
  free?: boolean;
  recommended?: boolean;
};

export const PROVIDER_NAME: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google",
  meta: "Meta",
  mistral: "Mistral AI",
  deepseek: "DeepSeek",
  xai: "xAI",
  qwen: "Alibaba",
  groq: "Groq",
};

export type SettingsLike = {
  aiSearchKey: string;
  aiGroqKey: string;
};

export function keyForProvider(settings: SettingsLike, provider: AiProvider): string {
  return provider === "groq" ? settings.aiGroqKey : settings.aiSearchKey;
}

export const DEFAULT_AI_MODEL = "openai/gpt-oss-20b:free";

export const AI_MODELS: AiModel[] = [
  { id: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B", provider: "openai", free: true },
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B", provider: "gemini", free: true },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B", provider: "meta", free: true },
  { id: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B", provider: "qwen", free: true },
  { id: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek V3", provider: "deepseek", free: true },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", provider: "anthropic" },
  { id: "anthropic/claude-3.7-sonnet", label: "Claude 3.7 Sonnet", provider: "anthropic" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", provider: "gemini" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
  { id: "mistralai/mistral-large", label: "Mistral Large", provider: "mistral" },
  { id: "x-ai/grok-2-1212", label: "Grok 2", provider: "xai" },
];

export const GROQ_MODELS: AiModel[] = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile", provider: "groq", free: true, recommended: true },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    provider: "groq",
    free: true,
    recommended: true,
  },
  {
    id: "meta-llama/llama-4-maverick-17b-128e-instruct",
    label: "Llama 4 Maverick 17B",
    provider: "groq",
    free: true,
    recommended: true,
  },
  { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2 Instruct", provider: "groq", free: true },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "groq", free: true, recommended: true },
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "groq", free: true },
  { id: "qwen/qwen3-32b", label: "Qwen 3 32B", provider: "groq", free: true, recommended: true },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", provider: "groq", free: true },
];

const MODEL_MIGRATIONS: Record<string, string> = {
  "google/gemini-flash-1.5": "openai/gpt-oss-20b:free",
  "google/gemini-flash-1.5-8b": "openai/gpt-oss-20b:free",
  "google/gemini-pro-1.5": "openai/gpt-oss-20b:free",
  "deepseek/deepseek-chat": "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct": "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct": "qwen/qwen-2.5-72b-instruct:free",
  "anthropic/claude-3.5-sonnet": "anthropic/claude-3.7-sonnet",
};

export function migrateModelId(id: string): string {
  return MODEL_MIGRATIONS[id] ?? id;
}

const PREFIX_PROVIDER: Record<string, AiProvider> = {
  openai: "openai",
  anthropic: "anthropic",
  google: "gemini",
  "meta-llama": "meta",
  mistralai: "mistral",
  deepseek: "deepseek",
  "x-ai": "xai",
  qwen: "qwen",
  groq: "groq",
};

// Groq has bare IDs like "llama-3.1-8b-instant" (no org prefix) that still belong to Groq.
const BARE_GROQ_PREFIXES = ["llama-", "llama3-"];

export function providerForModel(modelId: string): AiProvider {
  const knownInOpenRouter = AI_MODELS.find((m) => m.id === modelId);
  if (knownInOpenRouter) return knownInOpenRouter.provider;
  const knownInGroq = GROQ_MODELS.find((m) => m.id === modelId);
  if (knownInGroq) return knownInGroq.provider;
  const lowered = modelId.toLowerCase();
  if (BARE_GROQ_PREFIXES.some((p) => lowered.startsWith(p))) return "groq";
  const prefix = modelId.split("/")[0]?.trim().toLowerCase() ?? "";
  return PREFIX_PROVIDER[prefix] ?? "openai";
}

export function modelLabelFor(modelId: string): string {
  return AI_MODELS.find((m) => m.id === modelId)?.label ?? modelId;
}
