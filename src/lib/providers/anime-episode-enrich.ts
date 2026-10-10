import { kitsuToMal, kitsuToTvdb } from "@/lib/providers/anime-mapping";
import { harborImdbEpisodes } from "@/lib/providers/harbor-imdb";
import { fillerEpisodes } from "@/lib/anime-fillers";
import { fetchTvdbThumbs } from "@/lib/providers/anime-tvdb-thumbs";
import { meta as fetchCinemetaMeta } from "@/lib/cinemeta";
import { tmdbSeasonEpisodes } from "@/lib/providers/tmdb/tmdb-details";
import { STILL_HD_RUNG, tmdbStillUrl } from "@/lib/providers/tmdb/tmdb-image-rungs";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import type { Settings } from "@/lib/settings";

/**
 * Indexes of episodes that have not aired: future-dated rows, plus undated
 * rows positioned after the last dated-aired episode while the list proves it
 * is an ongoing season (some episode is dated in the future). Anything in this
 * set has no real artwork or rating anywhere yet — a fill would be another
 * episode's data borrowed through a numbering fallback, e.g. a backend that
 * splits seasons differently or a courier entry whose local numbers restart.
 * Callers must pass the list in chronological episode order.
 */
export function unairedIndexes(episodes: KitsuEpisode[]): Set<number> {
  const now = Date.now();
  const times = episodes.map((ep) => {
    const t = ep.airdate ? Date.parse(ep.airdate) : NaN;
    return Number.isFinite(t) ? t : null;
  });
  let frontier = -1;
  times.forEach((t, i) => {
    if (t != null && t <= now) frontier = i;
  });
  const ongoing = times.some((t) => t != null && t > now);
  const out = new Set<number>();
  times.forEach((t, i) => {
    if (t != null ? t > now : ongoing && frontier >= 0 && i > frontier) out.add(i);
  });
  return out;
}

async function enrichFiller(episodes: KitsuEpisode[], kitsuId: number): Promise<void> {
  if (episodes.some((ep) => ep.filler)) return;
  const malId = await kitsuToMal(kitsuId).catch(() => null);
  if (!malId) return;
  const fillers = await fillerEpisodes(malId).catch(() => new Set<number>());
  if (fillers.size === 0) return;
  for (const ep of episodes) {
    const num = ep.absoluteNumber ?? ep.number;
    if (fillers.has(num)) ep.filler = true;
  }
}

export type EpisodeArtwork = { thumbnail?: string; synopsis?: string; runtime?: number };

/**
 * Stills, descriptions and runtimes for order rows, keyed by provider
 * season:episode. TVDB regularly lacks these for an episode right after it airs,
 * and the entry's own provider data may not cover the season at all (e.g. a
 * franchise season the app cannot pool), so the missing pieces come from TMDB
 * (stills + overviews + runtimes) and Cinemeta (stills).
 */
export async function episodeArtworkFor(args: {
  imdbId: string | null;
  tmdbId?: number | null;
  tmdbKey: string;
  seasons: number[];
}): Promise<Map<string, EpisodeArtwork>> {
  const map = new Map<string, EpisodeArtwork>();
  const imdb = args.imdbId?.startsWith("tt") ? args.imdbId : null;
  const meta = imdb ? await fetchCinemetaMeta("series", imdb).catch(() => null) : null;
  const rawTmdb = (meta as { moviedb_id?: number } | null)?.moviedb_id;
  const tmdbId = args.tmdbId && args.tmdbId > 0 ? args.tmdbId : Number(rawTmdb) || 0;
  const seasons = [...new Set(args.seasons.filter((s) => Number.isFinite(s) && s > 0))];
  if (tmdbId > 0 && args.tmdbKey && seasons.length > 0) {
    const lists = await Promise.all(
      seasons.map((s) => tmdbSeasonEpisodes(args.tmdbKey, tmdbId, s).catch(() => [])),
    );
    for (const e of lists.flat()) {
      const key = `${e.seasonNumber}:${e.episodeNumber}`;
      const entry = map.get(key) ?? {};
      const still = tmdbStillUrl(e.stillPath, STILL_HD_RUNG);
      if (!entry.thumbnail && still) entry.thumbnail = still;
      const overview = e.overview?.trim();
      if (!entry.synopsis && overview) entry.synopsis = overview;
      if (!entry.runtime && e.runtime != null && e.runtime > 0) entry.runtime = e.runtime;
      if (entry.thumbnail || entry.synopsis || entry.runtime) map.set(key, entry);
    }
  }
  for (const v of meta?.videos ?? []) {
    if (v.season == null || v.episode == null || !v.thumbnail) continue;
    const key = `${v.season}:${v.episode}`;
    const entry = map.get(key) ?? {};
    if (!entry.thumbnail) {
      entry.thumbnail = v.thumbnail;
      map.set(key, entry);
    }
  }
  return map;
}

