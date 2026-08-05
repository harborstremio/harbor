export type ScrobbleAction = "start" | "pause" | "stop";

export type EpisodeRef =
  | { season?: number; episode?: number; imdbId?: string; imdbSeason?: number }
  | undefined;

export type ScrobbleInfo = { title?: string; year?: number | null; imdb?: string; tmdb?: number };

function node(ids: Record<string, unknown>, info?: ScrobbleInfo): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...ids };
  if (info?.imdb && /^tt\d+$/.test(info.imdb) && merged.imdb == null) merged.imdb = info.imdb;
  if (info?.tmdb != null && Number.isFinite(info.tmdb) && merged.tmdb == null) merged.tmdb = info.tmdb;
  const out: Record<string, unknown> = { ids: merged };
  if (info?.title) out.title = info.title;
  if (info?.year != null) out.year = info.year;
  return out;
}

export function buildBody(
  metaId: string,
  episode: EpisodeRef,
  progress: number,
  info?: ScrobbleInfo,
): Record<string, unknown> | null {
  const p = Math.min(100, Math.max(0, progress));
  const ep = { season: episode?.season ?? 1, number: episode?.episode };
  const ids: ScrobbleInfo | undefined =
    episode?.imdbId && !info?.imdb ? { ...info, imdb: episode.imdbId } : info;

  if (metaId.startsWith("tt")) {
    const imdb = metaId.split(":")[0];
    if (!/^tt\d+$/.test(imdb)) return null;
    return episode?.episode != null
      ? { progress: p, show: node({ imdb }, ids), episode: ep }
      : { progress: p, movie: node({ imdb }, ids) };
  }

  if (metaId.startsWith("tmdb:movie:")) {
    const id = Number(metaId.split(":")[2]);
    if (!Number.isFinite(id)) return null;
    return { progress: p, movie: node({ tmdb: id }, ids) };
  }

  if (metaId.startsWith("tmdb:tv:")) {
    const id = Number(metaId.split(":")[2]);
    if (!Number.isFinite(id) || episode?.episode == null) return null;
    return { progress: p, show: node({ tmdb: id }, ids), episode: ep };
  }

  const animePrefix = ["kitsu:", "mal:", "anilist:", "anidb:"].find((pre) => metaId.startsWith(pre));
  if (animePrefix) {
    const num = Number(metaId.split(":")[1]);
    if (!Number.isFinite(num)) return null;
    const idKey = animePrefix.slice(0, -1);
    return episode?.episode != null
      ? { progress: p, anime: node({ [idKey]: num }, ids), episode: ep }
      : { progress: p, movie: node({ [idKey]: num }, ids) };
  }

  return null;
}
