import { filterChannelsForDisplay } from "./divider-filter";
import { loadFromShape } from "./ingest/load";
import { detectProviderShape } from "./ingest/detect";
import {
  deleteIptvCache,
  iptvSourceSignature,
  isPersistentCacheFresh,
  readIptvCache,
  writeIptvCache,
} from "./persistent-cache";
import type { IptvChannel, IptvPlaylist, IptvPlaylistSource } from "./types";
import { clearSeriesInfoCache } from "./xtream-vod";

const cache = new Map<string, IptvPlaylist>();
const inflight = new Map<string, Promise<IptvPlaylist>>();
const restoring = new Map<string, Promise<IptvPlaylist | null>>();
const listeners = new Set<() => void>();
const vodHydrated = new Set<string>();

let notifyScheduled = false;
function notify() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    listeners.forEach((l) => l());
  });
}

export function subscribePlaylists(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getCachedPlaylist(id: string): IptvPlaylist | null {
  return cache.get(id) ?? null;
}

export function clearPlaylistCache(id?: string) {
  if (id) {
    cache.delete(id);
    restoring.delete(id);
    vodHydrated.delete(id);
    inflight.delete(id);
    clearSeriesInfoCache(id);
    void deleteIptvCache("playlist", id);
  } else {
    cache.clear();
    restoring.clear();
    vodHydrated.clear();
    inflight.clear();
    clearSeriesInfoCache();
  }
  notify();
}

export async function loadPlaylist(
  src: IptvPlaylistSource,
  opts?: { force?: boolean },
): Promise<IptvPlaylist> {
  if (opts?.force) return fetchPlaylist(src, true);

  const existing = cache.get(src.id) ?? (await restorePlaylist(src));
  if (existing) {
    if (!isPersistentCacheFresh(existing.fetchedAt)) {
      void fetchPlaylist(src).catch(() => {});
    }
    return existing;
  }
  return fetchPlaylist(src);
}

async function restorePlaylist(src: IptvPlaylistSource): Promise<IptvPlaylist | null> {
  const existing = cache.get(src.id);
  if (existing) return existing;
  const pending = restoring.get(src.id);
  if (pending) return pending;

  const promise = readIptvCache<IptvPlaylist>("playlist", src.id)
    .then((entry) => {
      if (!entry) return null;
      if (entry.sourceSignature !== iptvSourceSignature(src) || !isPlaylist(entry.value)) {
        void deleteIptvCache("playlist", src.id);
        return null;
      }
      cache.set(src.id, entry.value);
      notify();
      return entry.value;
    })
    .finally(() => {
      if (restoring.get(src.id) === promise) restoring.delete(src.id);
    });
  restoring.set(src.id, promise);
  return promise;
}

function fetchPlaylist(src: IptvPlaylistSource, force = false): Promise<IptvPlaylist> {
  const pending = inflight.get(src.id);
  if (pending && !force) return pending;
  const promise = loadFromShape(src, detectProviderShape(src));
  inflight.set(src.id, promise);
  return promise
    .then((result) => {
      if (inflight.get(src.id) === promise) {
        cache.set(src.id, result);
        notify();
        void writeIptvCache("playlist", src.id, {
          sourceSignature: iptvSourceSignature(src),
          savedAt: result.fetchedAt,
          value: result,
        });
      }
      return result;
    })
    .finally(() => {
      if (inflight.get(src.id) === promise) inflight.delete(src.id);
    });
}

function isPlaylist(value: unknown): value is IptvPlaylist {
  if (!value || typeof value !== "object") return false;
  const playlist = value as Partial<IptvPlaylist>;
  return (
    typeof playlist.id === "string" &&
    Array.isArray(playlist.channels) &&
    Array.isArray(playlist.groups) &&
    typeof playlist.fetchedAt === "number"
  );
}

export function markVodHydrated(id: string): boolean {
  if (vodHydrated.has(id)) return false;
  vodHydrated.add(id);
  return true;
}

export function unmarkVodHydrated(id: string): void {
  vodHydrated.delete(id);
}

export function commitHydratedPlaylist(src: IptvPlaylistSource, channels: IptvChannel[]): void {
  if (!cache.has(src.id)) return;
  cache.set(src.id, shapePlaylist(src, channels));
  notify();
}

const CONNECT_TIMEOUT_S = 30;
const PARSE_LIMIT_BYTES = 80 * 1024 * 1024;

export async function fetchM3uText(url: string): Promise<string> {
  let res: Response;
  try {
    res = await iptvFetch(url);
  } catch (e) {
    throw new Error(networkErrorMessage(e));
  }
  if (!res.ok) {
    throw new Error(httpErrorMessage(res.status, res.statusText));
  }
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    throw new Error(`Failed reading playlist body: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!text) {
    throw new Error("Playlist server returned an empty body");
  }
  if (text.length > PARSE_LIMIT_BYTES) {
    throw new Error(
      `Playlist is too large (${(text.length / 1024 / 1024).toFixed(1)} MB). 80 MB limit.`,
    );
  }
  return text;
}

async function iptvFetch(url: string): Promise<Response> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    try {
      return await tauriFetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
          Accept: "audio/x-mpegurl, application/x-mpegURL, application/octet-stream, */*",
        },
        connectTimeout: CONNECT_TIMEOUT_S * 1000,
        maxRedirections: 5,
      } as unknown as RequestInit);
    } catch (e) {
      if (!/scope|not allowed/i.test(String(e))) throw e;
      const { safeFetch } = await import("@/lib/safe-fetch");
      return safeFetch(url, {
        headers: {
          "User-Agent": "VLC/3.0.20 LibVLC/3.0.20",
          Accept: "audio/x-mpegurl, application/x-mpegURL, application/octet-stream, */*",
        },
      });
    }
  }
  return fetch(url, { cache: "no-store" });
}

function httpErrorMessage(status: number, statusText: string): string {
  if (status === 401) {
    return "HTTP 401: bad username or password. Check the URL credentials with your provider.";
  }
  if (status === 403) {
    return "HTTP 403: your IP or device is blocked from this playlist. Some providers geo-restrict or device-limit accounts.";
  }
  if (status === 404) {
    return "HTTP 404: playlist URL not found on this server. Check the URL for typos.";
  }
  if (status === 429) {
    return "HTTP 429: provider is rate-limiting your account. Wait a minute and try again.";
  }
  if (status === 503) {
    return "HTTP 503: provider is refusing service right now. Most common cause: account is at its max-connections limit (other devices/players still logged in). Close other sessions, or contact your provider if the credentials are valid.";
  }
  return `HTTP ${status} ${statusText}`;
}

function networkErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const lower = raw.toLowerCase();
  if (lower.includes("cancel") || lower.includes("abort")) {
    return `Server did not respond (gave up after ${CONNECT_TIMEOUT_S}s). The provider may be rate-limiting your IP or down.`;
  }
  if (lower.includes("dns") || lower.includes("resolve")) {
    return `Could not resolve playlist hostname. Check the URL for typos.`;
  }
  if (lower.includes("connection refused") || lower.includes("refused")) {
    return `Playlist server refused the connection.`;
  }
  if (lower.includes("reset")) {
    return `Playlist server reset the connection. Some providers reject generic clients; try with their official app to confirm credentials work.`;
  }
  return `Network error: ${raw}`;
}

export function shapePlaylist(src: IptvPlaylistSource, channels: IptvChannel[]): IptvPlaylist {
  const cleaned = filterChannelsForDisplay(channels);
  return {
    id: src.id,
    name: src.name,
    url: src.url,
    epgUrl: src.epgUrl ?? null,
    channels: cleaned,
    fetchedAt: Date.now(),
    groups: uniqueGroups(cleaned),
  };
}

function uniqueGroups(channels: { group: string | null }[]): string[] {
  const set = new Set<string>();
  for (const c of channels) {
    if (c.group) set.add(c.group);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
