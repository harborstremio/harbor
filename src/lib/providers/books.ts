import { registerEvictable } from "@/lib/maintenance";
import { safeFetch } from "@/lib/safe-fetch";
import type { FavoriteMedia, FavoriteSearchResult } from "./favorites-types";

export type BookSearchOptions = {
  signal?: AbortSignal;
  limit?: number;
};

const OPENLIBRARY_SEARCH = "https://openlibrary.org/search.json";
const COVER_BASE = "https://covers.openlibrary.org/b";
const FIELDS = "key,title,author_name,first_publish_year,cover_i,cover_edition_key";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 80;
const DEFAULT_LIMIT = 24;
const REQUEST_TIMEOUT_MS = 12000;

const cache = new Map<string, { v: FavoriteSearchResult; t: number }>();
const inflight = new Map<string, Promise<FavoriteSearchResult>>();

registerEvictable("books-search", (aggressive) => {
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

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  cover_edition_key?: string;
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
};

function coverUrl(doc: OpenLibraryDoc): string | null {
  if (typeof doc.cover_i === "number" && Number.isFinite(doc.cover_i)) {
    return `${COVER_BASE}/id/${doc.cover_i}-L.jpg?default=false`;
  }
  if (typeof doc.cover_edition_key === "string" && doc.cover_edition_key) {
    return `${COVER_BASE}/olid/${doc.cover_edition_key}-L.jpg?default=false`;
  }
  return null;
}

function normalise(doc: OpenLibraryDoc): FavoriteMedia | null {
  const key = typeof doc.key === "string" ? doc.key : "";
  const workId = key.replace(/^\/works\//, "");
  if (!workId || !doc.title) return null;
  const image = coverUrl(doc);
  if (!image) return null;
  const author = Array.isArray(doc.author_name) ? doc.author_name[0] : undefined;
  return {
    kind: "book",
    id: `openlibrary:${workId}`,
    name: doc.title,
    image,
    sub: author ?? null,
    url: `https://openlibrary.org${key}`,
    source: "openlibrary",
  };
}

async function run(
  query: string,
  opts: BookSearchOptions,
  limit: number,
): Promise<FavoriteSearchResult> {
  const { signal, done } = withTimeout(opts.signal);
  try {
    const url = `${OPENLIBRARY_SEARCH}?q=${encodeURIComponent(query)}&fields=${FIELDS}&limit=${limit}`;
    const res = await safeFetch(url, { signal });
    if (!res.ok) return { status: "failed", reason: `Open Library returned ${res.status}.` };
    const json = (await res.json()) as OpenLibraryResponse;
    if (!Array.isArray(json.docs)) {
      return { status: "failed", reason: "Open Library sent an unexpected response." };
    }
    const items = json.docs.map(normalise).filter((b): b is FavoriteMedia => b !== null);
    if (!items.length) return { status: "empty" };
    return { status: "ok", items };
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    return { status: "failed", reason: "Couldn't reach Open Library." };
  } finally {
    done();
  }
}

export async function searchBooks(
  query: string,
  opts: BookSearchOptions = {},
): Promise<FavoriteSearchResult> {
  const q = query.trim();
  if (q.length < 2) return { status: "empty" };
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const key = `${limit}:${q.toLowerCase()}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = run(q, opts, limit)
    .then((r) => {
      if (r.status === "ok" || r.status === "empty") {
        cache.set(key, { v: r, t: Date.now() });
        trim();
      }
      return r;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

export function clearBookSearchCache(): void {
  cache.clear();
}
