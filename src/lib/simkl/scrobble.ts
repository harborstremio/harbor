import { simklRequest } from "./client";

export type ScrobbleAction = "start" | "pause" | "stop";

export type EpisodeRef = { season?: number; episode?: number } | undefined;

export function buildBody(
  metaId: string,
  episode: EpisodeRef,
  progress: number,
): Record<string, unknown> | null {
  const p = Math.min(100, Math.max(0, progress));

  if (metaId.startsWith("tt")) {
    const imdb = metaId.split(":")[0];
    if (!/^tt\d+$/.test(imdb)) return null;
    if (episode?.episode != null) {
      return {
        progress: p,
        show: { ids: { imdb } },
        episode: { season: episode.season ?? 1, number: episode.episode },
      };
    }
    return { progress: p, movie: { ids: { imdb } } };
  }

  if (metaId.startsWith("tmdb:movie:")) {
    const id = Number(metaId.split(":")[2]);
    if (!Number.isFinite(id)) return null;
    return { progress: p, movie: { ids: { tmdb: id } } };
  }

  if (metaId.startsWith("tmdb:tv:")) {
    const id = Number(metaId.split(":")[2]);
    if (!Number.isFinite(id) || episode?.episode == null) return null;
    return {
      progress: p,
      show: { ids: { tmdb: id } },
      episode: { season: episode.season ?? 1, number: episode.episode },
    };
  }

  const animePrefix = ["kitsu:", "mal:", "anilist:", "anidb:"].find((pre) =>
    metaId.startsWith(pre),
  );
  if (animePrefix && episode?.episode != null) {
    const num = Number(metaId.split(":")[1]);
    if (!Number.isFinite(num)) return null;
    const idKey = animePrefix.slice(0, -1);
    return {
      progress: p,
      anime: { ids: { [idKey]: num } },
      episode: { season: episode.season ?? 1, number: episode.episode },
    };
  }

  return null;
}

export async function simklScrobble(
  action: ScrobbleAction,
  metaId: string,
  episode: EpisodeRef,
  progress: number,
): Promise<void> {
  const body = buildBody(metaId, episode, progress);
  if (!body) return;
  try {
    await simklRequest(`/scrobble/${action}`, { method: "POST", body });
  } catch {
    /* swallow: scrobbling is best-effort */
  }
}
