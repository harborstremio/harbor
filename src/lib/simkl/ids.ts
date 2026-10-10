import { anidbToMal, anilistToMal, kitsuToMal } from "@/lib/providers/anime-mapping";
import type { SimklIds, SimklTarget } from "./types";

export type IdResolution =
  | { ok: true; target: SimklTarget }
  | { ok: false; reason: "anime" | "unrecognized" };

export function simklTargetIds(target: SimklTarget): SimklIds {
  if (target.kind === "episode") return target.show.ids;
  if (target.kind === "anime-episode") return target.anime.ids;
  return target.ids;
}

// The id spellings Simkl echoes for a library entry, so a pending watch can be
// matched against Simkl's own data regardless of which id the catalog row used.
export function simklEntryIdKeys(
  ids:
    | {
        imdb?: string;
        tmdb?: number | string;
        mal?: number | string;
        kitsu?: number | string;
        anilist?: number | string;
        anidb?: number | string;
      }
    | undefined,
  kind: "movie" | "show",
): string[] {
  if (!ids) return [];
  const keys: string[] = [];
  if (ids.imdb) keys.push(ids.imdb);
  if (ids.tmdb != null) keys.push(kind === "movie" ? `tmdb:movie:${ids.tmdb}` : `tmdb:tv:${ids.tmdb}`);
  if (ids.mal != null) keys.push(`mal:${ids.mal}`);
  if (ids.kitsu != null) keys.push(`kitsu:${ids.kitsu}`);
  if (ids.anilist != null) keys.push(`anilist:${ids.anilist}`);
  if (ids.anidb != null) keys.push(`anidb:${ids.anidb}`);
  return keys;
}

export type SimklEpisodeCoords = {
  season?: number;
  episode?: number;
  imdbSeason?: number;
  imdbEpisode?: number;
};

// Simkl keeps TV episodes under the provider season while anime entries are
// single-season and entry-relative, so both spellings are tried when Simkl
// data is matched against a stored episode.
export function simklEpisodeWatchKeys(episode: SimklEpisodeCoords): string[] {
  const keys: string[] = [];
  if (episode.imdbSeason != null || episode.imdbEpisode != null) {
    keys.push(`${episode.imdbSeason ?? episode.season}:${episode.imdbEpisode ?? episode.episode}`);
  }
  if (episode.season != null) keys.push(`${episode.season}:${episode.episode}`);
  return keys;
}

// The keys Simkl data can be looked up by for a pending watch: the row id, its
// imdb fallback, and the base id of a season-scoped row ("tt123:2:2").
export function simklLookupIds(metaId: string, imdb?: string): string[] {
  const out: string[] = [];
  for (const id of [metaId, imdb, metaId.startsWith("tt") ? metaId.split(":")[0] : null]) {
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

async function animeIdToMal(harborId: string): Promise<number | null> {
  const n = Number(harborId.split(":")[1]);
  if (!Number.isFinite(n)) return null;
  if (harborId.startsWith("mal:")) return n;
  if (harborId.startsWith("kitsu:")) return kitsuToMal(n).catch(() => null);
  if (harborId.startsWith("anilist:")) return anilistToMal(n).catch(() => null);
  if (harborId.startsWith("anidb:")) return anidbToMal(n).catch(() => null);
  return null;
}

type EpisodeIdentity = {
  season: number;
  episode: number;
  imdbSeason?: number;
  imdbEpisode?: number;
};

export async function resolveSimklEpisodeTarget(
  harborId: string,
  episode: EpisodeIdentity,
  fallbackImdb?: string,
): Promise<SimklTarget | null> {
  const direct = stremioIdToSimklTarget(harborId, episode);
  if (direct.ok && (direct.target.kind === "episode" || direct.target.kind === "anime-episode")) {
    // stremioIdToSimklTarget only numbers from the payload's own coordinates; a
    // season remap means the provider pair is the one Simkl can match.
    const season = episode.imdbSeason ?? direct.target.season;
    const number = episode.imdbEpisode ?? direct.target.number;
    return direct.target.kind === "episode"
      ? { kind: "episode", show: direct.target.show, season, number }
      : { kind: "anime-episode", anime: direct.target.anime, season, number };
  }
  const season = episode.imdbSeason ?? episode.season;
  const number = episode.imdbEpisode ?? episode.episode;
  if (fallbackImdb && /^tt\d+$/.test(fallbackImdb)) {
    return { kind: "episode", show: { ids: { imdb: fallbackImdb } }, season, number };
  }
  const mal = await animeIdToMal(harborId);
  if (mal == null) return null;
  return { kind: "anime-episode", anime: { ids: { mal } }, season, number };
}

export async function resolveSimklTarget(
  harborId: string,
  type: "movie" | "series",
): Promise<SimklTarget | null> {
  let tgt: SimklTarget | null = null;
  const resolution = stremioIdToSimklTarget(harborId);
  if (resolution.ok) {
    tgt = resolution.target;
  } else {
    const mal = await animeIdToMal(harborId);
    if (mal != null) tgt = { kind: "show", ids: { mal } };
  }
  if (!tgt) return null;
  if (type === "series" && tgt.kind === "movie") tgt = { kind: "show", ids: tgt.ids };
  if (type === "movie" && tgt.kind === "show") tgt = { kind: "movie", ids: tgt.ids };
  return tgt;
}

export function stremioIdToSimklTarget(
  metaId: string,
  episode?: { season: number; episode: number },
): IdResolution {
  if (!metaId) return { ok: false, reason: "unrecognized" };

  if (metaId.startsWith("mal:")) {
    const n = Number(metaId.split(":")[1]);
    if (!Number.isFinite(n)) return { ok: false, reason: "unrecognized" };
    if (episode) return { ok: false, reason: "anime" };
    return { ok: true, target: { kind: "show", ids: { mal: n } } };
  }

  if (metaId.startsWith("kitsu:")) {
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
