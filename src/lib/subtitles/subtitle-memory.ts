const STORAGE_KEY = "harbor.subtitle.memory.v1";
const MAX_ENTRIES = 500;

export type SubtitleFormat = "srt" | "vtt" | "ass" | "ssa" | "sub";

export type RememberedSub = {
  off?: boolean;
  source?: string;
  lang?: string;
  title?: string;
  subId?: string;
  provider?: string;
  release?: string;
  format?: SubtitleFormat;
  encoding?: string;
  matchScore?: number;
  imported?: boolean;
  updatedAt: number;
};

export type SubChoiceInput = {
  lang?: string | null;
  url?: string;
  title?: string;
  external?: boolean;
  externalFilename?: string;
  subId?: string;
  provider?: string;
  release?: string;
  format?: SubtitleFormat;
  encoding?: string;
  matchScore?: number;
  imported?: boolean;
  source?: string;
};

type Store = Record<string, RememberedSub>;
let cache: Store | null = null;

export function subtitleMediaKey(
  metaId: string | null | undefined,
  season?: number | null,
  episode?: number | null,
): string {
  return `${metaId ?? ""}|${season ?? ""}|${episode ?? ""}`;
}

function loadStore(): Store {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persistStore(): void {
  if (!cache) return;
  const entries = Object.entries(cache);
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    cache = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    
  }
}

export function readRememberedSub(key: string): RememberedSub | null {
  if (!key) return null;
  return loadStore()[key] ?? null;
}

export function writeRememberedSub(
  key: string,
  sub: Omit<RememberedSub, "updatedAt">,
): void {
  if (!key) return;
  const store = loadStore();
  store[key] = { ...sub, updatedAt: Date.now() };
  persistStore();
}

export function clearRememberedSub(key: string): void {
  if (!key) return;
  const store = loadStore();
  if (!(key in store)) return;
  delete store[key];
  persistStore();
}


export function rememberedFromChoice(
  choice: SubChoiceInput,
): Omit<RememberedSub, "updatedAt"> {
  const resolvedSource =
    choice.source ??
    (choice.url ? lookupSubtitleOrigin(choice.url) ?? choice.url : undefined) ??
    (choice.externalFilename
      ? lookupSubtitleOrigin(choice.externalFilename) ?? choice.externalFilename
      : undefined);
  const source = choice.external || choice.imported ? resolvedSource : undefined;
  return {
    source,
    lang: choice.lang ?? undefined,
    title: choice.title,
    subId: choice.subId,
    provider: choice.provider,
    release: choice.release,
    format: choice.format,
    encoding: choice.encoding,
    matchScore: choice.matchScore,
    imported: choice.imported === true || undefined,
  };
}

const originByResolvedUrl = new Map<string, string>();

export function noteSubtitleOrigin(
  resolvedUrl: string,
  originalSource: string,
): void {
  if (!resolvedUrl || !originalSource) return;
  originByResolvedUrl.set(resolvedUrl, originalSource);
}

export function lookupSubtitleOrigin(resolvedUrl: string): string | undefined {
  if (!resolvedUrl) return undefined;
  return originByResolvedUrl.get(resolvedUrl);
}
