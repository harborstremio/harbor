import { registerEvictable } from "@/lib/maintenance";
import { safeFetch } from "@/lib/safe-fetch";
import type { FavoriteMedia, FavoriteSearchResult } from "./favorites-types";

export type ArtistSource = "deezer";

export type ShowcaseArtist = {
  id: string;
  name: string;
  image: string | null;
  images: string[];
  url: string | null;
  followers: number | null;
  albumCount: number | null;
  source: ArtistSource;
};

export type ArtistSearchResult =
  | { kind: "ok"; items: ShowcaseArtist[]; source: ArtistSource; degraded: boolean }
  | { kind: "empty"; query: string }
  | { kind: "needs-key"; message: string }
  | { kind: "failed"; message: string };

export type ArtistSearchOptions = {
  signal?: AbortSignal;
  limit?: number;
};

const DEEZER_SEARCH = "https://api.deezer.com/search/artist";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 80;
const DEFAULT_LIMIT = 24;
const REQUEST_TIMEOUT_MS = 12000;

const BLANK_PICTURE = "d41d8cd98f00b204e9800998ecf8427e";

const cache = new Map<string, { v: ArtistSearchResult; t: number }>();
const inflight = new Map<string, Promise<ArtistSearchResult>>();

registerEvictable("artists-search", (aggressive) => {
  if (aggressive) return cache.clear();
  const now = Date.now();
  for (const [k, e] of cache) if (now - e.t > TTL_MS) cache.delete(k);
});

function trim() {
  if (cache.size <= MAX_ENTRIES) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].t - b[1].t);
  for (const [k] of oldest.slice(0, cache.size - MAX_ENTRIES)) cache.delete(k);
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => ac.abort();
  if (signal?.aborted) ac.abort();
  signal?.addEventListener("abort", onAbort);
  return {
    signal: ac.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

type DeezerArtist = {
  id?: number;
  name?: string;
  link?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  nb_album?: number;
  nb_fan?: number;
};

type DeezerResponse = {
  data?: DeezerArtist[];
  error?: { type?: string; message?: string; code?: number };
};

function count(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

function pictures(a: DeezerArtist): string[] {
  const urls = [a.picture_big, a.picture_medium, a.picture_xl];
  return urls.filter((u): u is string => typeof u === "string" && !u.includes(BLANK_PICTURE));
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function relevance(name: string, query: string): number {
  const n = fold(name);
  const q = fold(query);
  if (n === q) return 3;
  if (n.startsWith(q)) return 2;
  if (n.includes(q)) return 1;
  return 0;
}

function rank(items: ShowcaseArtist[], query: string): ShowcaseArtist[] {
  return [...items].sort((a, b) => {
    const diff = relevance(b.name, query) - relevance(a.name, query);
    if (diff !== 0) return diff;
    return (b.followers ?? 0) - (a.followers ?? 0);
  });
}

function normalise(a: DeezerArtist): ShowcaseArtist | null {
  if (!a.id || !a.name) return null;
  const images = pictures(a);
  if (!images.length) return null;
  const albumCount = count(a.nb_album);
  return {
    id: `deezer:${a.id}`,
    name: a.name,
    image: images[0] ?? null,
    images,
    url: a.link ?? `https://www.deezer.com/artist/${a.id}`,
    followers: count(a.nb_fan),
    albumCount,
    source: "deezer",
  };
}

async function run(
  query: string,
  opts: ArtistSearchOptions,
  limit: number,
): Promise<ArtistSearchResult> {
  const { signal, done } = withTimeout(opts.signal);
  try {
    const url = `${DEEZER_SEARCH}?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await safeFetch(url, { signal });
    if (!res.ok) return { kind: "failed", message: `Deezer returned ${res.status}.` };

    const json = (await res.json()) as DeezerResponse;
    if (json.error) {
      const detail = json.error.message ?? json.error.type ?? "unknown error";
      if (json.error.code === 4 || /quota/i.test(detail)) {
        return { kind: "failed", message: "Deezer is rate limiting Harbor. Try again shortly." };
      }
      return { kind: "failed", message: `Deezer refused the search: ${detail}` };
    }
    if (!Array.isArray(json.data)) {
      return { kind: "failed", message: "Deezer sent an unexpected response." };
    }

    const items = json.data.map(normalise).filter((a): a is ShowcaseArtist => a !== null);
    if (!items.length) return { kind: "empty", query };
    return { kind: "ok", items: rank(items, query), source: "deezer", degraded: false };
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    return { kind: "failed", message: "Couldn't reach Deezer." };
  } finally {
    done();
  }
}

function toFavorite(a: ShowcaseArtist): FavoriteMedia {
  return {
    kind: "music",
    id: a.id,
    name: a.name,
    image: a.image,
    sub: null,
    url: a.url,
    source: a.source,
  };
}

function toFavoriteResult(r: ArtistSearchResult): FavoriteSearchResult {
  if (r.kind === "ok") return { status: "ok", items: r.items.map(toFavorite) };
  if (r.kind === "empty") return { status: "empty" };
  if (r.kind === "needs-key") return { status: "needs-key" };
  return { status: "failed", reason: r.message };
}

async function searchArtistsRaw(
  query: string,
  opts: ArtistSearchOptions = {},
): Promise<ArtistSearchResult> {
  const q = query.trim();
  if (q.length < 2) return { kind: "empty", query: q };
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const key = `${limit}:${q.toLowerCase()}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = run(q, opts, limit)
    .then((r) => {
      if (r.kind === "ok" || r.kind === "empty") {
        cache.set(key, { v: r, t: Date.now() });
        trim();
      }
      return r;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

export async function searchArtists(
  query: string,
  opts: ArtistSearchOptions = {},
): Promise<FavoriteSearchResult> {
  return toFavoriteResult(await searchArtistsRaw(query, opts));
}

export function artistImageAtSize(artist: ShowcaseArtist, size: 250 | 500 | 1000): string | null {
  if (!artist.image) return null;
  return artist.image.replace(/\/\d+x\d+-/, `/${size}x${size}-`);
}

export function clearArtistSearchCache(): void {
  cache.clear();
}
