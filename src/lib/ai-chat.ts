import { safeFetch as fetch } from "./safe-fetch";
import { HARBOR_API_BASE } from "./config/endpoints";
import {
  DEFAULT_GEMINI_CHAT_MODEL,
  isSupportedGeminiChatModel,
  sortGeminiChatModelIds,
} from "./ai-chat-models";
import {
  buildResearchPlanningPrompt,
  parseChatResearchPlan,
  prepareChatRequest,
  extractFollowUps,
  type ChatResearchPlan,
} from "./ai-chat-prompts";
import { extractRecommendations, type RecommendationItem } from "./ai-chat-recommendations";
import type { ResolvedRecommendation } from "./ai-chat-catalog";
import type { ChatSearchSource } from "./ai-chat-research";

export type ChatRole = "user" | "model";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  recommendations?: RecommendationItem[];
  resolvedMeta?: ResolvedRecommendation[];
  loading?: boolean;
  error?: string;
  webSearchSource?: string | null;
  sources?: ChatSearchSource[];
  researchUnavailable?: boolean;
  followUps?: string[];
};

const CANDIDATE_MODELS = [DEFAULT_GEMINI_CHAT_MODEL];

export type GeminiListedModel = {
  id: string;
  label: string;
};

const MODEL_LIST_TTL_MS = 60 * 60 * 1000;
const modelListCache = new Map<string, { at: number; models: GeminiListedModel[] }>();
const modelListInflight = new Map<string, Promise<GeminiListedModel[]>>();

export function prettifyModelId(id: string): string {
  const core = id.replace(/^models\//, "");
  return core
    .split("-")
    .map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// Ask the API which models actually exist for this key instead of guessing IDs.
// Guessing is what produced the "Model ... not available (404)" errors.
export async function listGeminiModels(apiKey: string): Promise<GeminiListedModel[]> {
  const key = apiKey.trim();
  if (!key) return [];
  const cached = modelListCache.get(key);
  if (cached && Date.now() - cached.at < MODEL_LIST_TTL_MS) return cached.models;
  const inflight = modelListInflight.get(key);
  if (inflight) return inflight;

  const p = (async () => {
    const url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100";
    const res = await fetch(url, { headers: { "x-goog-api-key": key } });
    if (!res.ok) {
      throw chatApiError("Gemini model list", res.status);
    }
    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const ids = (data.models ?? [])
      .filter((m) => typeof m.name === "string" && isSupportedGeminiChatModel(m.name))
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .filter((m) => !/embedding|aqa|tts|imagen|veo/i.test(m.name as string))
      .map((m) => (m.name as string).replace(/^models\//, ""));
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const id of ids) {
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(id);
      }
    }
    const out = sortGeminiChatModelIds(unique).map((id) => ({
      id,
      label: prettifyModelId(id),
    }));
    modelListCache.set(key, { at: Date.now(), models: out });
    return out;
  })().finally(() => {
    modelListInflight.delete(key);
  });
  modelListInflight.set(key, p);
  return p;
}

async function resolveModelsToTry(apiKey: string, preferredModel?: string): Promise<string[]> {
  if (preferredModel) {
    if (!isSupportedGeminiChatModel(preferredModel))
      throw new Error("Choose a supported Gemini chat model.");
    return [preferredModel];
  }
  try {
    const listed = await listGeminiModels(apiKey);
    if (listed.length > 0) {
      const ids = listed.map((m) => m.id);
      return ids.slice(0, 1);
    }
  } catch {
    // Fall through to the static candidate list below.
  }
  return CANDIDATE_MODELS;
}

export type OpenAiChatProvider = "openrouter" | "groq";

export type ChatRequestOptions = {
  signal?: AbortSignal;
  researchStatus?: "disabled" | "unavailable" | "skipped";
  systemPrompt?: string;
  maxOutputTokens?: number;
};

// Chat-scoped OpenAI-compatible completion path for OpenRouter and Groq models.
// It is intentionally separate from AI search so the assistant can use these
// keys without sharing the search provider/model selection.
export async function callOpenAiCompatibleChatApi(
  provider: OpenAiChatProvider,
  apiKey: string,
  history: Array<{ role: ChatRole; text: string }>,
  preferredModel?: string,
  webContext?: string,
  options: ChatRequestOptions = {},
): Promise<{
  text: string;
  recommendations: RecommendationItem[];
  followUps: string[];
  usage?: { promptTokens: number; candidateTokens: number; totalTokens: number };
}> {
  const key = apiKey.trim();
  const model = preferredModel?.trim();
  if (!key) {
    throw new Error(
      "Missing API key. Add your OpenRouter or Groq key in Settings to use this model.",
    );
  }
  if (!model) {
    throw new Error("Missing AI model. Please choose a model for this chat.");
  }

  const request = prepareChatRequest(history, webContext, options.researchStatus);

  const groq = provider === "groq";
  const providerLabel = groq ? "Groq" : "OpenRouter";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (!groq) {
    headers["HTTP-Referer"] = HARBOR_API_BASE;
    headers["X-Title"] = "Harbor";
  }
  const res = await fetch(
    groq
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      signal: options.signal,
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: options.maxOutputTokens ?? 8192,
        messages: [
          { role: "system", content: options.systemPrompt ?? request.systemPrompt },
          ...request.history.map((msg) => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.text,
          })),
        ],
      }),
    },
  );

  if (!res.ok) {
    throw chatApiError(providerLabel, res.status);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const rawText = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!rawText) {
    throw new Error(`${providerLabel} returned an empty response.`);
  }

  const { cleanText: answer, followUps } = extractFollowUps(rawText);
  const { cleanText, items } = extractRecommendations(answer);
  const usage = data.usage;
  return {
    text: cleanText,
    recommendations: items,
    followUps,
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens ?? 0,
          candidateTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

export async function callGeminiApi(
  apiKey: string,
  history: Array<{ role: ChatRole; text: string }>,
  preferredModel?: string,
  webContext?: string,
  options: ChatRequestOptions = {},
): Promise<{
  text: string;
  recommendations: RecommendationItem[];
  followUps: string[];
  usage?: { promptTokens: number; candidateTokens: number; totalTokens: number };
}> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Missing Gemini API key. Please configure your key in settings.");
  }

  const modelsToTry = await resolveModelsToTry(key, preferredModel);
  options.signal?.throwIfAborted();

  const request = prepareChatRequest(history, webContext, options.researchStatus);
  const contents = request.history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: options.systemPrompt ?? request.systemPrompt }],
    },
    generationConfig: {
      temperature: 0.25,
      topP: 0.85,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  };

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    options.signal?.throwIfAborted();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: options.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // If 404, try next model in candidate list
        if (res.status === 404) {
          lastError = new Error(`Model ${model} not available (404)`);
          continue;
        }
        // Auth, quota, and bad-request failures won't succeed on another model; fail fast.
        if ([400, 401, 403].includes(res.status)) {
          throw chatApiError("Gemini", res.status);
        }
        lastError = chatApiError("Gemini", res.status);
        // Rate limits can differ by model; try the next model available to this key.
        continue;
      }

      const data = (await res.json()) as {
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string; thought?: boolean }>;
          };
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        }>;
      };

      const rawText =
        data.candidates?.[0]?.content?.parts
          ?.filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("")
          .trim() ?? "";

      if (!rawText) {
        throw new Error("Gemini returned an empty response.");
      }

      const { cleanText: answer, followUps } = extractFollowUps(rawText);
      const { cleanText, items } = extractRecommendations(answer);
      const usage = data.usageMetadata ?? data.candidates?.[0]?.usageMetadata;
      return {
        text: cleanText,
        recommendations: items,
        followUps,
        usage: usage
          ? {
              promptTokens: usage.promptTokenCount ?? 0,
              candidateTokens: usage.candidatesTokenCount ?? 0,
              totalTokens: usage.totalTokenCount ?? 0,
            }
          : undefined,
      };
    } catch (err: unknown) {
      options.signal?.throwIfAborted();
      if (
        err instanceof Error &&
        (err.message.includes("Invalid Gemini API Key") ||
          /Gemini \((400|401|403)\)/.test(err.message))
      ) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Failed to communicate with Gemini API.");
}

