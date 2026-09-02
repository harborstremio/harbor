import { getUiLanguage, LANGUAGES, type UiLanguage } from "@/lib/i18n";
import { safeFetchStream } from "@/lib/safe-fetch";
import { setItemWithRecovery } from "@/lib/storage-recovery";
import { ebookTranslationCacheGet, ebookTranslationCachePut } from "./cache";
import translationInstructions from "./translation-instructions.md?raw";

const STORAGE_KEY = "harbor.ebook.translation.v1";
const CACHE_PREFIX = "harbor.ebook.translation.cache.v1.";
const ENDPOINT = "https://api.deepseek.com/chat/completions";

export type EBookTranslationSettings = {
  enabled: boolean;
  apiKey: string;
  model: string;
  targetLanguage: UiLanguage;
};

const languageName = Object.fromEntries(
  LANGUAGES.map(({ code, label }) => [code, label]),
) as Record<UiLanguage, string>;
export type EBookTranslation = { title: string; text: string };
const pending = new Map<string, Promise<EBookTranslation>>();
let legacyMigrationScheduled = false;

export type EBookTranslationProgress = {
  percent: number;
  etaMs: number | null;
};

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return `${value.length}:${result >>> 0}`;
}

function cacheSlot(source: string, title: string, settings: EBookTranslationSettings): string {
  const model = settings.model.trim() || "deepseek-v4-flash";
  const cacheKey = `${model}:${settings.targetLanguage}:${hash(translationInstructions)}:${hash(title)}:${hash(source)}`;
  return `${CACHE_PREFIX}${hash(cacheKey)}`;
}

async function cachedTranslation(slot: string): Promise<EBookTranslation | null> {
  const durable = await ebookTranslationCacheGet(slot);
  if (durable?.text) return durable;
  try {
    const legacy = JSON.parse(localStorage.getItem(slot) ?? "null") as EBookTranslation | null;
    if (!legacy?.text) return null;
    // Move the legacy value only after IndexedDB confirms the durable write.
    // This preserves every existing AI translation while releasing the much
    // smaller localStorage quota that settings and reader state share.
    if (await ebookTranslationCachePut(slot, legacy)) localStorage.removeItem(slot);
    return legacy;
  } catch {
    return null;
  }
}

function scheduleLegacyTranslationMigration(): void {
  if (legacyMigrationScheduled || typeof window === "undefined") return;
  legacyMigrationScheduled = true;
  const migrate = () => {
    const slots: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX)) slots.push(key);
    }
    void (async () => {
      for (const slot of slots) {
        try {
          const value = JSON.parse(localStorage.getItem(slot) ?? "null") as EBookTranslation | null;
          if (value?.text && (await ebookTranslationCachePut(slot, value)))
            localStorage.removeItem(slot);
        } catch {
          /* A malformed legacy entry remains isolated from valid translations. */
        }
      }
    })();
  };
  const idleWindow = window as typeof window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  };
  if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback(migrate, { timeout: 5_000 });
  else window.setTimeout(migrate, 1_000);
}

export function loadEBookTranslationSettings(): EBookTranslationSettings {
  scheduleLegacyTranslationMigration();
  const defaults: EBookTranslationSettings = {
    enabled: false,
    apiKey: "",
    model: "deepseek-v4-flash",
    targetLanguage: getUiLanguage(),
  };
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "{}",
    ) as Partial<EBookTranslationSettings>;
    const targetLanguage = LANGUAGES.some(({ code }) => code === stored.targetLanguage)
      ? (stored.targetLanguage as UiLanguage)
      : defaults.targetLanguage;
    return {
      enabled: stored.enabled === true,
      apiKey: typeof stored.apiKey === "string" ? stored.apiKey : defaults.apiKey,
      model: typeof stored.model === "string" ? stored.model : defaults.model,
      targetLanguage,
    };
  } catch {
    return defaults;
  }
}

export function saveEBookTranslationSettings(settings: EBookTranslationSettings): boolean {
  return setItemWithRecovery(STORAGE_KEY, JSON.stringify(settings));
}

export async function testEBookTranslationSettings(
  settings: EBookTranslationSettings,
): Promise<EBookTranslation> {
  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim() || "deepseek-v4-flash";
  if (!apiKey) throw new Error("Add a DeepSeek API key first");
  return requestTranslation(
    "A quiet harbor welcomes every reader.",
    "Translation test",
    settings,
    apiKey,
    model,
  );
}

