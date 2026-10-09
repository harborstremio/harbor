import type { Meta } from "@/lib/cinemeta";
import { browseDiscoverKey, type BrowseId, type BrowseKind } from "./browse-kind";
import { cacheGet, cacheSet } from "./brand-cache";
import { tmdbDiscover } from "./tmdb-catalogs";
import { get, IMG } from "./tmdb-client";
import type { CastEntry } from "./tmdb-details";

export type BrandKind = "studio" | "network";
export type { BrowseId, BrowseKind };
export type BrandScope = "top" | "all";

export type BrandSummary = {
  kind: BrandKind;
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  media: "movie" | "tv";
  score: number;
  count: number;
  span: string;
  rating: number | null;
  genres: number[];
  art: string[];
};

export type BrandDetails = {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  headquarters: string | null;
  homepage: string | null;
  description: string | null;
  parent: { id: number; name: string } | null;
};

export type BrandPerson = CastEntry & { titles: number };

export type BrandTitle = {
  meta: Meta;
  tmdbId: number;
  imdbId: string | null;
  year: number | null;
  rating: number | null;
  votes: number;
  revenue: number;
  budget: number;
  runtime: number | null;
  episodes: number;
  seasons: number;
  onAir: boolean;
  collection: { id: number; name: string; backdrop: string | null } | null;
};

export type BrandStats = {
  rating: number | null;
  genres: string[];
  faces: BrandPerson[];
  makers: BrandPerson[];
  titles: BrandTitle[];
  grossing: BrandTitle[];
  first: BrandTitle | null;
  franchises: Array<{ id: number; name: string; backdrop: string | null; count: number }>;
  longest: BrandTitle[];
  onAir: number;
  totalGross: number;
  avgRuntime: number | null;
  mostAcclaimed: BrandTitle | null;
};

type IndexBrand = {
  i: number;
  n: string;
  l: string | null;
  c: string | null;
  m: "m" | "t";
  s: number;
  k: number;
  y: string;
  r: number | null;
  g: number[];
  a: string[];
};
type BrandIndex = { builtAt: string; studio: IndexBrand[]; network: IndexBrand[] };
type Ranked = Record<BrandKind, BrandSummary[]>;
type Entry<T> = { at: number; value: T };

const DETAILS_TTL = 30 * 24 * 60 * 60 * 1000;
const STATS_TTL = 7 * 24 * 60 * 60 * 1000;
const SAMPLE = 16;

const ranked: Record<BrandScope, Ranked | null> = { top: null, all: null };
const rankedPromise: Record<BrandScope, Promise<Ranked> | null> = { top: null, all: null };

function hydrate(kind: BrandKind, raw: IndexBrand): BrandSummary {
  return {
    kind,
    id: raw.i,
    name: raw.n,
    logo: raw.l ? `${IMG}/w300${raw.l}` : null,
    country: raw.c,
    media: raw.m === "t" ? "tv" : "movie",
    score: raw.s,
    count: raw.k,
    span: raw.y,
    rating: raw.r,
    genres: raw.g,
    art: raw.a.map((p) => `${IMG}/w185${p}`),
  };
}

export function tmdbBrandRankingCached(kind: BrandKind, scope: BrandScope = "top"): BrandSummary[] {
  const hit = ranked[scope] ?? (scope === "top" ? ranked.all : null);
  return hit?.[kind] ?? [];
}

export function tmdbBrandRanking(
  kind: BrandKind,
  scope: BrandScope = "top",
): Promise<BrandSummary[]> {
  const cached = tmdbBrandRankingCached(kind, scope);
  if (cached.length > 0) return Promise.resolve(cached);
  if (!rankedPromise[scope]) {
    const load =
      scope === "top" ? import("./brand-index-top.json?raw") : import("./brand-index.json?raw");
    rankedPromise[scope] = load.then((m) => {
      const index = JSON.parse(m.default) as BrandIndex;
      const r: Ranked = {
        studio: index.studio.map((b) => hydrate("studio", b)),
        network: index.network.map((b) => hydrate("network", b)),
      };
      ranked[scope] = r;
      return r;
    });
  }
  return rankedPromise[scope]!.then((r) => r[kind]);
}

