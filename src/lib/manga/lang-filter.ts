/** Sentinel meaning "no language restriction". */
export const ALL_LANGS = "*";

const STORAGE_KEY = "harbor.manga.langfilter.v1";
const DEFAULT_FILTER: string[] = ["en"];

let revision = 0;
const listeners = new Set<() => void>();

export function mangaLangFilterRevision(): number {
  return revision;
}

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
  revision++;
  for (const cb of listeners) cb();
}

export function subscribeMangaLangFilter(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const AGNOSTIC_LANGS = new Set(["multi", "all"]);

export function isAgnosticLang(lang?: string): boolean {
  return !!lang && AGNOSTIC_LANGS.has(lang.toLowerCase());
}

export function langFilterMatches(filter: string[], lang?: string): boolean {
  if (filter.includes(ALL_LANGS)) return true;
  if (!lang) return false;
  const normalized = lang.toLowerCase();
  if (AGNOSTIC_LANGS.has(normalized)) return true;
  return filter.some((f) => f.toLowerCase() === normalized);
}
