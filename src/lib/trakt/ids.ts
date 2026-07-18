import type { TraktTarget } from "./types";

export type IdResolution =
  | { ok: true; target: TraktTarget }
  | { ok: false; reason: "anime" | "unrecognized" };

export type TraktEpisodeRef = {
  season: number;
  episode: number;
  imdbId?: string;
  imdbSeason?: number;
  imdbEpisode?: number;
};

export function stremioIdToTraktTarget(metaId: string, episode?: TraktEpisodeRef): IdResolution {
  if (!metaId) return { ok: false, reason: "unrecognized" };

  if (metaId.startsWith("kitsu:") || metaId.startsWith("mal:")) {
    const imdb = episode?.imdbId;
    if (imdb && /^tt\d+$/.test(imdb) && episode.imdbSeason != null && episode.imdbEpisode != null) {
      return {
        ok: true,
        target: {
          kind: "episode",
          show: { ids: { imdb } },
          season: episode.imdbSeason,
          number: episode.imdbEpisode,
        },
      };
    }
    return { ok: false, reason: "anime" };
  }

  if (metaId.startsWith("tt")) {
    const parts = metaId.split(":");
    const imdb = parts[0];
    if (!/^tt\d+$/.test(imdb)) return { ok: false, reason: "unrecognized" };

    if (parts.length >= 3) {
      const season = Number(parts[1]);
      const number = Number(parts[2]);
      if (!Number.isFinite(season) || !Number.isFinite(number)) {
        return { ok: false, reason: "unrecognized" };
      }
      return {
        ok: true,
        target: { kind: "episode", show: { ids: { imdb } }, season, number },
      };
    }

    if (episode) {
      return {
        ok: true,
        target: {
          kind: "episode",
          show: { ids: { imdb } },
          season: episode.season,
          number: episode.episode,
        },
      };
    }

    return { ok: true, target: { kind: "movie", ids: { imdb } } };
  }

  if (metaId.startsWith("tmdb:")) {
    const parts = metaId.split(":");
    const kind = parts[1];
    const id = Number(parts[2]);
    if (!Number.isFinite(id)) return { ok: false, reason: "unrecognized" };

    if (kind === "movie") {
      return { ok: true, target: { kind: "movie", ids: { tmdb: id } } };
    }
    if (kind === "tv") {
      if (parts.length >= 5) {
        const season = Number(parts[3]);
        const number = Number(parts[4]);
        if (Number.isFinite(season) && Number.isFinite(number)) {
          return {
            ok: true,
            target: { kind: "episode", show: { ids: { tmdb: id } }, season, number },
          };
        }
      }
      if (episode) {
        return {
          ok: true,
          target: {
            kind: "episode",
            show: { ids: { tmdb: id } },
            season: episode.season,
            number: episode.episode,
          },
        };
      }
      return { ok: true, target: { kind: "show", ids: { tmdb: id } } };
    }
    return { ok: false, reason: "unrecognized" };
  }

  return { ok: false, reason: "unrecognized" };
}
