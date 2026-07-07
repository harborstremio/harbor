import type { DebridSlug } from "@/lib/streams/types";
import type { EpisodeHint } from "@/lib/streams/episode-file";

export type { DebridSlug };

export type DebridResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; status: number; raw?: unknown };

export type Account = {
  slug: DebridSlug;
  username?: string;
  email?: string;
  premium: boolean;
  premiumUntil?: number;
  trafficUsed?: number;
  trafficLimit?: number;
};

export type CacheMap = Record<string, boolean>;

export type DirectLink = {
  url: string;
  fileIdx?: number | null;
  filename?: string;
  filesize?: number;
  headers?: Record<string, string>;
  notWebReady?: boolean;
  subtitles?: Array<{ url: string; lang?: string; id?: string }>;
};

export type DebridFile = {
  id: string;
  name: string;
  size: number;
  selected?: boolean;
  url?: string;
};

export type Transfer = {
  id: string;
  hash: string;
  name?: string;
  ready: boolean;
  files: DebridFile[];
};

export type LibraryFile = {
  id: string;
  name: string;
  size: number;
};

export type LibraryEntry = {
  slug: DebridSlug;
  id: string;
  hash: string;
  name: string;
  size?: number;
  files?: LibraryFile[];
};

export type DebridStore = {
  slug: DebridSlug;
  name: string;
  account(signal: AbortSignal): Promise<DebridResult<Account>>;
  cacheCheck(hashes: string[], signal: AbortSignal): Promise<DebridResult<CacheMap>>;
  playableUrl(
    magnet: string,
    fileIdx: number | undefined,
    signal: AbortSignal,
    hint?: EpisodeHint,
  ): Promise<DebridResult<DirectLink>>;
  queueCache?(magnet: string, signal: AbortSignal): Promise<DebridResult<{ id: string }>>;
  listLibrary(signal: AbortSignal): Promise<DebridResult<LibraryEntry[]>>;
  listTorrentFiles?(hash: string, signal: AbortSignal): Promise<DebridResult<DebridFile[]>>;
};

export function magnetFromHash(hash: string): string {
  if (hash.startsWith("magnet:")) return hash;
  return `magnet:?xt=urn:btih:${hash}`;
}

export function hashFromMagnet(input: string): string {
  if (!input.startsWith("magnet:")) return input.toLowerCase();
  const m = input.match(/xt=urn:btih:([A-Fa-f0-9]+)/);
  return m ? m[1].toLowerCase() : input.toLowerCase();
}