async function enrichCinemetaThumbs(
  episodes: KitsuEpisode[],
  imdbId: string | null,
): Promise<void> {
  if (!imdbId || !imdbId.startsWith("tt")) return;
  if (episodes.every((ep) => ep.thumbnail)) return;
  const m = await fetchCinemetaMeta("series", imdbId).catch(() => null);
  const videos = m?.videos ?? [];
  if (videos.length === 0) return;

  const bySeasonEpisode = new Map<string, string>();
  const byAbsolute = new Map<number, string>();
  const ordered = videos
    .filter((v) => v.season != null && v.episode != null)
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
  let pos = 0;
  const positions = new Map<string, number>();
  for (const v of ordered) {
    const key = `${v.season}:${v.episode}`;
    const regular = (v.season ?? 0) > 0;
    // Missing artwork still occupies an episode position in the full series.
    if (!positions.has(key)) {
      if (regular) pos += 1;
      positions.set(key, pos);
    }
    if (!v.thumbnail) continue;
    bySeasonEpisode.set(key, v.thumbnail);
    if (regular) byAbsolute.set(positions.get(key)!, v.thumbnail);
  }

  const unaired = unairedIndexes(episodes);
  for (const [i, ep] of episodes.entries()) {
    if (ep.thumbnail) continue;
    if (unaired.has(i)) continue;
    const season = ep.imdbSeason ?? ep.seasonNumber ?? 1;
    const epNum = ep.imdbEpisode ?? ep.number;
    const hit =
      bySeasonEpisode.get(`${season}:${epNum}`) ??
      (ep.absoluteNumber != null ? byAbsolute.get(ep.absoluteNumber) : undefined);
    if (hit) ep.thumbnail = hit;
  }
}

async function enrichTvdbThumbs(
  episodes: KitsuEpisode[],
  settings: Settings,
  kitsuId: number,
): Promise<void> {
  if (!settings.tvdbKey) return;
  if (episodes.every((ep) => ep.thumbnail)) return;
  const tvdbId = await kitsuToTvdb(kitsuId).catch(() => null);
  if (!tvdbId) return;
  const seasons = Array.from(new Set(episodes.map((ep) => ep.imdbSeason ?? ep.seasonNumber ?? 1)));
  const index = await fetchTvdbThumbs(settings.tvdbKey, tvdbId, seasons).catch(() => null);
  if (!index) return;
  const unaired = unairedIndexes(episodes);
  for (const [i, ep] of episodes.entries()) {
    if (ep.thumbnail) continue;
    if (unaired.has(i)) continue;
    const season = ep.imdbSeason ?? ep.seasonNumber ?? 1;
    const epNum = ep.imdbEpisode ?? ep.number;
    const hit =
      index.bySeasonEpisode.get(`${season}:${epNum}`) ??
      (ep.absoluteNumber != null ? index.byAbsolute.get(ep.absoluteNumber) : undefined);
    if (hit) ep.thumbnail = hit;
  }
}

async function enrichHarborImdb(episodes: KitsuEpisode[], imdbId: string | null): Promise<void> {
  if (!imdbId || !imdbId.startsWith("tt")) return;
  const map = await harborImdbEpisodes(imdbId).catch(() => null);
  if (!map || map.size === 0) return;
  const unaired = unairedIndexes(episodes);
  for (const [i, ep] of episodes.entries()) {
    // Unaired episodes have no IMDb rating; a hit here is a mis-keyed rating
    // from another episode.
    if (unaired.has(i)) continue;
    const season = ep.imdbSeason ?? ep.seasonNumber ?? 1;
    const num = ep.imdbEpisode ?? ep.number;
    let real = map.get(`${season}:${num}`);
    if (real == null) {
      const abs = ep.absoluteNumber;
      if (abs != null) {
        real = map.get(`1:${abs}`);
      }
    }
    if (real != null && real > 0) {
      ep.rating = real;
      ep.ratingIsImdb = true;
    }
  }
}

export async function enrichEpisodes(
  episodes: KitsuEpisode[],
  settings: Settings,
  kitsuId: number,
  imdbId: string | null = null,
): Promise<void> {
  await Promise.all([
    enrichFiller(episodes, kitsuId),
    enrichHarborImdb(episodes, imdbId),
    (async () => {
      await enrichCinemetaThumbs(episodes, imdbId);
      await enrichTvdbThumbs(episodes, settings, kitsuId);
    })(),
  ]);
}
