import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { registerEvictable } from "@/lib/maintenance";
import { traktRequest } from "@/lib/trakt/client";

export type RelatedKind = "movie" | "show";

type RelatedImages = {
  poster?: string[];
  fanart?: string[];
};

type RelatedRow = {
  title?: string;
  year?: number | null;
  overview?: string | null;
  runtime?: number | null;
  genres?: string[];
  rating?: number | null;
  ids?: { imdb?: string; tmdb?: number };
  images?: RelatedImages;
};

const LIMIT = 20;
const TTL = 6 * 60 * 60 * 1000;
const EMPTY_TTL = 10 * 60 * 1000;

const NO_RELATED: Meta[] = [];

const cache = new Map<string, { metas: Meta[]; t: number }>();
const inflight = new Map<string, Promise<Meta[]>>();

registerEvictable("trakt-related", (aggressive) => {
  if (aggressive) return cache.clear();
  const now = Date.now();
  for (const [k, e] of cache) if (now - e.t > TTL) cache.delete(k);
});

function firstImage(list: string[] | undefined): string | undefined {
  const raw = list?.[0];
  if (!raw) return undefined;
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

function toMeta(row: RelatedRow, kind: RelatedKind): Meta | null {
  const imdb = row.ids?.imdb;
  const name = row.title?.trim();
  if (!imdb || !imdb.startsWith("tt") || !name) return null;
  const rating =
    typeof row.rating === "number" && row.rating > 0 ? row.rating.toFixed(1) : undefined;
  return {
    id: imdb,
    type: kind === "show" ? "series" : "movie",
    name,
    poster: firstImage(row.images?.poster),
    background: firstImage(row.images?.fanart),
    description: row.overview ?? undefined,
    releaseInfo: row.year ? String(row.year) : undefined,
    imdbRating: rating,
    genres: row.genres && row.genres.length > 0 ? row.genres : undefined,
    runtime: row.runtime ? `${row.runtime} min` : undefined,
  };
}

function cachedRelated(kind: RelatedKind, imdbId: string): Meta[] | undefined {
  const hit = cache.get(`${kind}:${imdbId}`);
  if (!hit) return undefined;
  const ttl = hit.metas.length > 0 ? TTL : EMPTY_TTL;
  return Date.now() - hit.t < ttl ? hit.metas : undefined;
}

export async function traktRelated(kind: RelatedKind, imdbId: string): Promise<Meta[]> {
  if (!imdbId.startsWith("tt")) return [];
  const key = `${kind}:${imdbId}`;
  const hit = cachedRelated(kind, imdbId);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    try {
      const path = kind === "show" ? "shows" : "movies";
      const rows = await traktRequest<RelatedRow[]>(
        `/${path}/${imdbId}/related?extended=full&limit=${LIMIT}`,
        { authed: false },
      );
      const seen = new Set<string>([imdbId]);
      const metas: Meta[] = [];
      for (const row of Array.isArray(rows) ? rows : []) {
        const m = toMeta(row, kind);
        if (!m || seen.has(m.id)) continue;
        seen.add(m.id);
        metas.push(m);
      }
      cache.set(key, { metas, t: Date.now() });
      return metas;
    } catch {
      return [];
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function useTraktRelated(imdbId: string | null, kind: RelatedKind): Meta[] {
  const [metas, setMetas] = useState<Meta[]>(NO_RELATED);
  useEffect(() => {
    if (!imdbId || !imdbId.startsWith("tt")) {
      setMetas(NO_RELATED);
      return;
    }
    let cancelled = false;
    setMetas(cachedRelated(kind, imdbId) ?? NO_RELATED);
    traktRelated(kind, imdbId)
      .then((rows) => {
        if (!cancelled) setMetas(rows.length > 0 ? rows : NO_RELATED);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [imdbId, kind]);
  return metas;
}