function isFresh<T>(entry: Entry<T> | null, ttl: number): entry is Entry<T> {
  return !!entry && Date.now() - entry.at < ttl;
}

let slots = 3;
const waiting: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (slots > 0) slots -= 1;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else slots += 1;
  }
}

function yearOf(value: unknown): number | null {
  if (typeof value !== "string" || value.length < 4) return null;
  const n = Number(value.slice(0, 4));
  return Number.isFinite(n) && n > 1880 ? n : null;
}

type RawDetails = {
  id?: number;
  name?: string;
  logo_path?: string | null;
  origin_country?: string | null;
  headquarters?: string | null;
  homepage?: string | null;
  description?: string | null;
  parent_company?: { id?: number; name?: string } | null;
};

const detailsInflight = new Map<string, Promise<BrandDetails | null>>();

export async function tmdbBrandDetails(
  key: string,
  kind: BrowseKind,
  id: BrowseId,
): Promise<BrandDetails | null> {
  if (!key || !id || kind === "country") return null;
  const cacheKey = `details:${kind}:${id}`;
  const hit = await cacheGet<Entry<BrandDetails | null>>(cacheKey);
  if (isFresh(hit, DETAILS_TTL)) return hit.value;
  const running = detailsInflight.get(cacheKey);
  if (running) return running;
  const p = withSlot(async () => {
    const raw = await get<RawDetails>(
      key,
      kind === "network" ? `network/${id}` : `company/${id}`,
      {},
    ).catch(() => null);
    const value: BrandDetails | null = raw?.name
      ? {
          id: Number(id),
          name: raw.name,
          logo: raw.logo_path ? `${IMG}/w300${raw.logo_path}` : null,
          country: raw.origin_country || null,
          headquarters: raw.headquarters || null,
          homepage: raw.homepage || null,
          description: raw.description || null,
          parent:
            raw.parent_company?.id && raw.parent_company.name
              ? { id: raw.parent_company.id, name: raw.parent_company.name }
              : null,
        }
      : null;
    if (raw) await cacheSet(cacheKey, { at: Date.now(), value });
    return value;
  }).finally(() => detailsInflight.delete(cacheKey));
  detailsInflight.set(cacheKey, p);
  return p;
}

type RawCredits = {
  cast?: Array<{
    id?: number;
    name?: string;
    profile_path?: string | null;
    order?: number;
    character?: string;
    roles?: Array<{ character?: string }>;
  }>;
  crew?: Array<{
    id?: number;
    name?: string;
    profile_path?: string | null;
    job?: string;
    department?: string;
    jobs?: Array<{ job?: string }>;
  }>;
};

type RawTitle = {
  id?: number;
  imdb_id?: string;
  external_ids?: { imdb_id?: string };
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  revenue?: number;
  budget?: number;
  runtime?: number | null;
  episode_run_time?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  status?: string;
  genres?: Array<{ id?: number; name?: string }>;
  belongs_to_collection?: { id?: number; name?: string; backdrop_path?: string | null } | null;
  credits?: RawCredits;
  aggregate_credits?: RawCredits;
};

function tally(
  people: Map<number, BrandPerson & { weight: number }>,
  id: number | undefined,
  name: string | undefined,
  profile: string | null | undefined,
  weight: number,
  character: string,
): void {
  if (!id || !name) return;
  const cur = people.get(id);
  if (cur) {
    cur.titles += 1;
    cur.weight += weight;
    return;
  }
  people.set(id, {
    id,
    name,
    character,
    profilePath: profile ?? null,
    order: 0,
    titles: 1,
    weight,
  });
}

