import { lruSet } from "@/lib/cache";
import { registerCache } from "@/lib/memory-profiler";
import { isGenericEpisodeName } from "../anime-episode-build";
import { tmdbSeasonEpisodes } from "./tmdb-details";
import { tmdbIdFromImdb } from "./tmdb-imdb-resolve";
import { effectiveTmdbLanguage } from "./tmdb-client";
import { tmdbStillUrl } from "./tmdb-image-rungs";
import type { TmdbEpisodeText } from "./tmdb-episode-name-merge";

const NAMES_MAX = 120;
const namesCache = new Map<string, Map<number, TmdbEpisodeText>>();
const inflight = new Map<string, Promise<Map<number, TmdbEpisodeText>>>();
const NO_NAMES: Map<number, TmdbEpisodeText> = new Map();

registerCache("tmdb:episodeNames", () => namesCache.size);

async function seriesTvId(key: string, metaId: string): Promise<number | null> {
  const direct = /^tmdb:tv:(\d+)$/.exec(metaId);
  if (direct) return Number(direct[1]);
  if (!metaId.startsWith("tt")) return null;
  const resolved = await tmdbIdFromImdb(key, metaId, "series");
  const mapped = resolved ? /^tmdb:tv:(\d+)$/.exec(resolved) : null;
  return mapped ? Number(mapped[1]) : null;
}

export async function tmdbEpisodeNames(
  key: string,
  metaId: string,
  season: number,
): Promise<Map<number, TmdbEpisodeText>> {
  if (!key || !metaId || season < 1) return NO_NAMES;
  const cacheKey = `${metaId}:${season}:${effectiveTmdbLanguage() || "en"}`;
  const hit = namesCache.get(cacheKey);
  if (hit) return hit;
  const running = inflight.get(cacheKey);
  if (running) return running;
  const run = (async () => {
    const tvId = await seriesTvId(key, metaId).catch(() => null);
    const raw = tvId == null ? [] : await tmdbSeasonEpisodes(key, tvId, season).catch(() => []);
    const out = new Map<number, TmdbEpisodeText>();
    for (const e of raw) {
      const name = e.name?.trim() ?? "";
      if (!name || isGenericEpisodeName(name)) continue;
      out.set(e.episodeNumber, {
        name,
        overview: e.overview?.trim() ?? "",
        still: tmdbStillUrl(e.stillPath),
      });
    }
    if (tvId == null || raw.length > 0) lruSet(namesCache, cacheKey, out, NAMES_MAX);
    return out;
  })().finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, run);
  return run;
}
