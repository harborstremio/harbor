import { setItemWithRecovery } from "@/lib/storage-recovery";
import { GUTENDEX_BASE, GUTENDEX_NAME } from "./gutendex";

export type EBookHtmlSourceConfig = {
  name: string;
  baseUrl: string;
  iconUrl?: string;
  popularPath: string;
  searchPath: string;
  list: { item: string; title: string; link: string; cover?: string };
  detail?: {
    title?: string;
    cover?: string;
    description?: string;
    author?: string;
    status?: string;
  };
  chapters: {
    item: string;
    link: string;
    title?: string;
    chapter?: string;
    volume?: string;
    volumeTitle?: string;
    date?: string;
    views?: string;
  };
  content: { body: string };
  headers?: Record<string, string>;
};

export type EBookSource = {
  id: string;
  name: string;
  kind: "local" | "html" | "gutendex";
  location: string;
  iconUrl?: string;
  config?: EBookHtmlSourceConfig;
};

const KEY = "harbor.ebook.sources.v1";
const LEGACY_KEY = "harbor.novel.sources.v1";
const listeners = new Set<() => void>();

function read(): EBookSource[] {
  try {
    const stored = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? "[]";
    if (!localStorage.getItem(KEY) && stored !== "[]") localStorage.setItem(KEY, stored);
    const value = JSON.parse(stored) as unknown;
    return Array.isArray(value)
      ? value.filter(
          (source): source is EBookSource =>
            !!source &&
            typeof source === "object" &&
            typeof source.id === "string" &&
            typeof source.name === "string" &&
            typeof source.location === "string" &&
            (source.kind === "local" || source.kind === "html" || source.kind === "gutendex"),
        )
      : [];
  } catch {
    return [];
  }
}

function write(sources: EBookSource[]): boolean {
  const saved = setItemWithRecovery(KEY, JSON.stringify(sources));
  if (saved) for (const listener of listeners) listener();
  return saved;
}

function sourceId(kind: EBookSource["kind"], location: string): string {
  let hash = 2166136261;
  for (const char of location) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${kind}:${(hash >>> 0).toString(36)}`;
}

export function listEBookSources(): EBookSource[] {
  return read();
}

export function subscribeEBookSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addEBookFolder(path: string): boolean {
  const location = path.trim();
  if (!location) return false;
  const sources = read();
  if (sources.some((source) => source.kind === "local" && source.location === location))
    return true;
  const name = location.split(/[\\/]/).filter(Boolean).at(-1) || "Local eBooks";
  return write([...sources, { id: sourceId("local", location), name, kind: "local", location }]);
}

export function addEBookGutendex(): boolean {
  const sources = read();
  const id = sourceId("gutendex", GUTENDEX_BASE);
  if (sources.some((source) => source.id === id)) return true;
  return write([
    ...sources,
    { id, name: GUTENDEX_NAME, kind: "gutendex", location: GUTENDEX_BASE },
  ]);
}

export function hasEBookGutendex(): boolean {
  return read().some((source) => source.kind === "gutendex");
}

export function parseEBookSourceConfig(value: string): EBookHtmlSourceConfig {
  const parsed = JSON.parse(value) as Partial<EBookHtmlSourceConfig>;
  const required = [
    parsed.name,
    parsed.baseUrl,
    parsed.popularPath,
    parsed.searchPath,
    parsed.list?.item,
    parsed.list?.title,
    parsed.list?.link,
    parsed.chapters?.item,
    parsed.chapters?.link,
    parsed.content?.body,
  ];
  if (required.some((field) => typeof field !== "string" || !field.trim())) {
    throw new Error("The config is missing a required field.");
  }
  const url = new URL(parsed.baseUrl!);
  if (!/^https?:$/.test(url.protocol)) throw new Error("The source URL must use HTTP or HTTPS.");
  return { ...parsed, baseUrl: url.href.replace(/\/$/, "") } as EBookHtmlSourceConfig;
}

export function addEBookHtmlSource(config: EBookHtmlSourceConfig): boolean {
  const sources = read();
  const id = sourceId("html", config.baseUrl);
  const next: EBookSource = {
    id,
    name: config.name,
    kind: "html",
    location: config.baseUrl,
    iconUrl: config.iconUrl,
    config,
  };
  return write([...sources.filter((source) => source.id !== id), next]);
}

export function removeEBookSource(id: string): void {
  write(read().filter((source) => source.id !== id));
}
