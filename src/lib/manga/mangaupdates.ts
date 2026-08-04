import { safeFetch } from "@/lib/safe-fetch";
import { setItemWithRecovery } from "@/lib/storage-recovery";
import { mangaThrottle } from "./types";

const BASE = "https://api.mangaupdates.com/v1";
const CACHE_KEY = "harbor.manga.mangaupdates.v1";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_CAP = 120;

export type MangaUpdatesAuthor = { name: string; role: string };
export type MangaUpdatesRelated = { id: number; title: string; relation?: string };

export type MangaUpdatesInfo = {
  seriesId: number;
  url: string;
  title: string;
  altTitles: string[];
  description?: string;
  image?: string;
  type?: string;
  year?: string;
  rating?: number;
  ratingVotes?: number;
  rankYear?: number;
  genres: string[];
  categories: string[];
  status?: string;
  completed?: boolean;
  licensed?: boolean;
  latestChapter?: number;
  authors: MangaUpdatesAuthor[];
  publishers: string[];
  animeStart?: string;
  animeEnd?: string;
  related: MangaUpdatesRelated[];
  recommendations: MangaUpdatesRelated[];
};

type RawSeries = {
  series_id?: number;
  title?: string;
  url?: string;
  associated?: Array<{ title?: string }>;
  description?: string;
  image?: { url?: { original?: string; thumb?: string } };
  type?: string;
  year?: string;
  bayesian_rating?: number;
  rating_votes?: number;
  rank?: { position?: { year?: number } };
  genres?: Array<{ genre?: string }>;
  categories?: Array<{ category?: string; votes?: number }>;
  status?: string;
  completed?: boolean;
  licensed?: boolean;
  latest_chapter?: number;
  authors?: Array<{ name?: string; type?: string }>;
  publishers?: Array<{ publisher_name?: string }>;
  anime?: { start?: string; end?: string };
  related_series?: Array<{
    related_series_id?: number;
    related_series_name?: string;
    relation_type?: string;
  }>;
  recommendations?: Array<{ series_id?: number; series_name?: string }>;
};

type SearchHit = { record?: RawSeries; hit_title?: string };

const gate = mangaThrottle(350);

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(s?: string): string | undefined {
  if (!s) return undefined;
  const out = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
  return out || undefined;
}

function toInfo(r: RawSeries): MangaUpdatesInfo | null {
  if (!r?.series_id || !r.title) return null;
  const cats = (r.categories ?? [])
    .filter((c) => c.category)
    .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
    .slice(0, 12)
    .map((c) => c.category as string);
  return {
    seriesId: r.series_id,
    url: r.url ?? "",
    title: r.title,
    altTitles: (r.associated ?? []).map((a) => a.title).filter((t): t is string => !!t),
    description: stripHtml(r.description),
    image: r.image?.url?.original ?? r.image?.url?.thumb,
    type: r.type ?? undefined,
    year: r.year ?? undefined,
    rating: typeof r.bayesian_rating === "number" ? r.bayesian_rating : undefined,
    ratingVotes: r.rating_votes ?? undefined,
    rankYear: r.rank?.position?.year ?? undefined,
    genres: (r.genres ?? []).map((g) => g.genre).filter((g): g is string => !!g),
    categories: cats,
    status: r.status ?? undefined,
    completed: r.completed ?? undefined,
    licensed: r.licensed ?? undefined,
    latestChapter: r.latest_chapter ?? undefined,
    authors: (r.authors ?? [])
      .filter((a) => a.name)
      .map((a) => ({ name: a.name as string, role: a.type ?? "Author" })),
    publishers: (r.publishers ?? []).map((p) => p.publisher_name).filter((p): p is string => !!p),
    animeStart: r.anime?.start ?? undefined,
    animeEnd: r.anime?.end ?? undefined,
    related: (r.related_series ?? [])
      .filter((x) => x.related_series_id && x.related_series_name)
      .map((x) => ({
        id: x.related_series_id as number,
        title: x.related_series_name as string,
        relation: x.relation_type ?? undefined,
      })),
    recommendations: (r.recommendations ?? [])
      .filter((x) => x.series_id && x.series_name)
      .map((x) => ({ id: x.series_id as number, title: x.series_name as string })),
  };
}

type CacheShape = Record<string, { t: number; info: MangaUpdatesInfo | null }>;

let mem: CacheShape | null = null;

function readCache(): CacheShape {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    mem = raw ? (JSON.parse(raw) as CacheShape) : {};
  } catch {
    mem = {};
  }
  return mem;
}

function writeCache(cache: CacheShape): void {
  const keys = Object.keys(cache);
  if (keys.length > CACHE_CAP) {
    const sorted = keys.sort((a, b) => (cache[a]?.t ?? 0) - (cache[b]?.t ?? 0));
    for (const k of sorted.slice(0, keys.length - CACHE_CAP)) delete cache[k];
  }
  mem = cache;
  setItemWithRecovery(CACHE_KEY, JSON.stringify(cache));
}

async function searchSeries(title: string): Promise<SearchHit[]> {
  const res = await gate(() =>
    safeFetch(`${BASE}/series/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search: title, perpage: 6 }),
    }),
  );
  if (!res.ok) return [];
  const j = (await res.json()) as { results?: SearchHit[] };
  return j.results ?? [];
}

async function getSeries(id: number): Promise<RawSeries | null> {
  const res = await gate(() => safeFetch(`${BASE}/series/${id}`));
  if (!res.ok) return null;
  return (await res.json()) as RawSeries;
}

function pickMatch(hits: SearchHit[], query: string): number | null {
  const q = norm(query);
  if (!q) return null;
  for (const h of hits) {
    const id = h.record?.series_id;
    if (!id) continue;
    const candidates = [h.hit_title, h.record?.title].filter((t): t is string => !!t);
    if (candidates.some((c) => norm(c) === q)) return id;
  }
  for (const h of hits) {
    const id = h.record?.series_id;
    if (!id) continue;
    const candidates = [h.hit_title, h.record?.title].filter((t): t is string => !!t);
    if (
      candidates.some((c) => {
        const n = norm(c);
        if (!n) return false;
        const long = n.length >= q.length ? n : q;
        const short = n.length >= q.length ? q : n;
        return long.includes(short) && short.length >= Math.max(4, long.length * 0.6);
      })
    ) {
      return id;
    }
  }
  return null;
}

export async function mangaUpdatesFor(title?: string): Promise<MangaUpdatesInfo | null> {
  if (!title) return null;
  const key = norm(title);
  if (!key) return null;

  const cache = readCache();
  const hit = cache[key];
  if (hit && Date.now() - hit.t < TTL_MS) return hit.info;

  try {
    const hits = await searchSeries(title);
    const id = pickMatch(hits, title);
    const raw = id ? await getSeries(id) : null;
    const info = raw ? toInfo(raw) : null;
    writeCache({ ...cache, [key]: { t: Date.now(), info } });
    return info;
  } catch {
    return null;
  }
}
