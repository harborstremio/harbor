import { fetchAdjacentEpisodes, fetchEpisodeList, nextUnwatchedAfter } from "@/lib/series-episodes";
import { relatedLibraryIds } from "@/lib/providers/anime-mapping";
import type { Meta } from "@/lib/cinemeta";
import {
  episodeFromVideoId,
  isAnimeCwItem,
  isCwMember,
  libraryMetaType,
  type LibraryItem,
} from "@/lib/stremio";
import { isCwDismissed } from "@/lib/cw-dismiss";
import { privateCwProfileId } from "@/lib/cw-profile";

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

export type AnimeMode = "all" | "exclude" | "only";

export function isNextAired(isAnime: boolean, airDate: string | undefined): boolean {
  const t = airDate ? Date.parse(airDate) : NaN;
  if (isAnime) return Number.isFinite(t) && t <= Date.now();
  return !airDate || !Number.isFinite(t) || t <= Date.now();
}

function resurfaceAired(airDate: string | undefined): boolean {
  const t = airDate ? Date.parse(airDate) : NaN;
  return Number.isFinite(t) && t <= Date.now();
}

function currentEpisode(i: LibraryItem): { season: number; episode: number } | null {
  const season = i.state?.season;
  const episode = i.state?.episode;
  if (season && episode) return { season, episode };
  const vid = i.state?.video_id ?? "";
  if (ANIME_ID.test(i._id) && vid.split(":").length === 3) {
    const ep = Number(vid.split(":")[2]);
    return Number.isFinite(ep) && ep > 0 ? { season: 1, episode: ep } : null;
  }
  return episodeFromVideoId(vid);
}

const RESURFACE_TTL = 6 * 3600 * 1000;
const RECENT_MS = 45 * 864e5;

type CacheVal = { next: { season: number; episode: number } | null; t: number };
const cache = new Map<string, CacheVal>();

export function clearResurfaceCache(): void {
  cache.clear();
}

type WatchedFor = (
  i: LibraryItem,
  cur: { season: number; episode: number },
) => (season: number, episode: number) => boolean;

export async function resurfaceCandidates(
  library: LibraryItem[],
  inCw: Set<string>,
  opts: { tmdbKey: string; animeMode: AnimeMode },
  watchedFor?: WatchedFor,
): Promise<Map<string, { season: number; episode: number }>> {
  const now = Date.now();
  const profileScope = privateCwProfileId() ?? "shared";
  const out = new Map<string, { season: number; episode: number }>();
  const candidates = library.filter((i) => {
    if (i.type !== "series" && !ANIME_ID.test(i._id)) return false;
    if (!i.state || (i.removed && !i.temp)) return false;
    if (inCw.has(i._id) || isCwMember(i) || isCwDismissed(i)) return false;
    const anime = isAnimeCwItem(i);
    if (opts.animeMode === "exclude" && anime) return false;
    if (opts.animeMode === "only" && !anime) return false;
    const lw = Date.parse(i.state.lastWatched ?? "");
    if (!Number.isFinite(lw) || now - lw > RECENT_MS) return false;
    const cur = currentEpisode(i);
    if (cur == null) return false;
    if ((i.state.flaggedWatched ?? 0) > 0)
      return !watchedFor || watchedFor(i, cur)(cur.season, cur.episode);
    return anime && !!watchedFor && watchedFor(i, cur)(cur.season, cur.episode);
  });
  for (const i of candidates) {
    const cur = currentEpisode(i)!;
    const key = `${profileScope}|${i._id}:${cur.season}:${cur.episode}`;
    const cached = cache.get(key);
    let nx: { season: number; episode: number } | null;
    const meta: Meta = {
      id: i._id,
      type: libraryMetaType(i.type),
      name: i.name,
      poster: i.poster,
      background: i.background,
    };
    if (cached && now - cached.t < RESURFACE_TTL) {
      nx = cached.next;
    } else {
      try {
        const adj = await fetchAdjacentEpisodes(meta, cur, { tmdbKey: opts.tmdbKey });
        nx = adj.next && resurfaceAired(adj.next.airDate)
          ? { season: adj.next.season, episode: adj.next.episode }
          : null;
        cache.set(key, { next: nx, t: now });
      } catch {
        // A failed lookup must remain retryable on the next refresh.
        continue;
      }
    }
    if (nx && watchedFor && watchedFor(i, cur)(nx.season, nx.episode)) {
      nx = await fetchEpisodeList(meta, { tmdbKey: opts.tmdbKey })
        .then((list) => {
          const target = nextUnwatchedAfter(list, cur, watchedFor(i, cur));
          if (!target) return null;
          const entry = list.find((e) => e.season === target.season && e.episode === target.episode);
          return entry && resurfaceAired(entry.airDate)
            ? { season: target.season, episode: target.episode }
            : null;
        })
        .catch(() => null);
      // Cache episode availability only. Watched history can change independently
      // of this cache, including after switching connected accounts.
    }
    if (nx) {
      const related = await relatedLibraryIds(i._id).catch(() => []);
      if (related.some((r) => inCw.has(r))) continue;
      out.set(i._id, nx);
    }
  }
  return out;
}
