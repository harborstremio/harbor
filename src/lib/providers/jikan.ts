import type { Meta } from "@/lib/cinemeta";
import { adultContentHidden, isAdultText } from "@/lib/addons-store/adult-filter";
import { armKitsuIds, catalogGet, catalogSet } from "./jikan-cache";

const JIKAN = "https://api.jikan.moe/v4";

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

const MAL_SMALL_MAX = 300;
const MAL_CARD_WANT = 266;

function bestPoster(a: JikanAnime, want: number): string | undefined {
  const small = a.images?.webp?.image_url ?? a.images?.jpg?.image_url;
  const large = a.images?.webp?.large_image_url ?? a.images?.jpg?.large_image_url;
  return want > MAL_SMALL_MAX ? (large ?? small) : (small ?? large);
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
  const releaseInfo = a.year
    ? String(a.year)
    : a.aired?.from
      ? a.aired.from.slice(0, 4)
      : undefined;
  const poster = bestPoster(a, MAL_CARD_WANT);
  return {
    id,
    type: isSeries ? "series" : "movie",
    name: bestTitle(a),
    malId: a.mal_id,
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

  const kitsuByMal = await armKitsuIds(ordered.map((a) => a.mal_id));
  const mapped = ordered.map((a) => {
    const kitsu = kitsuByMal.get(a.mal_id);
    return toMeta(a, kitsu ? `kitsu:${kitsu}` : `mal:${a.mal_id}`);
  });
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

const MIN_INTERVAL_MS = 400;
const JIKAN_TIMEOUT_MS = 12000;
const RAW_PAGE_TIMEOUT_MS = 8000;

let queueChain: Promise<void> = Promise.resolve();

// The timeout is armed HERE, when the chain reaches this entry, never by the
// caller before it enqueues. Twenty rows fire at once and this chain spaces them
// 400ms apart, so a caller-armed budget is spent waiting in line: the tail of the
// queue aborted while still queued, returned [], and every one of those rows was
// then dropped from the page as settled-and-empty.
function throttledJikanFetch(url: string, timeoutMs: number): Promise<Response> {
  let resolveOuter!: (r: Response) => void;
  let rejectOuter!: (e: unknown) => void;
  const result = new Promise<Response>((resolve, reject) => {
    resolveOuter = resolve;
    rejectOuter = reject;
  });

  queueChain = queueChain.then(async () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ac.signal });
      resolveOuter(r);
    } catch (e) {
      rejectOuter(e);
    } finally {
      clearTimeout(timer);
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

  const hit = catalogGet(key);
  if (hit) return hit;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const url = `${JIKAN}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const r = await throttledJikanFetch(url, JIKAN_TIMEOUT_MS);
        if (r.status === 429) {
          const backoff = 2000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        if (!r.ok) return [];
        const j = await r.json();
        const items: JikanAnime[] = j?.data ?? [];
        const metas = await metasFromJikan(items);
        catalogSet(key, metas);
        return metas;
      } catch {
        return [];
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
    sfw: "true",
  });

// null means jikan answered and knows no such title. A transport failure REJECTS
// instead, because the caller persists this result forever and a failure cached
// as a no-match disables that franchise for the life of the device.
export async function jikanResolveMalId(title: string): Promise<number | null> {
  const url = `${JIKAN}/anime?q=${encodeURIComponent(title)}&limit=1&sfw=true&order_by=popularity&sort=desc`;
  const r = await throttledJikanFetch(url, JIKAN_TIMEOUT_MS);
  if (!r.ok) throw new Error(`jikan ${r.status}`);
  const j = await r.json();
  const items: Array<{ mal_id?: number }> = j?.data ?? [];
  return items[0]?.mal_id ?? null;
}

export async function jikanRecommendationsForMalId(malId: number): Promise<Meta[]> {
  const url = `${JIKAN}/anime/${malId}/recommendations`;
  try {
    const r = await throttledJikanFetch(url, JIKAN_TIMEOUT_MS);
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

const SEQUEL_RX = /\b(?:1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|Final|Last|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth)\s+(?:Season|Cour|Part)\b|\bSeason\s+\d+\b|\bS\d+\b|\b(?:Part|Cour)\s+\d+\b|\s(?:II|III|IV|V|VI|VII|VIII|IX|X)$/i;

function isSequelTitle(a: JikanAnime): boolean {
  const candidates = [a.title_english, a.title, a.title_japanese].filter(Boolean) as string[];
  return candidates.some((t) => SEQUEL_RX.test(t));
}

async function fetchRawAnimePage(params: Record<string, string | number>): Promise<JikanAnime[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = `${JIKAN}/anime?${qs.toString()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await throttledJikanFetch(url, RAW_PAGE_TIMEOUT_MS);
      if (r.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
        continue;
      }
      if (!r.ok) return [];
      const j = await r.json();
      return (j?.data ?? []) as JikanAnime[];
    } catch {
      return [];
    }
  }
  return [];
}

export async function jikanUnderratedGems(page = 1): Promise<Meta[]> {
  const key = `/gems?page=${page}`;
  const hit = catalogGet(key);
  if (hit) return hit;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
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
    if (metas.length > 0) catalogSet(key, metas);
    return metas;
  })();

  inflight.set(key, p);
  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
}
