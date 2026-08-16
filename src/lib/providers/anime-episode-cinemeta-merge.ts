import type { KitsuEpisode } from "./kitsu";

export interface CinemetaEpisode {
  season?: number;
  episode?: number;
  name?: string;
  title?: string;
  overview?: string;
  description?: string;
  thumbnail?: string;
}

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

    const title = match.name || match.title;
    if (title && (!episode.title || episode.title === `Episode ${episode.number}`)) {
      episode.title = title;
    }
    const synopsis = match.overview || match.description;
    if (synopsis && !episode.synopsis) episode.synopsis = synopsis;
    if (match.thumbnail && !episode.thumbnail) {
      episode.thumbnail = match.thumbnail;
    }
  }
}