export async function planChatResearch(
  provider: "gemini" | "openrouter" | "groq",
  key: string,
  model: string,
  history: Array<{ role: ChatRole; text: string }>,
  currentTitleContext: string | undefined,
  signal: AbortSignal,
): Promise<ChatResearchPlan> {
  const latest = [...history].reverse().find((message) => message.role === "user")?.text ?? "";
  const options = { signal, systemPrompt: buildResearchPlanningPrompt(), maxOutputTokens: 2048 };
  const planningHistory = history.map((message, index) => ({
    ...message,
    text:
      index === history.length - 1 && currentTitleContext
        ? message.text + "\n\n" + currentTitleContext
        : message.text,
  }));
  try {
    const result =
      provider === "gemini"
        ? await callGeminiApi(key, planningHistory, model, undefined, options)
        : await callOpenAiCompatibleChatApi(
            provider,
            key,
            planningHistory,
            model,
            undefined,
            options,
          );
    return { ...parseChatResearchPlan(result.text, latest), usage: result.usage };
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof Error && /\((400|401|403|404|429)\)/.test(error.message)) throw error;
    return parseChatResearchPlan("", latest);
  }
}

function chatApiError(provider: string, status: number): Error {
  // Provider error bodies can echo request content and credentials.
  const detail =
    status === 401 || status === 403
      ? "Check your API key and model access."
      : status === 429
        ? "Rate limit or quota reached. Try again later or choose another model."
        : status === 404
          ? "The selected model is unavailable. Choose another model."
          : status === 400
            ? "The provider rejected this request. Check the selected model."
            : "The service is temporarily unavailable. Try again later.";
  return new Error(`${provider} (${status}): ${detail}`);
}