export async function translateEBookChapter(
  source: string,
  title = "",
  manual = false,
  onProgress?: (progress: EBookTranslationProgress) => void,
): Promise<EBookTranslation> {
  const settings = loadEBookTranslationSettings();
  const apiKey = settings.apiKey.trim();
  const model = settings.model.trim() || "deepseek-v4-flash";
  const original = { title, text: source };
  if (!source.trim()) return original;
  const slot = cacheSlot(source, title, settings);
  const saved = await cachedTranslation(slot);
  if (saved) {
    onProgress?.({ percent: 100, etaMs: 0 });
    return saved;
  }
  if (!settings.enabled && !manual) return original;
  if (!apiKey.trim()) {
    if (manual) {
      throw new Error("Add a DeepSeek API key in eBook Sources first");
    }
    return original;
  }
  let request = pending.get(slot);
  if (!request) {
    request = requestTranslation(source, title, settings, apiKey, model, onProgress);
    pending.set(slot, request);
    request.then(
      () => pending.delete(slot),
      () => pending.delete(slot),
    );
  }
  const result = await request;
  const durable = await ebookTranslationCachePut(slot, result);
  if (!durable) setItemWithRecovery(slot, JSON.stringify(result));
  onProgress?.({ percent: 100, etaMs: 0 });
  return result;
}

export async function cachedEBookTranslation(
  source: string,
  title = "",
): Promise<EBookTranslation | null> {
  if (!source.trim()) return null;
  const settings = loadEBookTranslationSettings();
  return cachedTranslation(cacheSlot(source, title, settings));
}

export function shouldAutomaticallyTranslateEBookChapter(): boolean {
  const settings = loadEBookTranslationSettings();
  return settings.enabled && !!settings.apiKey.trim();
}

async function requestTranslation(
  source: string,
  title: string,
  settings: EBookTranslationSettings,
  apiKey: string,
  model: string,
  onProgress?: (progress: EBookTranslationProgress) => void,
): Promise<EBookTranslation> {
  onProgress?.({ percent: 0, etaMs: null });
  const response = await safeFetchStream(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      thinking: { type: "disabled" },
      temperature: 0,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        {
          role: "system",
          content: translationInstructions,
        },
        {
          role: "user",
          content: `target_language: ${languageName[settings.targetLanguage]}\nsource_language: detect\nquality_mode: standard\ntranslation_style: faithful\noutput_formats: plain text\ncustom_instructions: Translate both the chapter title and chapter body. Preserve the two XML tags exactly and return nothing outside them.\n\n<source_document>\n<chapter_title>${title}</chapter_title>\n<chapter_body>${source}</chapter_body>\n</source_document>`,
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let message = detail;
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } };
      message = parsed.error?.message || detail;
    } catch {}
    throw new Error(
      `DeepSeek HTTP ${response.status}${message ? `: ${message.slice(0, 240)}` : ""}`,
    );
  }
  if (!response.body) throw new Error("DeepSeek returned no response stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let firstChunk = 0;
  let lastReport = 0;
  let buffer = "";
  let output = "";
  let finishReason = "";
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    const chunk = JSON.parse(data) as {
      error?: { message?: string };
      choices?: Array<{ finish_reason?: string | null; delta?: { content?: string | null } }>;
    };
    if (chunk.error?.message) throw new Error(chunk.error.message);
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    if (!choice?.delta?.content) return;
    output += choice.delta.content;
    const now = performance.now();
    if (!firstChunk) firstChunk = now;
    if (now - lastReport < 250) return;
    lastReport = now;
    const generatedMs = Math.max(1, now - firstChunk);
    const rate = output.length / generatedMs;
    const remaining = Math.max(0, source.length - output.length);
    onProgress?.({
      percent: Math.min(95, Math.max(1, Math.round((output.length / source.length) * 100))),
      etaMs: rate > 0 ? remaining / rate : null,
    });
  };
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) consume(line);
    if (done) {
      if (buffer) consume(buffer);
      break;
    }
  }
  if (finishReason === "length") throw new Error("DeepSeek translation was truncated");
  if (finishReason && finishReason !== "stop")
    throw new Error(`DeepSeek stopped translation: ${finishReason.replaceAll("_", " ")}`);
  const translated = output.replace(/^```(?:text|xml)?\s*|\s*```$/gi, "").trim();
  if (!translated) throw new Error("DeepSeek returned no translation");
  const translatedTitle = translated
    .match(/<chapter_title>([\s\S]*?)<\/chapter_title>/i)?.[1]
    .trim();
  const translatedText = translated.match(/<chapter_body>([\s\S]*?)<\/chapter_body>/i)?.[1].trim();
  if (!translatedText) throw new Error("DeepSeek returned an incomplete chapter translation");
  return { title: translatedTitle || title, text: translatedText };
}
