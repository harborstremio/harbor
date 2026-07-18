import { get } from "@/lib/providers/tmdb/tmdb-client";
import {
  movieMeta,
  seriesMeta,
  type Page,
  type RawMovie,
  type RawSeries,
} from "@/lib/providers/tmdb/tmdb-meta-mappers";
import type { Meta } from "@/lib/cinemeta";
import { topMovies, topSeries } from "@/lib/cinemeta";
import { watchlistAllIds } from "@/lib/watchlist";

type TrendingItem = (RawMovie & { media_type: "movie" }) | (RawSeries & { media_type: "tv" });

const RECENT_KEY = "harbor.surprise.recent.v1";
const RECENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_CAP = 80;

type RecentEntry = { id: string; at: number };

function readRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const now = Date.now();
    return (arr as RecentEntry[]).filter(
      (e) =>
        e && typeof e.id === "string" && typeof e.at === "number" && now - e.at < RECENT_TTL_MS,
    );
  } catch {
    return [];
  }
}

function pushRecent(id: string): void {
  try {
    const next: RecentEntry[] = [
      { id, at: Date.now() },
      ...readRecent().filter((e) => e.id !== id),
    ];
    if (next.length > RECENT_CAP) next.length = RECENT_CAP;
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function recentIdSet(): Set<string> {
  return new Set(readRecent().map((e) => e.id));
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchTmdb(
  key: string,
  path: string,
  params: Record<string, string> = {},
): Promise<TrendingItem[]> {
  try {
    const data = await get<Page<TrendingItem>>(key, path, { ...params });
    return data?.results ?? [];
  } catch {
    return [];
  }
}

function tagMedia(items: TrendingItem[], media: "movie" | "tv"): TrendingItem[] {
  return items.map((r) => ({ ...r, media_type: media }) as TrendingItem);
}

async function topAffinityGenres(tmdbKey: string): Promise<number[]> {
  const ids = watchlistAllIds();
  if (ids.length === 0 || !tmdbKey) return [];
  const tmdbIds = ids
    .filter((id) => id.startsWith("tmdb:"))
    .slice(0, 14)
    .map((id) => {
      const parts = id.split(":");
      return { kind: parts[1] as "movie" | "tv", num: parts[2] };
    })
    .filter((x) => x.kind && x.num);
  if (tmdbIds.length === 0) return [];
  const counts = new Map<number, number>();
  await Promise.all(
    tmdbIds.map(async (x) => {
      try {
        const detail = await get<{ genres?: { id: number }[] }>(tmdbKey, `${x.kind}/${x.num}`);
        for (const g of detail?.genres ?? []) {
          counts.set(g.id, (counts.get(g.id) ?? 0) + 1);
        }
      } catch {
        /* ignore */
      }
    }),
  );
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);
}

export async function surpriseMe(
  tmdbKey: string,
  opts: { excludeGenres?: number[] } = {},
): Promise<Meta | null> {
  const excludeGenreSet = new Set(opts.excludeGenres ?? []);
  const recent = recentIdSet();
  const owned = new Set(watchlistAllIds());

  if (tmdbKey) {
    const affinity = await topAffinityGenres(tmdbKey);
    const sources: Promise<TrendingItem[]>[] = [
      fetchTmdb(tmdbKey, "trending/all/week").then((r) => r),
      fetchTmdb(tmdbKey, "trending/all/day").then((r) => r),
      fetchTmdb(tmdbKey, "movie/top_rated", {
        page: String(1 + Math.floor(Math.random() * 5)),
      }).then((r) => tagMedia(r, "movie")),
      fetchTmdb(tmdbKey, "tv/top_rated", { page: String(1 + Math.floor(Math.random() * 5)) }).then(
        (r) => tagMedia(r, "tv"),
      ),
      fetchTmdb(tmdbKey, "movie/popular", { page: String(1 + Math.floor(Math.random() * 4)) }).then(
        (r) => tagMedia(r, "movie"),
      ),
      fetchTmdb(tmdbKey, "tv/popular", { page: String(1 + Math.floor(Math.random() * 4)) }).then(
        (r) => tagMedia(r, "tv"),
      ),
    ];
    if (affinity.length > 0) {
      const aff = affinity.slice(0, 2).join(",");
      sources.push(
        fetchTmdb(tmdbKey, "discover/movie", {
          with_genres: aff,
          sort_by: "vote_average.desc",
          "vote_count.gte": "300",
          page: String(1 + Math.floor(Math.random() * 6)),
        }).then((r) => tagMedia(r, "movie")),
      );
      sources.push(
        fetchTmdb(tmdbKey, "discover/tv", {
          with_genres: aff,
          sort_by: "vote_average.desc",
          "vote_count.gte": "150",
          page: String(1 + Math.floor(Math.random() * 6)),
        }).then((r) => tagMedia(r, "tv")),
      );
    }
    const all = (await Promise.all(sources)).flat();
    const seen = new Set<string>();
    const pool: TrendingItem[] = [];
    for (const r of all) {
      if (!r.poster_path) continue;
      const id = `${r.media_type}-${(r as { id?: number }).id ?? ""}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const genreIds = (r as { genre_ids?: number[] }).genre_ids ?? [];
      if (genreIds.some((g) => excludeGenreSet.has(g))) continue;
      const stremioId =
        r.media_type === "tv"
          ? `tmdb:tv:${(r as { id?: number }).id ?? ""}`
          : `tmdb:movie:${(r as { id?: number }).id ?? ""}`;
      if (owned.has(stremioId)) continue;
      if (recent.has(stremioId)) continue;
      pool.push(r);
    }
    if (pool.length > 0) {
      shuffleInPlace(pool);
      const pick = pool[0];
      const meta = pick.media_type === "tv" ? seriesMeta(pick) : movieMeta(pick as RawMovie);
      if (meta?.id) pushRecent(meta.id);
      return meta;
    }
  }

  const fallback = shuffleInPlace([
    ...(await topMovies().catch(() => [])),
    ...(await topSeries().catch(() => [])),
  ]).filter((m) => m && !recent.has(m.id) && !owned.has(m.id));
  if (!fallback.length) return null;
  const meta = fallback[0];
  if (meta.id) pushRecent(meta.id);
  return meta;
}
