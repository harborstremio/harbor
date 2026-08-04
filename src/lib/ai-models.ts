export type AiProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "meta"
  | "mistral"
  | "deepseek"
  | "xai"
  | "qwen"
  | "moonshot"
  | "nvidia"
  | "groq";

export type AiModel = {
  id: string;
  label: string;
  provider: AiProvider;
  family?: AiProvider;
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
  moonshot: "Moonshot AI",
  nvidia: "NVIDIA",
  groq: "Groq",
};

export type AiProviderTab = "openrouter" | "groq";

export type SettingsLike = {
  aiSearchKey: string;
  aiGroqKey: string;
  aiSearchProvider: AiProviderTab;
};

export function keyForProvider(settings: SettingsLike, provider: AiProvider): string {
  return provider === "groq" ? settings.aiGroqKey : settings.aiSearchKey;
}

export function aiIsGroq(settings: { aiSearchProvider: AiProviderTab }): boolean {
  return settings.aiSearchProvider === "groq";
}

export function aiKey(settings: SettingsLike): string {
  return settings.aiSearchProvider === "groq" ? settings.aiGroqKey : settings.aiSearchKey;
}

export function providerTabFor(modelId: string): AiProviderTab {
  return providerForModel(modelId) === "groq" ? "groq" : "openrouter";
}

export const DEFAULT_AI_MODEL = "google/gemma-4-26b-a4b-it:free";

export const AI_MODELS: AiModel[] = [
  {
    id: "google/gemma-4-26b-a4b-it:free",
    label: "Gemma 4 26B",
    provider: "gemini",
    free: true,
    recommended: true,
  },
  { id: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B", provider: "openai", free: true },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 3 Super 120B",
    provider: "nvidia",
    free: true,
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    label: "Nemotron 3 Nano 30B",
    provider: "nvidia",
    free: true,
  },
  {
    id: "google/gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    provider: "gemini",
    recommended: true,
  },
  { id: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "gemini" },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    recommended: true,
  },
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", provider: "anthropic" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", provider: "openai" },
  { id: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol", provider: "openai" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "deepseek" },
  { id: "qwen/qwen3.6-flash", label: "Qwen 3.6 Flash", provider: "qwen" },
  { id: "x-ai/grok-4.5", label: "Grok 4.5", provider: "xai" },
  { id: "mistralai/mistral-medium-3-5", label: "Mistral Medium 3.5", provider: "mistral" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", provider: "meta" },
  { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5", provider: "moonshot" },
];

export const GROQ_MODELS: AiModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile",
    provider: "groq",
    family: "meta",
    free: true,
    recommended: true,
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    provider: "groq",
    family: "meta",
    free: true,
    recommended: true,
  },
  {
    id: "meta-llama/llama-4-maverick-17b-128e-instruct",
    label: "Llama 4 Maverick 17B",
    provider: "groq",
    family: "meta",
    free: true,
  },
  {
    id: "moonshotai/kimi-k2-instruct",
    label: "Kimi K2 Instruct",
    provider: "groq",
    family: "moonshot",
    free: true,
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    provider: "groq",
    family: "openai",
    free: true,
    recommended: true,
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    provider: "groq",
    family: "openai",
    free: true,
  },
  { id: "qwen/qwen3-32b", label: "Qwen 3 32B", provider: "groq", family: "qwen", free: true },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    provider: "groq",
    family: "meta",
    free: true,
  },
];

const MODEL_MIGRATIONS: Record<string, string> = {
  "google/gemini-flash-1.5": "google/gemini-3.1-flash-lite",
  "google/gemini-flash-1.5-8b": "google/gemini-3.1-flash-lite",
  "google/gemini-pro-1.5": "google/gemini-3.5-flash",
  "google/gemini-2.0-flash-001": "google/gemini-3.5-flash",
  "google/gemma-3-27b-it:free": "google/gemma-4-26b-a4b-it:free",
  "deepseek/deepseek-chat-v3-0324:free": "google/gemma-4-26b-a4b-it:free",
  "meta-llama/llama-3.3-70b-instruct:free": "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen-2.5-72b-instruct:free": "google/gemma-4-26b-a4b-it:free",
  "anthropic/claude-3.5-sonnet": "anthropic/claude-sonnet-5",
  "anthropic/claude-3.7-sonnet": "anthropic/claude-sonnet-5",
  "anthropic/claude-3.5-haiku": "anthropic/claude-haiku-4.5",
  "x-ai/grok-2-1212": "x-ai/grok-4.5",
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
  moonshotai: "moonshot",
  nvidia: "nvidia",
  groq: "groq",
};

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
  return (
    AI_MODELS.find((m) => m.id === modelId)?.label ??
    GROQ_MODELS.find((m) => m.id === modelId)?.label ??
    modelId
  );
}
