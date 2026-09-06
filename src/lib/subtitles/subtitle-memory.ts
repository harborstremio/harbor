import type { SubtitleMatchConfidence } from "./release-match";
import type { SubtitleDownloadAuthKind } from "./provider-auth";
import type { SubtitleLoadMetadata } from "./types";
import type { PlayerStreamRef } from "@/lib/view";

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
  downloadAuthKind?: SubtitleDownloadAuthKind;
  providerDerived?: boolean;
  matchScore?: number;
  matchConfidence?: SubtitleMatchConfidence;
  streamKey?: string;
  imported?: boolean;
  updatedAt: number;
};

export type SubChoiceInput = {
  id?: string;
  lang?: string | null;
  url?: string;
  originalUrl?: string;
  title?: string;
  external?: boolean;
  externalFilename?: string;
  subId?: string;
  provider?: string;
  release?: string;
  format?: SubtitleFormat;
  encoding?: string;
  downloadAuth?: SubtitleLoadMetadata["downloadAuth"];
  providerDerived?: boolean;
  matchScore?: number;
  matchConfidence?: SubtitleMatchConfidence;
  streamKey?: string;
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

function stablePart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 180);
}

/**
 * Identifies the selected release without persisting signed playback URLs.
 * The same torrent through another debrid provider intentionally shares a key.
 */
export function subtitleStreamKey(
  streamRef: PlayerStreamRef | null | undefined,
): string | undefined {
  if (!streamRef) return undefined;
  const hash = stablePart(streamRef.infoHash);
  if (hash) return `torrent:${hash}:${streamRef.fileIdx ?? ""}`;
  const parts = [
    stablePart(streamRef.addonId),
    stablePart(streamRef.releaseGroup),
    stablePart(streamRef.parsedTitle ?? streamRef.title),
    stablePart(streamRef.source),
    stablePart(streamRef.resolution),
    streamRef.size && streamRef.size > 0 ? String(streamRef.size) : "",
  ];
  return parts.some(Boolean) ? `release:${parts.join("|")}` : undefined;
}

export function rememberedSubAppliesToStream(
  remembered: RememberedSub | null | undefined,
  streamRef: PlayerStreamRef | null | undefined,
): boolean {
  if (!remembered) return false;
  if (!remembered.source) return true;
  const currentStreamKey = subtitleStreamKey(streamRef);
  if (!currentStreamKey) return true;
  return remembered.streamKey === currentStreamKey;
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
  } catch {}
}

export function readRememberedSub(key: string): RememberedSub | null {
  if (!key) return null;
  return loadStore()[key] ?? null;
}

export function writeRememberedSub(
  key: string,
  sub: Omit<RememberedSub, "updatedAt">,
): RememberedSub | null {
  if (!key) return null;
  const store = loadStore();
  const remembered = { ...sub, updatedAt: Date.now() };
  store[key] = remembered;
  persistStore();
  return remembered;
}

export function clearRememberedSub(key: string): void {
  if (!key) return;
  const store = loadStore();
  if (!(key in store)) return;
  delete store[key];
  persistStore();
}

export function rememberedFromChoice(choice: SubChoiceInput): Omit<RememberedSub, "updatedAt"> {
  const resolvedSource =
    choice.source ??
    (choice.url ? (lookupSubtitleOrigin(choice.url) ?? choice.url) : undefined) ??
    (choice.externalFilename
      ? (lookupSubtitleOrigin(choice.externalFilename) ?? choice.externalFilename)
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
    downloadAuthKind: choice.downloadAuth?.kind,
    providerDerived: choice.providerDerived,
    matchScore: choice.matchScore,
    matchConfidence: choice.matchConfidence,
    streamKey: choice.streamKey,
    imported: choice.imported === true || undefined,
  };
}

export function rememberedChoiceFromLoad(
  url: string,
  lang?: string,
  title?: string,
  metadata?: SubtitleLoadMetadata,
): SubChoiceInput {
  const source = metadata?.originalUrl ?? url;
  return {
    lang,
    title,
    url: source,
    source,
    external: true,
    format: metadata?.format,
    encoding: metadata?.encoding,
    downloadAuth: metadata?.downloadAuth,
    providerDerived: metadata?.providerDerived,
    provider: metadata?.provider,
    release: metadata?.release,
    subId: metadata?.subId,
    matchScore: metadata?.matchScore,
    matchConfidence: metadata?.matchConfidence,
  };
}

export function rememberedSubtitleIsLocal(
  remembered: RememberedSub | null | undefined,
): remembered is RememberedSub & { source: string } {
  if (remembered?.imported !== true || !remembered.source) return false;
  return !/^(https?|blob|data):/i.test(remembered.source);
}

export function subtitleSourceIsLocal(source: string | null | undefined): boolean {
  return !!source && !/^(https?|blob|data):/i.test(source);
}

export function rememberedSubtitleLoadMetadata(
  remembered: RememberedSub,
  downloadAuth?: SubtitleLoadMetadata["downloadAuth"],
): SubtitleLoadMetadata {
  return {
    format: remembered.format,
    encoding: remembered.encoding,
    originalUrl: remembered.source,
    downloadAuth,
    release: remembered.release,
    provider: remembered.provider,
    providerDerived:
      remembered.providerDerived ??
      (rememberedSubtitleIsLocal(remembered) ? false : Boolean(remembered.provider)),
    subId: remembered.subId,
    matchScore: remembered.matchScore,
    matchConfidence: remembered.matchConfidence,
  };
}

const originByResolvedUrl = new Map<string, string>();

export function noteSubtitleOrigin(resolvedUrl: string, originalSource: string): void {
  if (!resolvedUrl || !originalSource) return;
  originByResolvedUrl.set(resolvedUrl, originalSource);
}

export function lookupSubtitleOrigin(resolvedUrl: string): string | undefined {
  if (!resolvedUrl) return undefined;
  return originByResolvedUrl.get(resolvedUrl);
}
