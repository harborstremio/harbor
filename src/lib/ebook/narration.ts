import { Channel, invoke } from "@tauri-apps/api/core";

export type NarrationProgress = {
  completed: number;
  total: number;
  percent: number;
};

export type NarrationBoundary = {
  offsetMs: number;
  durationMs: number;
  text: string;
};

export type EdgeNarrationVoice = {
  id: string;
  locale: string;
  gender: string;
  name: string;
};

type NativeNarrationResult = {
  audioBase64: string;
  boundaries: NarrationBoundary[];
};
const CACHE = "harbor-ebook-edge-narration-v2";
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1_000;
const CACHED_AT = "X-Harbor-Cached-At";
const CACHED_VOICE = "X-Harbor-Voice";
const CACHED_LOCALE = "X-Harbor-Locale";
let voicesRequest: Promise<EdgeNarrationVoice[]> | null = null;

export function narrationWordCount(text: string, locale: string): number {
  try {
    const segmenter = new Intl.Segmenter(locale || undefined, { granularity: "word" });
    let count = 0;
    for (const segment of segmenter.segment(text)) {
      if (segment.isWordLike) count += 1;
    }
    if (count > 0) return count;
  } catch {
    // Older WebViews fall back to a Unicode expression that keeps Arabic marks attached.
  }
  return text.match(/[\p{L}\p{M}\p{N}'’]+/gu)?.length ?? 0;
}

export function fetchEdgeNarrationVoices(): Promise<EdgeNarrationVoice[]> {
  if (!("__TAURI_INTERNALS__" in window)) return Promise.resolve([]);
  voicesRequest ??= invoke<EdgeNarrationVoice[]>("ebook_tts_voices").catch((error) => {
    voicesRequest = null;
    throw error;
  });
  return voicesRequest;
}

const hash = (value: string) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};

const fromBase64 = (value: string) => {
  const decoded = atob(value);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return new Blob([bytes], { type: "audio/mpeg" });
};

export async function synthesizeNarration(
  requestId: string,
  text: string,
  voice: string,
  locale: string,
  onProgress: (progress: NarrationProgress) => void,
): Promise<{ blob: Blob; boundaries: NarrationBoundary[] }> {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("Direct Edge TTS is available in the Harbor desktop app");
  }
  const cache = "caches" in globalThis ? await caches.open(CACHE) : null;
  const cacheKey = new Request(
    `https://harbor.local/ebook-edge-audio/${hash(`${voice}\n${locale}\n${text}`)}`,
  );
  const cached = await cache?.match(cacheKey);
  if (cached) {
    const cachedAt = Number(cached.headers.get(CACHED_AT));
    if (
      Number.isFinite(cachedAt) &&
      Date.now() - cachedAt < CACHE_MAX_AGE &&
      cached.headers.get(CACHED_VOICE) === voice &&
      cached.headers.get(CACHED_LOCALE) === locale
    ) {
      const result = (await cached.json()) as NativeNarrationResult;
      onProgress({ completed: 1, total: 1, percent: 100 });
      return { blob: fromBase64(result.audioBase64), boundaries: result.boundaries ?? [] };
    }
    await cache?.delete(cacheKey);
  }
  const channel = new Channel<NarrationProgress>();
  channel.onmessage = onProgress;
  const result = await invoke<NativeNarrationResult>("ebook_tts_synthesize", {
    requestId,
    text,
    voice,
    locale,
    rate: 0,
    onProgress: channel,
  });
  await cache?.put(
    cacheKey,
    new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        [CACHED_AT]: String(Date.now()),
        [CACHED_VOICE]: voice,
        [CACHED_LOCALE]: locale,
      },
    }),
  );
  return { blob: fromBase64(result.audioBase64), boundaries: result.boundaries ?? [] };
}

export async function cancelNarration(requestId: string): Promise<void> {
  if (!requestId || !("__TAURI_INTERNALS__" in window)) return;
  await invoke("ebook_tts_cancel", { requestId });
}

export async function clearNarrationCache(): Promise<void> {
  if ("caches" in globalThis) await caches.delete(CACHE);
}
