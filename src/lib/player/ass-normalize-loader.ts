import { computeAssBaseFactor } from "./ass-header.ts";

export type AssNormalizeTrack = {
  id: string;
  external?: boolean;
  url?: string;
  externalFilename?: string;
};

export type AssLoadRequest = {
  sourceUrl: string;
  track: AssNormalizeTrack;
  tracks: AssNormalizeTrack[];
  headers?: Record<string, string>;
};

export type AssLoaderDeps = {
  loadExternal: (url: string, signal: AbortSignal) => Promise<string | null>;
  loadEmbedded: (
    sourceUrl: string,
    streamIndex: number,
    headers: Record<string, string> | undefined,
  ) => Promise<string | null>;
};

const factorCache = new Map<string, number | null>();

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function cacheKey(request: AssLoadRequest): string {
  const externalUrl = request.track.url ?? request.track.externalFilename ?? "";
  return [
    request.sourceUrl,
    request.track.id,
    request.track.external === true || request.track.url ? "external" : "embedded",
    externalUrl,
  ].join("|");
}

function embeddedStreamIndex(tracks: AssNormalizeTrack[], trackId: string): number {
  const index = tracks
    .filter((track) => !track.external && !track.url)
    .findIndex((track) => track.id === trackId);
  return index >= 0 ? index : 0;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function loadAssBaseFactor(
  request: AssLoadRequest,
  deps: AssLoaderDeps,
  signal: AbortSignal,
): Promise<number | null> {
  throwIfAborted(signal);
  const key = cacheKey(request);
  if (factorCache.has(key)) return factorCache.get(key) ?? null;

  try {
    const external = request.track.external === true || !!request.track.url;
    const text = external
      ? await loadExternalTrack(request.track, deps, signal)
      : await deps.loadEmbedded(
          request.sourceUrl,
          embeddedStreamIndex(request.tracks, request.track.id),
          request.headers,
        );
    throwIfAborted(signal);
    const factor = text ? computeAssBaseFactor(text) : null;
    factorCache.set(key, factor);
    return factor;
  } catch (error) {
    if (signal.aborted || isAbort(error)) throw abortError();
    factorCache.set(key, null);
    return null;
  }
}

async function loadExternalTrack(
  track: AssNormalizeTrack,
  deps: AssLoaderDeps,
  signal: AbortSignal,
): Promise<string | null> {
  const url = track.url ?? track.externalFilename;
  if (!url) return null;
  return deps.loadExternal(url, signal);
}

export function clearAssNormalizeCache(): void {
  factorCache.clear();
}
