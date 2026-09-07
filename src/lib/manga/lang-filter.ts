/** Sentinel meaning "no language restriction". */
export const ALL_LANGS = "*";

const STORAGE_KEY = "harbor.manga.langfilter.v1";

let revision = 0;
const listeners = new Set<() => void>();

export function mangaLangFilterRevision(): number {
  return revision;
}

function storageKey(serverBase?: string): string {
  if (!serverBase) return STORAGE_KEY;
  return `${STORAGE_KEY}:${serverBase}`;
}

/** Fresh servers default to "All languages". */
const NEW_SERVER_DEFAULT: string[] = [ALL_LANGS];

export function loadMangaLangFilter(serverBase?: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(serverBase));
    if (!raw) return [...NEW_SERVER_DEFAULT];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...NEW_SERVER_DEFAULT];
    const langs = arr.filter((v): v is string => typeof v === "string" && v.trim() !== "");
    return langs.length > 0 ? langs : [ALL_LANGS];
  } catch {
    return [...NEW_SERVER_DEFAULT];
  }
}

export function saveMangaLangFilter(langs: string[], serverBase?: string): void {
  try {
    localStorage.setItem(storageKey(serverBase), JSON.stringify(langs));
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
