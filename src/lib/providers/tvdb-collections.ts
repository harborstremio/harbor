import { safeFetch } from "@/lib/safe-fetch";
import type { Meta } from "@/lib/cinemeta";
import { HARBOR_TVDB_BASE } from "@/lib/config/endpoints";

const V4 = `${HARBOR_TVDB_BASE}/api/tvdb/v4`;

export type TvdbCollectionHit = {
  id: number;
  name: string;
  image: string | null;
  overview: string | null;
};

export type TvdbCollectionEntry = { kind: "movie" | "series"; tvdbId: number };

export type TvdbCollection = {
  id: number;
  name: string;
  overview: string | null;
  image: string | null;
  entries: TvdbCollectionEntry[];
};

export type TvdbEntityCard = {
  kind: "movie" | "series";
  tvdbId: number;
  name: string;
  year: string | null;
  poster: string | null;
  imdb: string | null;
};

function img(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.startsWith("http")
    ? v
    : `https://artworks.thetvdb.com${v.startsWith("/") ? "" : "/"}${v}`;
}

async function v4<T>(rel: string): Promise<T | null> {
  try {
    const res = await safeFetch(`${V4}${rel}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { data?: T | null };
    return j?.data ?? null;
  } catch {
    return null;
  }
}

const searchCache = new Map<string, TvdbCollectionHit[]>();
const searchInflight = new Map<string, Promise<TvdbCollectionHit[]>>();

export function searchTvdbCollections(query: string): Promise<TvdbCollectionHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return Promise.resolve([]);
  const hit = searchCache.get(q);
  if (hit) return Promise.resolve(hit);
  const pending = searchInflight.get(q);
  if (pending) return pending;
  const p = (async () => {
    const data = await v4<
      Array<{ tvdb_id?: string; name?: string; image_url?: string; overview?: string }>
    >(`/search?query=${encodeURIComponent(q)}&type=list&limit=10`);
    const out: TvdbCollectionHit[] = [];
    for (const row of data ?? []) {
      const id = Number(row.tvdb_id);
      if (!Number.isFinite(id) || !row.name) continue;
      out.push({ id, name: row.name, image: img(row.image_url), overview: row.overview ?? null });
      if (out.length >= 6) break;
    }
    searchCache.set(q, out);
    return out;
  })().finally(() => {
    searchInflight.delete(q);
  });
  searchInflight.set(q, p);
  return p;
}

const collCache = new Map<number, TvdbCollection | null>();
const collInflight = new Map<number, Promise<TvdbCollection | null>>();

export function fetchTvdbCollection(id: number): Promise<TvdbCollection | null> {
  if (collCache.has(id)) return Promise.resolve(collCache.get(id) ?? null);
  const pending = collInflight.get(id);
  if (pending) return pending;
  const p = (async () => {
    const data = await v4<{
      id?: number;
      name?: string;
      overview?: string;
      image?: string | null;
      entities?: Array<{
        movieId?: number | null;
        seriesId?: number | null;
        order?: number | null;
      }>;
    }>(`/lists/${id}/extended`);
    if (!data?.name) {
      collCache.set(id, null);
      return null;
    }
    const entries: TvdbCollectionEntry[] = [];
    const sorted = (data.entities ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    for (const e of sorted) {
      if (e.movieId) entries.push({ kind: "movie", tvdbId: e.movieId });
      else if (e.seriesId) entries.push({ kind: "series", tvdbId: e.seriesId });
      if (entries.length >= 40) break;
    }
    const out: TvdbCollection = {
      id: data.id ?? id,
      name: data.name,
      overview: data.overview ?? null,
      image: img(data.image),
      entries,
    };
    collCache.set(id, out);
    return out;
  })().finally(() => {
    collInflight.delete(id);
  });
  collInflight.set(id, p);
  return p;
}

const entityCache = new Map<string, TvdbEntityCard | null>();
const entityInflight = new Map<string, Promise<TvdbEntityCard | null>>();

export function fetchTvdbEntity(
  kind: "movie" | "series",
  tvdbId: number,
): Promise<TvdbEntityCard | null> {
  const key = `${kind}:${tvdbId}`;
  if (entityCache.has(key)) return Promise.resolve(entityCache.get(key) ?? null);
  const pending = entityInflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const data = await v4<{
      name?: string;
      image?: string | null;
      year?: string | number | null;
      remoteIds?: Array<{ id?: string | null }>;
    }>(`/${kind === "movie" ? "movies" : "series"}/${tvdbId}/extended`);
    if (!data?.name) {
      entityCache.set(key, null);
      return null;
    }
    const imdb = data.remoteIds?.map((r) => r.id ?? "").find((v) => /^tt\d+$/.test(v)) ?? null;
    const out: TvdbEntityCard = {
      kind,
      tvdbId,
      name: data.name,
      year: data.year != null ? String(data.year) : null,
      poster: img(data.image),
      imdb,
    };
    entityCache.set(key, out);
    return out;
  })().finally(() => {
    entityInflight.delete(key);
  });
  entityInflight.set(key, p);
  return p;
}

export function entityToMeta(e: TvdbEntityCard): Meta {
  return {
    id: e.imdb ?? `tvdb:${e.kind}:${e.tvdbId}`,
    type: e.kind === "movie" ? "movie" : "series",
    name: e.name,
    poster: e.poster ?? undefined,
    releaseInfo: e.year ?? undefined,
  } as Meta;
}
