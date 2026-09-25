import { invoke } from "@tauri-apps/api/core";

export type BridgeProvider = {
  id: string;
  extensionId: string;
  name: string;
  lang: string;
  mainUrl: string;
  types: string[];
  hasQuickSearch: boolean;
};

export type BridgeSearchItem = {
  name: string;
  url: string;
  type: string | null;
  posterUrl: string | null;
  quality: string | null;
};

export type BridgeEpisode = {
  data: string;
  name: string | null;
  season: number | null;
  episode: number | null;
  track: string;
};

export type BridgeMedia = {
  name: string;
  url: string;
  type: string;
  year: number | null;
  playableData: string | null;
  episodes: BridgeEpisode[];
};

export type BridgeLink = {
  source: string;
  name: string;
  url: string;
  referer: string;
  quality: number;
  type: string;
  headers: Record<string, string>;
};

export type BridgeSubtitle = { lang: string; url: string };

/** Why an empty answer was empty, when the addresses the provider uses refused during the call.
 * Absent means the service answered and the emptiness is not the network's doing. */
export type BridgeNote = string | null;

export type BridgeResults<T> = { items: T[]; note: BridgeNote };

export type BridgeLinkSet = {
  success: boolean;
  links: BridgeLink[];
  subtitles: BridgeSubtitle[];
  note: BridgeNote;
};

const PROVIDER_TTL_MS = 15_000;

let providerCache: { at: number; list: BridgeProvider[] } | null = null;
let providerInflight: Promise<BridgeProvider[]> | null = null;

export function extensionsSupported(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let warming: Promise<unknown> | null = null;

/** Brings the bridge up and restores its extensions, before anything starts counting.
 *
 * The first call into the bridge spawns its runtime and loads every installed extension, which is
 * measured in seconds, and every call after it is a millisecond. That is setup rather than a
 * plugin's work, so it is paid here instead of out of a plugin's deadline: charged to the plugin,
 * it left a slow one too little of its budget and made the first run report nothing while the
 * second answered. A failed warm is forgotten so the next caller tries again. */
export function warmBridge(): Promise<unknown> {
  warming ??= invoke("capstan_ping").catch(() => {
    warming = null;
    return null;
  });
  return warming;
}

function list<T>(value: unknown, key: string): T[] {
  if (!value || typeof value !== "object") return [];
  const raw = (value as Record<string, unknown>)[key];
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function note(value: unknown): BridgeNote {
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>).note;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function bridgeProviders(): Promise<BridgeProvider[]> {
  const hit = providerCache;
  if (hit && Date.now() - hit.at < PROVIDER_TTL_MS) return hit.list;
  if (providerInflight) return providerInflight;
  providerInflight = (async () => {
    const raw = await invoke("capstan_providers");
    const found = list<BridgeProvider>(raw, "providers");
    providerCache = { at: Date.now(), list: found };
    return found;
  })().finally(() => {
    providerInflight = null;
  });
  return providerInflight;
}

export function forgetBridgeProviders(): void {
  providerCache = null;
}

export async function bridgeSearch(
  providerId: string,
  query: string,
  quick: boolean,
): Promise<BridgeResults<BridgeSearchItem>> {
  const raw = await invoke("capstan_search", { providerId, query, quick });
  return { items: list<BridgeSearchItem>(raw, "results"), note: note(raw) };
}

export async function bridgeLoad(
  providerId: string,
  url: string,
): Promise<{ media: BridgeMedia | null; note: BridgeNote }> {
  const raw = await invoke("capstan_load", { providerId, url });
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const found = o.found === true && !!o.result && typeof o.result === "object";
  return { media: found ? (o.result as BridgeMedia) : null, note: note(raw) };
}

export async function bridgeLoadLinks(providerId: string, data: string): Promise<BridgeLinkSet> {
  const raw = await invoke("capstan_load_links", { providerId, data });
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    success: o.success === true,
    links: list<BridgeLink>(raw, "links"),
    subtitles: list<BridgeSubtitle>(raw, "subtitles"),
    note: note(raw),
  };
}
