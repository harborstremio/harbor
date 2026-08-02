import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { savePlayback } from "@/lib/playback-history";
import { pushWatched } from "@/lib/trakt/history";
import { addToHistory as simklAddToHistory } from "@/lib/simkl/history";
import { setMovieWatchedLocal } from "@/lib/movie-watched";
import { recordManualWatchedMeta, setManualWatchedMany } from "@/lib/manual-watched";
import { setWatchedFlag } from "@/lib/watched-flag";
import { recordWatchEvent } from "@/lib/watch-events";
import { readActiveStremioAuthKey } from "@/lib/auth";
import { cloudWriteId } from "@/lib/stremio";
import { markMovieWatchedStremio } from "@/lib/stremio-watched-sync";
import { syncSeriesWatchedToStremio } from "@/lib/stremio-episode-watched";
import { tmdbImdbCached } from "@/lib/providers/tmdb/tmdb-imdb-resolve";

export async function markMovieWatched(
  meta: Meta,
  imdbId?: string | null,
  tmdbId?: string | number | null,
): Promise<void> {
  setMovieWatchedLocal(meta.id, true);
  savePlayback(meta.id, { title: meta.name, parsedTitle: meta.name });
  recordWatchEvent({ id: meta.id, type: "movie", name: meta.name, poster: meta.poster, at: Date.now() });
  const imdb = imdbId ?? (meta.id.startsWith("tt") ? meta.id : undefined);
  const tmdb = typeof tmdbId === "string" ? Number(tmdbId) || undefined : tmdbId ?? undefined;
  const authKey = readActiveStremioAuthKey();
  const cid = authKey ? cloudWriteId(meta.id, imdb ?? null, !!imdb) : null;
  const writes: Promise<unknown>[] = [];
  if (authKey && cid) writes.push(markMovieWatchedStremio(authKey, meta, cid, true));
  if (imdb || tmdb) {
    const ids = { ...(imdb ? { imdb } : {}), ...(tmdb ? { tmdb } : {}) };
    writes.push(pushWatched({ kind: "movie", ids }), simklAddToHistory({ kind: "movie", ids }));
  }
  await Promise.allSettled(writes);
}

export async function unmarkMovieWatched(meta: Meta, imdbId?: string | null): Promise<void> {
  setMovieWatchedLocal(meta.id, false);
  setWatchedFlag(meta.id, false);
  const imdb = imdbId ?? (meta.id.startsWith("tt") ? meta.id : undefined);
  const authKey = readActiveStremioAuthKey();
  const cid = authKey ? cloudWriteId(meta.id, imdb ?? null, !!imdb) : null;
  if (authKey && cid) await markMovieWatchedStremio(authKey, meta, cid, false);
}

function resolveSeriesImdb(meta: Meta, imdbId?: string | null): string | null {
  if (imdbId?.startsWith("tt")) return imdbId;
  if (meta.id.startsWith("tt")) return meta.id;
  const cached = tmdbImdbCached(meta.id);
  return cached?.startsWith("tt") ? cached : null;
}

async function releasedEpisodes(
  meta: Meta,
  imdbId?: string | null,
): Promise<Array<{ season: number; episode: number }>> {
  const fetchId = resolveSeriesImdb(meta, imdbId) ?? meta.id;
  const source = meta.videos?.length ? meta : (await fetchMeta("series", fetchId).catch(() => null)) ?? meta;
  const now = Date.now();
  const out: Array<{ season: number; episode: number }> = [];
  for (const v of source.videos ?? []) {
    const season = v.season ?? 0;
    const episode = v.episode ?? v.number;
    if (season < 1 || episode == null) continue;
    const rel = v.released ?? v.firstAired;
    if (rel) {
      const at = Date.parse(rel);
      if (Number.isFinite(at) && at > now) continue;
    }
    out.push({ season, episode });
  }
  return out;
}

export async function markMetaWatched(
  meta: Meta,
  imdbId?: string | null,
  tmdbId?: string | number | null,
): Promise<void> {
  setWatchedFlag(meta.id, true);
  if (narrowMediaType(meta.type) === "movie") {
    await markMovieWatched(meta, imdbId, tmdbId);
    return;
  }
  recordManualWatchedMeta(meta.id, {
    type: "series",
    name: meta.name,
    poster: meta.poster,
    background: meta.background,
    markedAt: new Date().toISOString(),
  });
  recordWatchEvent({ id: meta.id, type: "series", name: meta.name, poster: meta.poster, at: Date.now() });
  const resolvedImdb = resolveSeriesImdb(meta, imdbId);
  const eps = await releasedEpisodes(meta, resolvedImdb);
  if (eps.length > 0) setManualWatchedMany(meta.id, eps, true);
  void syncSeriesWatchedToStremio(meta, resolvedImdb);
  const isAnime = /^(kitsu|mal|anilist|anidb):/.test(meta.id);
  const imdb = resolvedImdb ?? (meta.id.startsWith("tt") ? meta.id : undefined);
  const tmdb = typeof tmdbId === "string" ? Number(tmdbId) || undefined : tmdbId ?? undefined;
  if (!isAnime && (imdb || tmdb)) {
    const ids = { ...(imdb ? { imdb } : {}), ...(tmdb ? { tmdb } : {}) };
    await Promise.allSettled([
      pushWatched({ kind: "show", ids }),
      simklAddToHistory({ kind: "show", ids }),
    ]);
  }
}

export async function unmarkMetaWatched(meta: Meta, imdbId?: string | null): Promise<void> {
  setWatchedFlag(meta.id, false);
  if (narrowMediaType(meta.type) === "movie") {
    await unmarkMovieWatched(meta, imdbId);
    return;
  }
  const resolvedImdb = resolveSeriesImdb(meta, imdbId);
  const eps = await releasedEpisodes(meta, resolvedImdb);
  if (eps.length > 0) setManualWatchedMany(meta.id, eps, false);
  void syncSeriesWatchedToStremio(meta, resolvedImdb);
}
