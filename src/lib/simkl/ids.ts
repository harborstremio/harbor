import { anidbToMal, anilistToMal, kitsuToMal } from "@/lib/providers/anime-mapping";

import type { SimklIds, SimklTarget } from "./types";

export type IdResolution = { ok: true; target: SimklTarget } | { ok: false; reason: "anime" | "unrecognized" };

export function simklTargetIds(target: SimklTarget): SimklIds {
  if (target.kind === "episode") return target.show.ids;
  if (target.kind === "anime-episode") return target.anime.ids;
  return target.ids;
}

async function animeIdToMal(harborId: string): Promise<number | null> {
  const n = Number(harborId.split(":")[1]);
  if (!Number.isFinite(n)) return null;
  if (harborId.startsWith("kitsu:")) return kitsuToMal(n).catch(() => null);
  if (harborId.startsWith("anilist:")) return anilistToMal(n).catch(() => null);
  if (harborId.startsWith("anidb:")) return anidbToMal(n).catch(() => null);
  return null;
}

export async function resolveSimklTarget(harborId: string, type: "movie" | "series"): Promise<SimklTarget | null> {
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

export function stremioIdToSimklTarget(metaId: string, episode?: { season: number; episode: number }): IdResolution {
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
