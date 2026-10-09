import { evictLocalPrefix, idbCacheGet, idbCacheSet } from "@/lib/idb-cache";
import type { KnownForEntry } from "./rankings";
import { safeFetch } from "./safe-fetch";
import { HARBOR_API_BASE } from "./config/endpoints";

export type RankSource =
  | "harbor"
  | "trending"
  | "rising"
  | "contenders"
  | "tmdb"
  | "imdb"
  | "consensus";

export type PeopleDept = "Acting" | "Directing" | "Production" | "Writing";

export type ScoreComponents = {
  quality: number;
  acclaim: number;
  awards: number;
  roles: number;
};

export type TopTitle = {
  metaId: string;
  tmdbId?: number | null;
  mediaType?: string | null;
  title: string;
  year: number | null;
  role: "Lead" | "Director" | "Supporting" | "Producer" | "Writer";
  rating: number | null;
  votes: number | null;
  awardWinner: boolean;
  awardType?: string | null;
  posterPath: string | null;
};

export type PersonAward = { type: string; wins: number };

export type HarborRankExplanation = {
  id: number;
  rank: number;
  name: string;
  profilePath: string | null;
  department: PeopleDept;
  country: string | null;
  score: number | null;
  components: ScoreComponents;
  modifier: number;
  acclaimedCount8: number;
  acclaimedCount9: number;
  majorAwardWins: number;
  majorAwardNoms: number;
  leadRoles: number;
  avgRating: number | null;
  ratedTitles: number;
  localTitles?: number;
  awardsDataMissing: boolean;
  topTitles: TopTitle[];
  stills?: string[];
  awards?: PersonAward[];
  genres?: string[];
  genreScores?: Record<string, number>;
};

export type PersonRankEntry = {
  id: number;
  rank: number;
  name: string;
  profilePath: string | null;
  department: PeopleDept;
  knownFor?: KnownForEntry[];
  blendSources?: RankSource[];
  delta?: number | null;
  previousRank?: number | null;
  stills?: string[];
  genres?: string[];
  genreScores?: Record<string, number>;
  country?: string | null;
};

export type FeaturedListRef = { key: string; title: string; file: string };

export type FeaturedPerson = {
  id: number;
  rank: number;
  name: string;
  profilePath: string | null;
  department: PeopleDept;
  deathday?: string | null;
  knownFor?: KnownForEntry[];
};

export type RankManifest = {
  computedAt: number;
  sources: RankSource[];
  departments: PeopleDept[];
  featured?: FeaturedListRef[];
  countries: Array<{
    iso: string;
    name: string;
    code?: string | null;
    depts?: Partial<Record<PeopleDept, number>>;
    file?: boolean;
    enough?: boolean;
  }>;
};

export type RankListResult =
  | { source: "harbor"; list: HarborRankExplanation[] }
  | { source: Exclude<RankSource, "harbor">; list: PersonRankEntry[] };

export const HARBOR_RANK_WEIGHTS: ScoreComponents = {
  quality: 0.3,
  acclaim: 0.34,
  awards: 0.24,
  roles: 0.12,
};

const FEED_BASE = `${HARBOR_API_BASE}/rank`;
const STALE_MS = 6 * 60 * 60 * 1000;
const MANIFEST_KEY = "harbor.rank.manifest.v1";

evictLocalPrefix("harbor.rank.", (key) => key === MANIFEST_KEY);

function listKey(source: RankSource, dept: PeopleDept, country: string | null): string {
  return `${source}:${dept}:${country ?? "all"}`;
}

function snapshotKey(source: RankSource, dept: PeopleDept, country: string | null): string {
  return `harbor.rank.${listKey(source, dept, country)}.v1`;
}

function listUrl(source: RankSource, dept: PeopleDept, country: string | null): string {
  return `${FEED_BASE}/${source}-${dept.toLowerCase()}-${country ?? "all"}.json`;
}

function buildResult(source: RankSource, raw: unknown): RankListResult | null {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { list?: unknown } | null)?.list)
      ? (raw as { list: unknown[] }).list
      : null;
  if (!list) return null;
  if (source === "harbor") {
    return { source: "harbor", list: list as HarborRankExplanation[] };
  }
  return { source, list: list as PersonRankEntry[] };
}

type MemEntry = { at: number; result: RankListResult };

