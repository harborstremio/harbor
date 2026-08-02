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

export type RankManifest = {
  computedAt: number;
  sources: RankSource[];
  departments: PeopleDept[];
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

export function peekRankSnapshot(
  source: RankSource,
  dept: PeopleDept,
  country: string | null,
): RankListResult | null {
  const key = listKey(source, dept, country);
  const mem = listMem.get(key);
  if (mem) return mem.result;
  try {
    const raw = localStorage.getItem(snapshotKey(source, dept, country));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; result: RankListResult };
    if (!parsed?.result?.list) return null;
    return parsed.result;
  } catch {
    return null;
  }
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
      const result = buildResult(source, await res.json());
      if (!result) return null;
      listMem.set(key, { at: Date.now(), result });
      try {
        localStorage.setItem(
          snapshotKey(source, dept, country),
          JSON.stringify({ at: Date.now(), result }),
        );
      } catch {
        // ignore
      }
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
