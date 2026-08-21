import {
  listSources,
  type ServerConfig,
  type SuwayomiSource,
} from "@/lib/manga/sources/suwayomi/provider";

/** Sentinel meaning "no language restriction". */
export const ALL_LANGS = "*";

const STORAGE_KEY = "harbor.manga.langfilter.v1";
const DEFAULT_FILTER: string[] = ["en"];

const listeners = new Set<() => void>();

export function loadMangaLangFilter(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_FILTER];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...DEFAULT_FILTER];
    const langs = arr.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    return langs.length > 0 ? langs : [ALL_LANGS];
  } catch {
    return [...DEFAULT_FILTER];
  }
}

export function saveMangaLangFilter(langs: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(langs));
  } catch {
    return;
  }
  for (const cb of listeners) cb();
}

export function subscribeMangaLangFilter(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function langFilterMatches(filter: string[], lang?: string): boolean {
  if (filter.includes(ALL_LANGS)) return true;
  return !!lang && filter.includes(lang);
}

const sourcesCache = new Map<string, SuwayomiSource[]>();

export function cachedSuwayomiSources(config: ServerConfig): Promise<SuwayomiSource[]> {
  const hit = sourcesCache.get(config.baseUrl);
  if (hit) return Promise.resolve(hit);
  return listSources(config).then((list) => {
    sourcesCache.set(config.baseUrl, list);
    return list;
  });
}

export function invalidateSuwayomiSources(baseUrl: string): void {
  sourcesCache.delete(baseUrl);
}
