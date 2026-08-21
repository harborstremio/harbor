/// Legacy AI-model id remaps, from Harbor's `src/lib/ai-models.ts`
/// `MODEL_MIGRATIONS`. Applied to a stored `aiSearchModel` on settings load and
/// on every AI request.
const Map<String, String> kModelMigrations = {
  'google/gemini-flash-1.5': 'openai/gpt-oss-20b:free',
  'google/gemini-flash-1.5-8b': 'openai/gpt-oss-20b:free',
  'google/gemini-pro-1.5': 'openai/gpt-oss-20b:free',
  'deepseek/deepseek-chat': 'deepseek/deepseek-chat-v3-0324:free',
  'meta-llama/llama-3.3-70b-instruct': 'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct': 'qwen/qwen-2.5-72b-instruct:free',
  'anthropic/claude-3.5-sonnet': 'anthropic/claude-3.7-sonnet',
};

String migrateModelId(String id) => kModelMigrations[id] ?? id;