function rankPeople(map: Map<number, BrandPerson & { weight: number }>): BrandPerson[] {
  return [...map.values()]
    .filter((p) => p.titles >= 2 || map.size < 6)
    .sort((a, b) => b.titles - a.titles || b.weight - a.weight)
    .slice(0, 12)
    .map(({ weight: _w, ...rest }) => rest);
}

const tmdbIdOf = (m: Meta): number => Number(m.id.split(":").pop());

function toTitle(meta: Meta, tmdbId: number, d: RawTitle, mediaType: "movie" | "tv"): BrandTitle {
  const col = d.belongs_to_collection;
  return {
    meta,
    tmdbId,
    imdbId: d.imdb_id ?? d.external_ids?.imdb_id ?? null,
    year: yearOf(d.release_date ?? d.first_air_date),
    rating:
      typeof d.vote_average === "number" && d.vote_average > 0
        ? Math.round(d.vote_average * 10) / 10
        : null,
    votes: d.vote_count ?? 0,
    revenue: d.revenue ?? 0,
    budget: d.budget ?? 0,
    runtime: mediaType === "movie" ? (d.runtime ?? null) : (d.episode_run_time?.[0] ?? null),
    episodes: d.number_of_episodes ?? 0,
    seasons: d.number_of_seasons ?? 0,
    onAir: d.status === "Returning Series",
    collection:
      col?.id && col.name
        ? {
            id: col.id,
            name: col.name,
            backdrop: col.backdrop_path ? `${IMG}/original${col.backdrop_path}` : null,
          }
        : null,
  };
}

const statsInflight = new Map<string, Promise<BrandStats>>();

