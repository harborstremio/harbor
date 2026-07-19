// AI-search model registry and provider routing, ported from the web
// `lib/ai-models.ts`. Two backends are supported: OpenRouter (the default for
// most model ids) and Groq (bare Llama ids and the Groq catalog). The provider
// decides which endpoint and API key a model uses.

/// The upstream provider a model is billed through.
enum AiProvider {
  openai,
  anthropic,
  gemini,
  meta,
  mistral,
  deepseek,
  xai,
  qwen,
  groq,
}

/// Human label for a provider (shown in the model picker).
const Map<AiProvider, String> kProviderName = {
  AiProvider.openai: 'OpenAI',
  AiProvider.anthropic: 'Anthropic',
  AiProvider.gemini: 'Google',
  AiProvider.meta: 'Meta',
  AiProvider.mistral: 'Mistral AI',
  AiProvider.deepseek: 'DeepSeek',
  AiProvider.xai: 'xAI',
  AiProvider.qwen: 'Alibaba',
  AiProvider.groq: 'Groq',
};

/// A selectable AI model.
class AiModel {
  const AiModel({
    required this.id,
    required this.label,
    required this.provider,
    this.free = false,
    this.recommended = false,
  });

  final String id;
  final String label;
  final AiProvider provider;
  final bool free;
  final bool recommended;
}

/// The default model when none is configured.
const String kDefaultAiModel = 'openai/gpt-oss-20b:free';

/// OpenRouter-served models.
const List<AiModel> kAiModels = [
  AiModel(
    id: 'openai/gpt-oss-20b:free',
    label: 'GPT-OSS 20B',
    provider: AiProvider.openai,
    free: true,
  ),
  AiModel(
    id: 'google/gemma-3-27b-it:free',
    label: 'Gemma 3 27B',
    provider: AiProvider.gemini,
    free: true,
  ),
  AiModel(
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B',
    provider: AiProvider.meta,
    free: true,
  ),
  AiModel(
    id: 'qwen/qwen-2.5-72b-instruct:free',
    label: 'Qwen 2.5 72B',
    provider: AiProvider.qwen,
    free: true,
  ),
  AiModel(
    id: 'deepseek/deepseek-chat-v3-0324:free',
    label: 'DeepSeek V3',
    provider: AiProvider.deepseek,
    free: true,
  ),
  AiModel(
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: AiProvider.openai,
  ),
  AiModel(id: 'openai/gpt-4o', label: 'GPT-4o', provider: AiProvider.openai),
  AiModel(
    id: 'anthropic/claude-3.5-haiku',
    label: 'Claude 3.5 Haiku',
    provider: AiProvider.anthropic,
  ),
  AiModel(
    id: 'anthropic/claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    provider: AiProvider.anthropic,
  ),
  AiModel(
    id: 'google/gemini-2.0-flash-001',
    label: 'Gemini 2.0 Flash',
    provider: AiProvider.gemini,
  ),
  AiModel(
    id: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: AiProvider.gemini,
  ),
  AiModel(
    id: 'mistralai/mistral-large',
    label: 'Mistral Large',
    provider: AiProvider.mistral,
  ),
  AiModel(id: 'x-ai/grok-2-1212', label: 'Grok 2', provider: AiProvider.xai),
];

/// Groq-served models.
const List<AiModel> kGroqModels = [
  AiModel(
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B Versatile',
    provider: AiProvider.groq,
    free: true,
    recommended: true,
  ),
  AiModel(
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout 17B',
    provider: AiProvider.groq,
    free: true,
    recommended: true,
  ),
  AiModel(
    id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    label: 'Llama 4 Maverick 17B',
    provider: AiProvider.groq,
    free: true,
    recommended: true,
  ),
  AiModel(
    id: 'moonshotai/kimi-k2-instruct',
    label: 'Kimi K2 Instruct',
    provider: AiProvider.groq,
    free: true,
  ),
  AiModel(
    id: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    provider: AiProvider.groq,
    free: true,
    recommended: true,
  ),
  AiModel(
    id: 'openai/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    provider: AiProvider.groq,
    free: true,
  ),
  AiModel(
    id: 'qwen/qwen3-32b',
    label: 'Qwen 3 32B',
    provider: AiProvider.groq,
    free: true,
    recommended: true,
  ),
  AiModel(
    id: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant',
    provider: AiProvider.groq,
    free: true,
  ),
];

const Map<String, String> _modelMigrations = {
  'google/gemini-flash-1.5': 'openai/gpt-oss-20b:free',
  'google/gemini-flash-1.5-8b': 'openai/gpt-oss-20b:free',
  'google/gemini-pro-1.5': 'openai/gpt-oss-20b:free',
  'deepseek/deepseek-chat': 'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct': 'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct': 'qwen/qwen-2.5-72b-instruct:free',
  'anthropic/claude-3.5-sonnet': 'anthropic/claude-3.7-sonnet',
};

/// Remaps retired model ids onto their current replacement.
String migrateModelId(String id) => _modelMigrations[id] ?? id;

const Map<String, AiProvider> _prefixProvider = {
  'openai': AiProvider.openai,
  'anthropic': AiProvider.anthropic,
  'google': AiProvider.gemini,
  'meta-llama': AiProvider.meta,
  'mistralai': AiProvider.mistral,
  'deepseek': AiProvider.deepseek,
  'x-ai': AiProvider.xai,
  'qwen': AiProvider.qwen,
  'groq': AiProvider.groq,
};

// Groq has bare ids like "llama-3.1-8b-instant" (no org prefix) that are Groq's.
const List<String> _bareGroqPrefixes = ['llama-', 'llama3-'];

/// The provider a model id routes to, matching the web `providerForModel`: known
/// catalog entries win, then bare Groq prefixes, then the org prefix, defaulting
/// to OpenAI (OpenRouter).
AiProvider providerForModel(String modelId) {
  for (final m in kAiModels) {
    if (m.id == modelId) return m.provider;
  }
  for (final m in kGroqModels) {
    if (m.id == modelId) return m.provider;
  }
  final lowered = modelId.toLowerCase();
  if (_bareGroqPrefixes.any(lowered.startsWith)) return AiProvider.groq;
  final prefix = modelId.split('/').first.trim().toLowerCase();
  return _prefixProvider[prefix] ?? AiProvider.openai;
}

/// The display label for a model id, or the id itself when unknown.
String modelLabelFor(String modelId) {
  for (final m in kAiModels) {
    if (m.id == modelId) return m.label;
  }
  return modelId;
}
