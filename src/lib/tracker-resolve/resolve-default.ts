import { meta as fetchMeta } from "@/lib/cinemeta";
import { resolveEpisode, type CatalogDeps } from "./resolve";
import { fetchShowSeasons, searchShows, showIdsByTmdb } from "./trakt-catalog";
import type { EpisodeIdentity, ResolutionResult } from "./types";

const defaultDeps: CatalogDeps = { searchShows, fetchShowSeasons };

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function yearOf(releaseInfo?: string): number | null {
  const match = releaseInfo?.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

const TMDB_META_ID = /^tmdb:(?:tv|movie):(\d+)/;

// Cinemeta only serves imdb ids, and a tmdb-sourced play is numbered by the catalog
// that owns it, so the show id has to be bridged before the identity can be read.
async function cinemetaSeriesId(metaId: string): Promise<string | null> {
  const head = metaId.split(":")[0];
  if (/^tt\d+$/.test(head)) return head;
  const tmdb = metaId.match(TMDB_META_ID);
  if (!tmdb) return null;
  const ids = await showIdsByTmdb(Number(tmdb[1])).catch(() => null);
  return ids?.imdb ?? null;
}

/**
 * Cinemeta already carries the tracker's own tvdb/imdb episode id (and the air date)
 * for exactly the shows whose season numbering disagrees, so the identity is read
 * from the local catalog rather than trusted to be present on the call site.
 */
export async function hydrateIdentity(
  metaId: string,
  season: number,
  number: number,
): Promise<EpisodeIdentity | null> {
  const seriesId = await cinemetaSeriesId(metaId);
  if (!seriesId) return null;
  // Forced: the identity must come from Cinemeta even when the user disabled it in favour
  // of a custom metadata addon, because Cinemeta is the source carrying the tracker's own
  // episode ids. Without them no episode can be matched exactly, and hydration returning
  // null silently disables the whole tracker path.
  const series = await fetchMeta("series", seriesId, true).catch(() => null);
  if (!series) return null;
  const video = series.videos?.find(
    (entry) => (entry.season ?? 0) === season && (entry.episode ?? entry.number) === number,
  );
  const extra = video as { tvdb_id?: unknown; imdb_id?: unknown } | undefined;
  const imdb = typeof extra?.imdb_id === "string" && /^tt\d+$/.test(extra.imdb_id) ? extra.imdb_id : null;
  return {
    showTitle: series.name,
    showYear: yearOf(series.releaseInfo),
    season,
    number,
    name: video?.name ?? video?.title ?? null,
    airDate: video?.released ?? video?.firstAired ?? null,
    episodeTvdbId: num(extra?.tvdb_id),
    episodeImdbId: imdb,
  };
}

export function resolveEpisodeWithCatalog(
  identity: EpisodeIdentity,
  deps: CatalogDeps = defaultDeps,
): Promise<ResolutionResult> {
  return resolveEpisode(identity, deps);
}

export async function resolveForMeta(
  metaId: string,
  season: number,
  number: number,
  deps: CatalogDeps = defaultDeps,
): Promise<ResolutionResult> {
  const identity = await hydrateIdentity(metaId, season, number);
  if (!identity) return { ok: false, reason: "error" };
  return resolveEpisode(identity, deps);
}