export async function tmdbBrandStats(
  key: string,
  kind: BrowseKind,
  id: BrowseId,
  mediaType: "movie" | "tv",
): Promise<BrandStats> {
  const empty: BrandStats = {
    rating: null,
    genres: [],
    faces: [],
    makers: [],
    titles: [],
    grossing: [],
    first: null,
    franchises: [],
    longest: [],
    onAir: 0,
    totalGross: 0,
    avgRuntime: null,
    mostAcclaimed: null,
  };
  if (!key || !id) return empty;
  const cacheKey = `stats2:${kind}:${id}:${mediaType}`;
  const hit = await cacheGet<Entry<BrandStats>>(cacheKey);
  if (isFresh(hit, STATS_TTL)) return hit.value;
  const running = statsInflight.get(cacheKey);
  if (running) return running;
  const p = (async () => {
    const base = { [browseDiscoverKey(kind)]: String(id) };
    const dateKey = mediaType === "movie" ? "primary_release_date" : "first_air_date";
    const [popular, grossing, earliest] = await Promise.all([
      withSlot(() =>
        tmdbDiscover(key, mediaType, {
          ...base,
          sort_by: "popularity.desc",
          "vote_count.gte": "50",
        }).catch(() => []),
      ),
      mediaType === "movie"
        ? withSlot(() =>
            tmdbDiscover(key, "movie", {
              ...base,
              sort_by: "revenue.desc",
              "vote_count.gte": "100",
            }).catch(() => []),
          )
        : Promise.resolve([] as Meta[]),
      withSlot(() =>
        tmdbDiscover(key, mediaType, {
          ...base,
          sort_by: `${dateKey}.asc`,
          "vote_count.gte": "20",
        }).catch(() => []),
      ),
    ]);
    const metaById = new Map<number, Meta>();
    for (const m of [...popular, ...grossing, ...earliest]) {
      const n = tmdbIdOf(m);
      if (Number.isFinite(n) && n > 0 && !metaById.has(n)) metaById.set(n, m);
    }
    const wanted = [
      ...new Set(
        [...popular.slice(0, SAMPLE), ...grossing.slice(0, SAMPLE), ...earliest.slice(0, 1)].map(
          tmdbIdOf,
        ),
      ),
    ].filter((n) => metaById.has(n));
    const details = await Promise.all(
      wanted.map((tid) =>
        withSlot(() =>
          get<RawTitle>(key, `${mediaType}/${tid}`, {
            append_to_response:
              mediaType === "movie" ? "credits,external_ids" : "aggregate_credits,external_ids",
          }).catch(() => null),
        ),
      ),
    );
    const faces = new Map<number, BrandPerson & { weight: number }>();
    const makers = new Map<number, BrandPerson & { weight: number }>();
    const titles: BrandTitle[] = [];
    const genreCounts = new Map<string, number>();
    details.forEach((d, i) => {
      const meta = metaById.get(wanted[i]);
      if (!d || !meta) return;
      titles.push(toTitle(meta, wanted[i], d, mediaType));
      for (const g of d.genres ?? [])
        if (g.name) genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + 1);
      const credits = d.credits ?? d.aggregate_credits;
      for (const m of (credits?.cast ?? []).slice(0, 8)) {
        const order = typeof m.order === "number" ? m.order : 8;
        tally(
          faces,
          m.id,
          m.name,
          m.profile_path,
          Math.max(1, 8 - order),
          m.character ?? m.roles?.[0]?.character ?? "",
        );
      }
      for (const m of credits?.crew ?? []) {
        const job = m.job ?? m.jobs?.[0]?.job ?? "";
        const maker =
          job === "Director" ||
          job === "Creator" ||
          job === "Series Director" ||
          (mediaType === "tv" && job === "Writer");
        if (!maker) continue;
        tally(
          makers,
          m.id,
          m.name,
          m.profile_path,
          job === "Director" || job === "Creator" ? 3 : 1,
          job,
        );
      }
    });
    const rated = titles.filter((x) => x.rating !== null && x.votes >= 100);
    const grossed = titles
      .filter((x) => x.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, SAMPLE);
    const firstId = earliest[0] ? tmdbIdOf(earliest[0]) : null;
    const franchiseMap = new Map<
      number,
      { id: number; name: string; backdrop: string | null; count: number }
    >();
    for (const x of titles) {
      if (!x.collection) continue;
      const cur = franchiseMap.get(x.collection.id);
      if (cur) cur.count += 1;
      else franchiseMap.set(x.collection.id, { ...x.collection, count: 1 });
    }
    const runtimes = titles
      .map((x) => x.runtime)
      .filter((r): r is number => typeof r === "number" && r > 0);
    const acclaimed = titles
      .filter((x) => x.rating !== null && x.votes >= 500)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const stats: BrandStats = {
      rating: rated.length
        ? Math.round((rated.reduce((s, x) => s + (x.rating ?? 0), 0) / rated.length) * 10) / 10
        : null,
      genres: [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([g]) => g),
      faces: rankPeople(faces),
      makers: rankPeople(makers),
      titles,
      grossing: grossed,
      first: firstId !== null ? (titles.find((x) => x.tmdbId === firstId) ?? null) : null,
      franchises: [...franchiseMap.values()].sort((a, b) => b.count - a.count),
      longest:
        mediaType === "tv"
          ? [...titles]
              .filter((x) => x.episodes > 0)
              .sort((a, b) => b.episodes - a.episodes)
              .slice(0, 12)
          : [],
      onAir: titles.filter((x) => x.onAir).length,
      totalGross: grossed.reduce((s, x) => s + x.revenue, 0),
      avgRuntime: runtimes.length
        ? Math.round(runtimes.reduce((s, r) => s + r, 0) / runtimes.length)
        : null,
      mostAcclaimed: acclaimed[0] ?? null,
    };
    if (titles.length > 0) await cacheSet(cacheKey, { at: Date.now(), value: stats });
    return stats;
  })().finally(() => statsInflight.delete(cacheKey));
  statsInflight.set(cacheKey, p);
  return p;
}
