import type { Meta } from "../cinemeta";
import { isGenericEpisodeTitle, pickPreferredEpisodeTitle } from "../episode-title.ts";
import type { KitsuEpisode } from "./kitsu";

type CinemetaEpisode = NonNullable<Meta["videos"]>[number];

export function mergeCinemetaEpisodes(episodes: KitsuEpisode[], videos: CinemetaEpisode[]): void {
  const bySeasonEpisode = new Map<string, CinemetaEpisode>();
  const byAbsolute = new Map<number, CinemetaEpisode>();
  const ordered = videos
    .filter((video) => video.season != null && video.episode != null)
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
  let position = 0;
  for (const video of ordered) {
    bySeasonEpisode.set(`${video.season}:${video.episode}`, video);
    if ((video.season ?? 0) > 0) {
      position += 1;
      if (!byAbsolute.has(position)) byAbsolute.set(position, video);
    }
  }

  for (const episode of episodes) {
    const season = episode.imdbSeason ?? episode.seasonNumber ?? 1;
    const episodeNumber = episode.imdbEpisode ?? episode.number;
    const match =
      bySeasonEpisode.get(`${season}:${episodeNumber}`) ??
      byAbsolute.get(episode.absoluteNumber ?? episode.number);
    if (!match) continue;

    const titleNumber = match.episode ?? episodeNumber;
    const title = pickPreferredEpisodeTitle(titleNumber, match.name, match.title);
    if (
      title &&
      !isGenericEpisodeTitle(title, titleNumber) &&
      isGenericEpisodeTitle(episode.title, episode.number)
    ) {
      episode.title = title;
    }
    const synopsis = match.overview?.trim() || match.description?.trim();
    if (synopsis && !episode.synopsis) episode.synopsis = synopsis;
    if (match.thumbnail && !episode.thumbnail) episode.thumbnail = match.thumbnail;
  }
}
