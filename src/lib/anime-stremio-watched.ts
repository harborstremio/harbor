import type { Meta } from "@/lib/cinemeta";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { manualWatchedState } from "@/lib/manual-watched";
import { syncSeriesWatchedToStremio, type StremioEpisodeKeys } from "@/lib/stremio-episode-watched";

type Row = Pick<
  KitsuEpisode,
  "number" | "seasonNumber" | "imdbSeason" | "imdbEpisode" | "sourceMetaId" | "id"
>;

/** The season a row's manual watched key is stored under. */
export function animeRowSeason(
  ep: Pick<KitsuEpisode, "id" | "seasonNumber" | "imdbSeason">,
): number {
  if (ep.imdbSeason === 0) return 0;
  return ep.id < 0 ? (ep.imdbSeason ?? ep.seasonNumber ?? 1) : (ep.seasonNumber ?? 1);
}

/** Cinemeta (IMDb pair) keys for the rows' manual marks, the numbering Stremio's watched field uses. */
export function animeStremioKeys(metaId: string, rows: Row[]): StremioEpisodeKeys {
  const watched = new Set<string>();
  const unwatched = new Set<string>();
  for (const ep of rows) {
    if (ep.sourceMetaId != null && ep.sourceMetaId !== metaId) continue;
    if (ep.imdbSeason == null || ep.imdbEpisode == null || ep.imdbSeason < 1) continue;
    const own = manualWatchedState(metaId, animeRowSeason(ep), ep.number);
    const canon = manualWatchedState(metaId, ep.imdbSeason, ep.imdbEpisode);
    const state = own ?? canon;
    const key = `${ep.imdbSeason}:${ep.imdbEpisode}`;
    if (state === true) watched.add(key);
    else if (state === false) unwatched.add(key);
  }
  return { watched, unwatched };
}

/** Pushes an IMDb-opened anime's marks to its Stremio library item in Cinemeta numbering. */
export function syncAnimeWatchedToStremio(meta: Meta, imdbId: string | null, rows: Row[]): void {
  const imdb = imdbId?.startsWith("tt") ? imdbId : meta.id.startsWith("tt") ? meta.id : null;
  if (!imdb) return;
  void syncSeriesWatchedToStremio(meta, imdb, animeStremioKeys(meta.id, rows));
}
