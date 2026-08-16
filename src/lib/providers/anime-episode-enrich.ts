import { kitsuToMal, kitsuToTvdb } from "@/lib/providers/anime-mapping";
import { harborImdbEpisodes } from "@/lib/providers/harbor-imdb";
import { fillerEpisodes } from "@/lib/anime-fillers";
import { fetchTvdbThumbs } from "@/lib/providers/anime-tvdb-thumbs";
import { meta as fetchCinemetaMeta } from "@/lib/cinemeta";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import type { Settings } from "@/lib/settings";
import { mergeCinemetaEpisodes } from "./anime-episode-cinemeta-merge";

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

async function enrichCinemetaEpisodes(
  episodes: KitsuEpisode[],
  imdbId: string | null,
): Promise<void> {
  if (!imdbId || !imdbId.startsWith("tt")) return;
  if (
    episodes.every(
      (ep) => ep.thumbnail && ep.synopsis && ep.title && ep.title !== `Episode ${ep.number}`,
    )
  )
    return;
  const m = await fetchCinemetaMeta("series", imdbId).catch(() => null);
  const videos = m?.videos ?? [];
  if (videos.length === 0) return;
  mergeCinemetaEpisodes(episodes, videos);
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
  for (const ep of episodes) {
    if (ep.thumbnail) continue;
    const season = ep.imdbSeason ?? ep.seasonNumber ?? 1;
    const epNum = ep.imdbEpisode ?? ep.number;
    const hit =
      index.bySeasonEpisode.get(`${season}:${epNum}`) ??
      (ep.absoluteNumber ? index.byAbsolute.get(ep.absoluteNumber) : undefined) ??
      index.byAbsolute.get(ep.number);
    if (hit) ep.thumbnail = hit;
  }
}

async function enrichHarborImdb(episodes: KitsuEpisode[], imdbId: string | null): Promise<void> {
  if (!imdbId || !imdbId.startsWith("tt")) return;
  const map = await harborImdbEpisodes(imdbId).catch(() => null);
  if (!map || map.size === 0) return;
  for (const ep of episodes) {
    const season = ep.imdbSeason ?? ep.seasonNumber ?? 1;
    const num = ep.imdbEpisode ?? ep.number;
    const real = map.get(`${season}:${num}`);
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
      await enrichCinemetaEpisodes(episodes, imdbId);
      await enrichTvdbThumbs(episodes, settings, kitsuId);
    })(),
  ]);
}
