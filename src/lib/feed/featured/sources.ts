import type { Meta } from "@/lib/cinemeta";
import type { Settings, StreamingService } from "@/lib/settings";
import { fetchAwardWinners } from "@/lib/feed/award-winners";
import { topEntries } from "@/lib/discover/affinity";
import { getStore } from "@/lib/discover/store";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { SERVICES, providerIdsFor, serviceBadge } from "@/lib/providers/streaming";
import {
  tmdbDetails,
  tmdbDiscover,
  tmdbMovieRow,
  tmdbSeriesRow,
  tmdbTrending,
} from "@/lib/providers/tmdb";
import type { FeaturedItem, LaneSource } from "./types";

export type Seed = { id: string; name?: string; ts: number };

const GENRE_ALIAS: Record<string, number> = {
  "Science Fiction": 878,
  "Action & Adventure": 28,
  "Sci-Fi & Fantasy": 878,
};

function genreId(name: string): number | undefined {
  return MOVIE_GENRES[name] ?? GENRE_ALIAS[name];
}

function tag(metas: Meta[], source: LaneSource, seed?: Seed): FeaturedItem[] {
  return metas.map((meta, i) => ({
    meta,
    source,
    sourceRank: i,
    seedId: seed?.id,
    seedTs: seed?.ts,
  }));
}

function seedType(id: string): Meta["type"] {
  if (id.startsWith("tmdb:tv:")) return "series";
  return "movie";
}

async function streamingLane(key: string, settings: Settings): Promise<FeaturedItem[]> {
  const enabled = (Object.keys(SERVICES) as StreamingService[]).filter(
    (s) => settings.streaming[s],
  );
  const region = settings.region || "US";
  const lists = await Promise.all(
    enabled.slice(0, 6).map(async (svc) => {
      const providers = providerIdsFor(SERVICES[svc]);
      const badge = serviceBadge(svc);
      const floor = {
        with_watch_providers: providers,
        watch_region: region,
        with_watch_monetization_types: "flatrate",
        "vote_count.gte": "300",
        sort_by: "popularity.desc",
      };
      const [movies, series] = await Promise.all([
        tmdbDiscover(key, "movie", floor),
        tmdbDiscover(key, "tv", floor),
      ]);
      const metas = [...movies.slice(0, 8), ...series.slice(0, 8)];
      for (const m of metas) m.providerBadge = badge;
      return tag(metas, "streaming");
    }),
  );
  return lists.flat();
}

async function tmdbTopLane(key: string, region: string): Promise<FeaturedItem[]> {
  const [m1, m2, series, trendM, trendTv] = await Promise.all([
    tmdbMovieRow(key, "top_rated", region, 1),
    tmdbMovieRow(key, "top_rated", region, 2),
    tmdbSeriesRow(key, "top_rated", 1),
    tmdbTrending(key, "movie", "week", 1),
    tmdbTrending(key, "tv", "week", 1),
  ]);
  return [...tag([...m1, ...m2, ...series], "tmdb"), ...tag([...trendM, ...trendTv], "trending")];
}

async function acclaimedLane(key: string): Promise<FeaturedItem[]> {
  const [awards, acclaimed] = await Promise.all([
    fetchAwardWinners(key, 1).catch(() => [] as Meta[]),
    tmdbDiscover(key, "movie", {
      "vote_average.gte": "8.0",
      "vote_count.gte": "3000",
      sort_by: "vote_count.desc",
    }).catch(() => [] as Meta[]),
  ]);
  return [...tag(awards, "awards"), ...tag(acclaimed, "acclaimed")];
}

async function similarLane(key: string, seeds: Seed[]): Promise<FeaturedItem[]> {
  const lists = await Promise.all(
    seeds.slice(0, 3).map(async (seed) => {
      const detail = await tmdbDetails(key, {
        id: seed.id,
        type: seedType(seed.id),
        name: seed.name ?? "",
      } as Meta).catch(() => null);
      if (!detail) return [] as FeaturedItem[];
      return tag([...detail.recommendations, ...detail.similar], "similar", seed);
    }),
  );
  return lists.flat();
}

async function seedGenreLane(key: string): Promise<FeaturedItem[]> {
  const { affinity } = getStore();
  if (affinity.totalEvents === 0) return [];
  const gids: number[] = [];
  for (const [name, w] of topEntries(affinity.genres, 6)) {
    if (w <= 0) continue;
    const gid = genreId(name);
    if (gid != null && !gids.includes(gid)) gids.push(gid);
    if (gids.length >= 3) break;
  }
  if (gids.length === 0) return [];
  const lists = await Promise.all(
    gids.map((gid) =>
      tmdbDiscover(key, "movie", {
        with_genres: String(gid),
        "vote_average.gte": "6.8",
        "vote_count.gte": "600",
        sort_by: "popularity.desc",
      }),
    ),
  );
  return tag(lists.flat(), "seed");
}

export async function fastLanes(key: string, region: string): Promise<FeaturedItem[]> {
  return tmdbTopLane(key, region).catch(() => [] as FeaturedItem[]);
}

export async function buildLanes(
  key: string,
  settings: Settings,
  seeds: Seed[],
): Promise<FeaturedItem[]> {
  const region = settings.region || "US";
  const lanes = await Promise.all([
    streamingLane(key, settings).catch(() => [] as FeaturedItem[]),
    tmdbTopLane(key, region).catch(() => [] as FeaturedItem[]),
    acclaimedLane(key).catch(() => [] as FeaturedItem[]),
    similarLane(key, seeds).catch(() => [] as FeaturedItem[]),
    seedGenreLane(key).catch(() => [] as FeaturedItem[]),
  ]);
  return lanes.flat();
}
