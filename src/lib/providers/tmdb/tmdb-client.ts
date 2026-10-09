import { safeFetch } from "@/lib/safe-fetch";
import { createRequestScheduler } from "@/lib/request-scheduler";
import { createCatalogCache, isCatalogPath } from "./tmdb-catalog-cache";

export const TMDB = "https://api.themoviedb.org/3";
export const IMG = "https://image.tmdb.org/t/p";

const tmdbRequests = createRequestScheduler({ concurrency: 6 });

const tmdbInflight = new Map<string, Promise<unknown>>();
const catalogCache = createCatalogCache();

let tmdbLanguage = "";

export function setTmdbLanguage(lang: string): void {
  tmdbLanguage = lang.trim();
}

export function effectiveTmdbLanguage(): string {
  return tmdbLanguage;
}

export function tmdbLanguageIso(): string {
  return effectiveTmdbLanguage().split("-")[0]?.toLowerCase() ?? "";
}

let lastFailureLogged = 0;
function logTmdbFailure(path: string, status: number, body: string): void {
  const now = Date.now();
  if (now - lastFailureLogged < 1000) return;
  lastFailureLogged = now;
  if (status === 401) {
    console.warn(
      `[tmdb] 401 unauthorized on ${path} — TMDB key invalid or revoked. ${body.slice(0, 200)}`,
    );
  } else if (status === 429) {
    console.warn(
      `[tmdb] 429 rate-limited on ${path} — TMDB throttling this IP/key. ${body.slice(0, 200)}`,
    );
  } else if (status === 404) {
    console.warn(`[tmdb] 404 not found on ${path} — TMDB does not have this resource.`);
  } else {
    console.warn(`[tmdb] ${status} on ${path} — ${body.slice(0, 200)}`);
  }
}

async function readJsonBody(res: Response, path: string): Promise<string> {
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      const text = await new Response(stream).text();
      console.info(`[tmdb] gzip auto-decompressed ${path}: ${bytes.length} → ${text.length}`);
      return text;
    } catch (e) {
      console.warn(`[tmdb] DecompressionStream FAILED on ${path} (len=${bytes.length})`, e);
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}

const TMDB_TIMEOUT_MS = 15000;

function runWithDeadline<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    let timer!: ReturnType<typeof setTimeout>;
    let settled = false;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run();
    };
    timer = setTimeout(() => {
      controller.abort();
      finish(() => reject(new Error("tmdb-timeout")));
    }, ms);
    work(controller.signal).then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

function fetchTmdbOnce<T>(url: string, path: string): Promise<{ status: number; data: T | null }> {
  return runWithDeadline<{ status: number; data: T | null }>(TMDB_TIMEOUT_MS, async (signal) => {
    const res = await safeFetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    });
    if (!res.ok) {
      const body = await readJsonBody(res, path).catch(() => "");
      logTmdbFailure(path, res.status, body);
      return { status: res.status, data: null };
    }
    const text = await readJsonBody(res, path);
    try {
      return { status: 200, data: JSON.parse(text) as T };
    } catch (e) {
      const preview = JSON.stringify(text.slice(0, 200));
      console.warn(`[tmdb] parse failure on ${path} (len=${text.length}, starts=${preview})`, e);
      throw new Error("tmdb-parse-failure");
    }
  });
}

export async function get<T>(
  key: string,
  path: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  if (!key) return null;
  const url = new URL(`${TMDB}/${path}`);
  url.searchParams.set("api_key", key);
  const lang = effectiveTmdbLanguage();
  if (lang && !params.language) url.searchParams.set("language", lang);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.sort();
  const target = url.toString();
  // The full URL scopes raw pages by API key, language, region, filters and page.
  // User-specific ranking and watched filtering still run afresh after retrieval.
  const cacheable = isCatalogPath(path);
  const cached = cacheable ? catalogCache.get<T>(target) : undefined;
  if (cached !== undefined) return cached;
  const shared = tmdbInflight.get(target);
  if (shared) {
    const data = await (shared as Promise<T | null>);
    return cacheable ? structuredClone(data) : data;
  }
  const run = fetchWithRetry<T>(target, path);
  tmdbInflight.set(target, run);
  try {
    const data = await run;
    if (cacheable) catalogCache.set(target, data);
    return data;
  } finally {
    tmdbInflight.delete(target);
  }
}

async function fetchWithRetry<T>(target: string, path: string): Promise<T | null> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const backoffMs = Math.min(2000, 250 * 2 ** attempt);
      const { status, data } = await tmdbRequests.schedule(target, async () => {
        const result = await fetchTmdbOnce<T>(target, path);
        if (result.status === 429 || (result.status >= 500 && result.status < 600))
          tmdbRequests.pauseFor(backoffMs);
        return result;
      });
      if (status === 429 || (status >= 500 && status < 600)) {
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "tmdb-parse-failure") {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      console.warn(`[tmdb] network error on ${path}`, e);
      return null;
    }
  }
  return null;
}
