import type { KitsuEpisode } from "@/lib/providers/kitsu";

export type AnimeResumeState = {
  season?: number;
  episode?: number;
  video_id?: string;
};

export type AnimeResumePoint = { season: number; episode: number };

function episodeFromVideoId(
  videoId: string | undefined,
  libraryId: string,
): AnimeResumePoint | null {
  if (!videoId) return null;
  const parts = videoId.split(":");
  if (parts.length < 3) return null;
  const prefix = parts.slice(0, -2).join(":");
  if (prefix === libraryId) {
    const season = Number(parts.at(-2));
    const episode = Number(parts.at(-1));
    return Number.isInteger(season) && season >= 1 && Number.isInteger(episode) && episode >= 1
      ? { season, episode }
      : null;
  }
  const nativeParts = /^(kitsu|mal|anilist|anidb):/.test(libraryId) ? libraryId.split(":") : [];
  if (nativeParts.length === 2 && parts.length === 3 && parts.slice(0, 2).join(":") === libraryId) {
    const episode = Number(parts[2]);
    return Number.isInteger(episode) && episode >= 1 ? { season: 1, episode } : null;
  }
  return null;
}

function validPoint(
  season: number | undefined,
  episode: number | undefined,
): AnimeResumePoint | null {
  if (
    typeof season !== "number" ||
    !Number.isInteger(season) ||
    season < 1 ||
    typeof episode !== "number" ||
    !Number.isInteger(episode) ||
    episode < 1
  ) {
    return null;
  }
  return { season, episode };
}

export function animeResumePoint(
  state: AnimeResumeState,
  libraryId: string,
  episodes: Pick<
    KitsuEpisode,
    "streamId" | "seasonNumber" | "number" | "imdbSeason" | "imdbEpisode"
  >[],
): AnimeResumePoint | null {
  const exact = episodes.find((ep) => ep.streamId && ep.streamId === state.video_id);
  if (exact) return { season: exact.seasonNumber, episode: exact.number };

  const point =
    validPoint(state.season, state.episode) ?? episodeFromVideoId(state.video_id, libraryId);
  if (!point) return null;

  const animeProviderId = /^(kitsu|mal|anilist|anidb):/.test(libraryId);
  const direct = () =>
    episodes.find((ep) => ep.seasonNumber === point.season && ep.number === point.episode);
  const canonical = () =>
    episodes.find((ep) => ep.imdbSeason === point.season && ep.imdbEpisode === point.episode);
  const match = animeProviderId ? (direct() ?? canonical()) : (canonical() ?? direct());
  return match
    ? { season: match.seasonNumber, episode: match.number }
    : animeProviderId
      ? null
      : { season: point.season, episode: point.episode };
}