let manifestMem: { at: number; manifest: RankManifest } | null = null;
let manifestInflight: Promise<RankManifest | null> | null = null;
const listMem = new Map<string, MemEntry>();
const listInflight = new Map<string, Promise<RankListResult | null>>();

function readManifestSnapshot(): RankManifest | null {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; manifest: RankManifest };
    if (!parsed?.manifest?.sources) return null;
    return parsed.manifest;
  } catch {
    return null;
  }
}

export async function fetchRankManifest(): Promise<RankManifest | null> {
  if (manifestMem && Date.now() - manifestMem.at < STALE_MS) return manifestMem.manifest;
  if (manifestInflight) return manifestInflight;
  const cached = readManifestSnapshot();
  manifestInflight = (async () => {
    try {
      const res = await safeFetch(`${FEED_BASE}/manifest.json`, { cache: "no-cache" });
      if (!res.ok) return cached;
      const j = (await res.json()) as RankManifest;
      if (!j?.sources || !Array.isArray(j.departments)) return cached;
      manifestMem = { at: Date.now(), manifest: j };
      try {
        localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifestMem));
      } catch {
        // ignore
      }
      return j;
    } catch {
      return cached;
    } finally {
      manifestInflight = null;
    }
  })();
  return manifestInflight;
}

const featuredMem = new Map<string, { at: number; list: FeaturedPerson[] }>();
const featuredInflight = new Map<string, Promise<FeaturedPerson[]>>();

export async function fetchFeaturedPeople(file: string): Promise<FeaturedPerson[]> {
  if (!/^[a-z0-9-]+\.json$/.test(file)) return [];
  const mem = featuredMem.get(file);
  if (mem && Date.now() - mem.at < STALE_MS) return mem.list;
  const existing = featuredInflight.get(file);
  if (existing) return existing;
  const run = (async () => {
    try {
      const res = await safeFetch(`${FEED_BASE}/${file}`, { cache: "no-cache" });
      if (!res.ok) return [];
      if ((res.headers.get("content-type") ?? "").includes("html")) return [];
      const raw = await res.json();
      if (!Array.isArray(raw)) return [];
      const list = raw.filter(
        (p): p is FeaturedPerson => typeof p?.id === "number" && typeof p?.name === "string",
      );
      featuredMem.set(file, { at: Date.now(), list });
      return list;
    } catch {
      return [];
    } finally {
      featuredInflight.delete(file);
    }
  })();
  featuredInflight.set(file, run);
  return run;
}

export function peekRankSnapshot(
  source: RankSource,
  dept: PeopleDept,
  country: string | null,
): RankListResult | null {
  const key = listKey(source, dept, country);
  const mem = listMem.get(key);
  if (mem) return mem.result;
  void warmRankSnapshot(source, dept, country);
  return null;
}

const warming = new Set<string>();

function warmRankSnapshot(source: RankSource, dept: PeopleDept, country: string | null): void {
  const key = listKey(source, dept, country);
  if (listMem.has(key) || warming.has(key)) return;
  warming.add(key);
  void idbCacheGet(snapshotKey(source, dept, country))
    .then((entry) => {
      const result = (entry?.data as RankListResult | undefined) ?? null;
      if (result?.list && !listMem.has(key)) listMem.set(key, { at: entry!.at, result });
    })
    .finally(() => warming.delete(key));
}

export async function fetchRankList(
  source: RankSource,
  dept: PeopleDept,
  country: string | null,
): Promise<RankListResult | null> {
  const key = listKey(source, dept, country);
  const mem = listMem.get(key);
  if (mem && Date.now() - mem.at < STALE_MS) return mem.result;
  const existing = listInflight.get(key);
  if (existing) return existing;
  const run = (async () => {
    try {
      const res = await safeFetch(listUrl(source, dept, country), { cache: "no-cache" });
      if (!res.ok) return null;
      if ((res.headers.get("content-type") ?? "").includes("html")) return null;
      const result = buildResult(source, await res.json());
      if (!result) return null;
      listMem.set(key, { at: Date.now(), result });
      void idbCacheSet(snapshotKey(source, dept, country), { at: Date.now(), data: result });
      return result;
    } catch {
      return null;
    } finally {
      listInflight.delete(key);
    }
  })();
  listInflight.set(key, run);
  return run;
}
