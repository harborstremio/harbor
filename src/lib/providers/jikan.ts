import { adultContentHidden, isAdultText } from "@/lib/addons-store/adult-filter";
import type { Meta } from "@/lib/cinemeta";
import { registerEvictable } from "@/lib/maintenance";

const JIKAN = "https://api.jikan.moe/v4";
const ARM = "https://relations.yuna.moe/api/ids";

const ARM_KEY = "harbor.armcache";
const ARM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ARM_NEG_TTL_MS = 24 * 60 * 60 * 1000;
const ARM_TIMEOUT_MS = 3500;

type ArmEntry = { kitsu?: number; anilist?: number; t: number; neg?: boolean };
type ArmCache = Record<string, ArmEntry>;

function readCache(): ArmCache {
  try {
    return JSON.parse(localStorage.getItem(ARM_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: ArmCache) {
  try {
    localStorage.setItem(ARM_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

const armMem: ArmCache = readCache();
const armInflight = new Map<number, Promise<ArmEntry | null>>();
let armFlushTimer = 0;

function armRemember(malId: number, entry: ArmEntry) {
  armMem[malId] = entry;
  window.clearTimeout(armFlushTimer);
  armFlushTimer = window.setTimeout(() => writeCache(armMem), 600);
}

async function armLookup(malId: number): Promise<ArmEntry | null> {
  const hit = armMem[malId];
  if (hit) {
    const age = Date.now() - hit.t;
    if (hit.neg ? age < ARM_NEG_TTL_MS : age < ARM_TTL_MS) return hit.neg ? null : hit;
  }
  const existing = armInflight.get(malId);
  if (existing) return existing;
  const p = (async () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ARM_TIMEOUT_MS);
    try {
      const r = await fetch(`${ARM}?source=myanimelist&id=${malId}`, { signal: ac.signal });
      if (!r.ok) {
        armRemember(malId, { t: Date.now(), neg: true });
        return null;
      }
      const j = await r.json();
      const entry: ArmEntry = { kitsu: j?.kitsu, anilist: j?.anilist, t: Date.now() };
      armRemember(malId, entry);
      return entry;
    } catch {
      armRemember(malId, { t: Date.now(), neg: true });
      return null;
    } finally {
      clearTimeout(timer);
      armInflight.delete(malId);
    }
  })();
  armInflight.set(malId, p);
  return p;
}

type JikanAnime = {
  mal_id: number;
  title?: string;
  title_english?: string;
  title_japanese?: string;
  type?: string;
  status?: string;
  episodes?: number;
  duration?: string;
  rating?: string;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  members?: number;
  year?: number;
  synopsis?: string;
  aired?: { from?: string; to?: string };
  images?: {
    jpg?: { large_image_url?: string; image_url?: string };
    webp?: { large_image_url?: string; image_url?: string };
  };
  genres?: Array<{ name: string }>;
  studios?: Array<{ name: string }>;
  trailer?: { youtube_id?: string };
};

const SERIES_TYPES = new Set(["TV", "OVA", "ONA", "Special"]);

function bestPoster(a: JikanAnime): string | undefined {
  return (
    a.images?.webp?.large_image_url ??
    a.images?.jpg?.large_image_url ??
    a.images?.webp?.image_url ??
    a.images?.jpg?.image_url
  );
}

function bestTitle(a: JikanAnime): string {
  return a.title_english || a.title || a.title_japanese || "Unknown";
}

const FRANCHISE_STRIP_RX: RegExp[] = [
  /\s*[-:]?\s*(?:1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Final|Last)\s+(?:Season|Cour|Part)\b.*$/i,
  /\s*[-:]?\s*Season\s+\d+\b.*$/i,
  /\s+S\d+(?:\s|$).*/i,
  /\s*[-:]?\s*(?:Part|Cour|Chapter)\s+\d+\b.*$/i,
  /\s+(?:II|III|IV|V|VI|VII|VIII|IX|X)\s*$/,
];

export function stripFranchiseSuffix(name: string): string {
  let t = name;
  for (const rx of FRANCHISE_STRIP_RX) t = t.replace(rx, "");
  return t.replace(/[\s°'."’˚_:\-]+$/g, "").trim();
}

export function animeFranchiseKey(name: string): string {
  return stripFranchiseSuffix(name).toLowerCase();
}

function franchiseKey(a: JikanAnime): string {
  return animeFranchiseKey(a.title_english || a.title || a.title_japanese || "");
}

function franchiseAge(a: JikanAnime): number {
  if (a.year) return a.year;
  const m = a.aired?.from?.match(/^(\d{4})/);
  if (m) return parseInt(m[1], 10);
  return 9999;
}

function pickFranchiseAnchor(group: JikanAnime[]): JikanAnime {
  return [...group].sort((x, y) => {
    const da = franchiseAge(x);
    const db = franchiseAge(y);
    if (da !== db) return da - db;
    return x.mal_id - y.mal_id;
  })[0];
}

function toMeta(a: JikanAnime, id: string): Meta {
  const isSeries = !a.type || SERIES_TYPES.has(a.type);
  const releaseInfo = a.year ? String(a.year) : a.aired?.from ? a.aired.from.slice(0, 4) : undefined;
  const poster = bestPoster(a);
  return {
    id,
    type: isSeries ? "series" : "movie",
    name: bestTitle(a),
    poster,
    background: poster,
    description: a.synopsis,
    releaseInfo,
    imdbRating: typeof a.score === "number" ? a.score.toFixed(1) : undefined,
    genres: a.genres?.map((g) => g.name),
    trailerStreams: a.trailer?.youtube_id ? [{ ytId: a.trailer.youtube_id }] : undefined,
  };
}

function isAdultJikan(a: JikanAnime): boolean {
  if (a.rating?.startsWith("Rx")) return true;
  if (a.genres?.some((g) => g.name === "Hentai" || g.name === "Erotica")) return true;
  return isAdultText(a.title_english, a.title, a.title_japanese);
}

async function metasFromJikan(items: JikanAnime[]): Promise<Meta[]> {
  if (items.length === 0) return [];
  if (adultContentHidden()) items = items.filter((a) => !isAdultJikan(a));

  const groups = new Map<string, JikanAnime[]>();
  for (const a of items) {
    const fk = franchiseKey(a);
    const arr = groups.get(fk) ?? [];
    arr.push(a);
    groups.set(fk, arr);
  }
  const anchorByFk = new Map<string, JikanAnime>();
  for (const [fk, group] of groups) {
    anchorByFk.set(fk, pickFranchiseAnchor(group));
  }

  const seenFk = new Set<string>();
  const ordered: JikanAnime[] = [];
  for (const a of items) {
    const fk = franchiseKey(a);
    if (seenFk.has(fk)) continue;
    seenFk.add(fk);
    const anchor = anchorByFk.get(fk);
    if (anchor) ordered.push(anchor);
  }

  const mapped = await Promise.all(
    ordered.map(async (a) => {
      const arm = await armLookup(a.mal_id);
      const id = arm?.kitsu ? `kitsu:${arm.kitsu}` : `mal:${a.mal_id}`;
      return toMeta(a, id);
    }),
  );
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: Meta[] = [];
  for (const m of mapped) {
    const nameKey = m.name.trim().toLowerCase();
    if (seenIds.has(m.id) || seenNames.has(nameKey)) continue;
    seenIds.add(m.id);
    seenNames.add(nameKey);
    out.push(m);
  }
  return out;
}

const inflight = new Map<string, Promise<Meta[]>>();
const cache = new Map<string, { metas: Meta[]; t: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000;

const CATALOG_KEY = "harbor.jikancatalog";
const CATALOG_MAX = 40;
const PERSIST_DESC_MAX = 500;

(() => {
  try {
    const raw = JSON.parse(localStorage.getItem(CATALOG_KEY) ?? "{}") as Record<string, { metas: Meta[]; t: number }>;
    const now = Date.now();
    for (const [k, e] of Object.entries(raw)) {
      if (e && Array.isArray(e.metas) && now - e.t < CACHE_TTL) cache.set(k, e);
    }
  } catch {
    localStorage.removeItem(CATALOG_KEY);
  }
})();

let catalogFlushTimer = 0;

function persistCatalog() {
  window.clearTimeout(catalogFlushTimer);
  catalogFlushTimer = window.setTimeout(() => {
    try {
      const entries = [...cache.entries()]
        .sort((a, b) => b[1].t - a[1].t)
        .slice(0, CATALOG_MAX)
        .map(([k, e]) => [
          k,
          {
            t: e.t,
            metas: e.metas.map((m) =>
              m.description && m.description.length > PERSIST_DESC_MAX
                ? { ...m, description: `${m.description.slice(0, PERSIST_DESC_MAX)}...` }
                : m,
            ),
          },
        ]);
      localStorage.setItem(CATALOG_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      localStorage.removeItem(CATALOG_KEY);
    }
  }, 1000);
}

registerEvictable("jikan-catalog", (aggressive) => {
  if (aggressive) return cache.clear();
  const now = Date.now();
  for (const [k, e] of cache) if (now - e.t > CACHE_TTL) cache.delete(k);
});
const MIN_INTERVAL_MS = 400;

let queueChain: Promise<void> = Promise.resolve();

function throttledJikanFetch(url: string, signal: AbortSignal): Promise<Response> {
  let resolveOuter!: (r: Response) => void;
  let rejectOuter!: (e: unknown) => void;
  const result = new Promise<Response>((resolve, reject) => {
    resolveOuter = resolve;
    rejectOuter = reject;
  });

  queueChain = queueChain.then(async () => {
    try {
      const r = await fetch(url, { signal });
      resolveOuter(r);
    } catch (e) {
      rejectOuter(e);
    }
    await new Promise<void>((r) => setTimeout(r, MIN_INTERVAL_MS));
  });

  return result;
}

async function jikanQuery(path: string, params: Record<string, string | number> = {}): Promise<Meta[]> {
  const effective = adultContentHidden() ? { sfw: "true", ...params } : params;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(effective)) qs.set(k, String(v));
  const key = `${path}?${qs.toString()}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.metas;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const url = `${JIKAN}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;
    for (let attempt = 0; attempt < 4; attempt++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 12000);
      try {
        const r = await throttledJikanFetch(url, ac.signal);
        if (r.status === 429) {
          const backoff = 2000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        if (!r.ok) return [];
        const j = await r.json();
        const items: JikanAnime[] = j?.data ?? [];
        const metas = await metasFromJikan(items);
        cache.set(key, { metas, t: Date.now() });
        persistCatalog();
        return metas;
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
      }
    }
    return [];
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}

export const jikanAiringNow = (page = 1) => jikanQuery("/seasons/now", { page });
export const jikanUpcoming = (page = 1) => jikanQuery("/seasons/upcoming", { page });
export const jikanTopAnime = (page = 1) => jikanQuery("/top/anime", { page });
export const jikanTopAiring = (page = 1) => jikanQuery("/top/anime", { filter: "airing", page });
export const jikanTopPopular = (page = 1) => jikanQuery("/top/anime", { filter: "bypopularity", page });
export const jikanTopMovies = (page = 1) => jikanQuery("/top/anime", { type: "movie", page });
export const jikanTopTv = (page = 1) => jikanQuery("/top/anime", { type: "tv", page });
export const jikanNewReleases = (page = 1) =>
  jikanQuery("/anime", {
    order_by: "start_date",
    sort: "desc",
    status: "airing",
    min_score: 6,
    page,
  });

export const GENRE = {
  Action: 1,
  Adventure: 2,
  Comedy: 4,
  Drama: 8,
  Fantasy: 10,
  Horror: 14,
  Mystery: 7,
  Romance: 22,
  SciFi: 24,
  SliceOfLife: 36,
  Sports: 30,
  Supernatural: 37,
  Thriller: 41,
  Mecha: 18,
  Music: 19,
  Psychological: 40,
} as const;

export const jikanByGenre = (genreId: number, page = 1) =>
  jikanQuery("/anime", {
    genres: genreId,
    order_by: "score",
    sort: "desc",
    min_score: 7,
    sfw: "true",
    page,
  });

export const jikanSearchByTitle = (title: string, limit = 1) =>
  jikanQuery("/anime", {
    q: title,
    limit,
    order_by: "popularity",
    sort: "desc",
    sfw: "true",
  });

export async function jikanResolveMalId(title: string): Promise<number | null> {
  const url = `${JIKAN}/anime?q=${encodeURIComponent(title)}&limit=1&sfw=true&order_by=popularity&sort=desc`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await throttledJikanFetch(url, ac.signal);
    if (!r.ok) return null;
    const j = await r.json();
    const items: Array<{ mal_id?: number }> = j?.data ?? [];
    return items[0]?.mal_id ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function jikanRecommendationsForMalId(malId: number): Promise<Meta[]> {
  const url = `${JIKAN}/anime/${malId}/recommendations`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await throttledJikanFetch(url, ac.signal);
    if (!r.ok) return [];
    const j = await r.json();
    const items: Array<{ entry?: JikanAnime; votes?: number }> = j?.data ?? [];
    items.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
    const animes = items
      .map((it) => it.entry)
      .filter((e): e is JikanAnime => !!e?.mal_id)
      .slice(0, 12);
    if (animes.length === 0) return [];
    return await metasFromJikan(animes);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export const jikanByEra = (start: string, end: string, page = 1) =>
  jikanQuery("/anime", {
    start_date: start,
    end_date: end,
    order_by: "score",
    sort: "desc",
    min_score: 7.5,
    sfw: "true",
    page,
  });

const GEM_MEMBER_CEILING = 350_000;
const GEM_SCORED_BY_FLOOR = 4_000;

const SEQUEL_RX =
  /\b(?:1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|Final|Last|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+(?:Season|Cour|Part)\b|\bSeason\s+\d+\b|\bS\d+\b|\b(?:Part|Cour)\s+\d+\b|\s(?:II|III|IV|V|VI|VII|VIII|IX|X)$/i;

function isSequelTitle(a: JikanAnime): boolean {
  const candidates = [a.title_english, a.title, a.title_japanese].filter(Boolean) as string[];
  return candidates.some((t) => SEQUEL_RX.test(t));
}

const gemCache = new Map<number, { metas: Meta[]; t: number }>();

async function fetchRawAnimePage(params: Record<string, string | number>): Promise<JikanAnime[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = `${JIKAN}/anime?${qs.toString()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(url, { signal: ac.signal });
      if (r.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
        continue;
      }
      if (!r.ok) return [];
      const j = await r.json();
      return (j?.data ?? []) as JikanAnime[];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

export async function jikanUnderratedGems(page = 1): Promise<Meta[]> {
  const hit = gemCache.get(page);
  if (hit && Date.now() - hit.t < CACHE_TTL) return hit.metas;

  const [p1, p2] = await Promise.all([
    fetchRawAnimePage({
      order_by: "members",
      sort: "asc",
      min_score: 7.8,
      sfw: "true",
      type: "tv",
      page: page * 2 - 1,
    }),
    fetchRawAnimePage({
      order_by: "members",
      sort: "asc",
      min_score: 7.8,
      sfw: "true",
      type: "tv",
      page: page * 2,
    }),
  ]);
  const raw = [...p1, ...p2];
  const seen = new Set<number>();
  const filtered: JikanAnime[] = [];
  for (const a of raw) {
    if (seen.has(a.mal_id)) continue;
    if ((a.members ?? 0) > GEM_MEMBER_CEILING) continue;
    if ((a.scored_by ?? 0) < GEM_SCORED_BY_FLOOR) continue;
    if (isSequelTitle(a)) continue;
    seen.add(a.mal_id);
    filtered.push(a);
  }
  filtered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const metas = await metasFromJikan(filtered);
  gemCache.set(page, { metas, t: Date.now() });
  return metas;
}
