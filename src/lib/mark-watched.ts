import { meta as fetchMeta, narrowMediaType, type Meta } from "@/lib/cinemeta";
import { savePlayback } from "@/lib/playback-history";
import { pushWatched } from "@/lib/trakt/history";
import { addToHistory as simklAddToHistory } from "@/lib/simkl/history";
import { setMovieWatchedLocal } from "@/lib/movie-watched";
import { recordManualWatchedMeta, setManualWatchedMany } from "@/lib/manual-watched";
import { setWatchedFlag } from "@/lib/watched-flag";
import { readActiveStremioAuthKey } from "@/lib/auth";
import { cloudWriteId } from "@/lib/stremio";
import { markMovieWatchedStremio } from "@/lib/stremio-watched-sync";

export async function markMovieWatched(
  meta: Meta,
  imdbId?: string | null,
  tmdbId?: string | number | null,
): Promise<void> {
  setMovieWatchedLocal(meta.id, true);
  savePlayback(meta.id, { title: meta.name, parsedTitle: meta.name });
  const imdb = imdbId ?? (meta.id.startsWith("tt") ? meta.id : undefined);
  const tmdb = typeof tmdbId === "string" ? Number(tmdbId) || undefined : (tmdbId ?? undefined);
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

async function releasedEpisodes(meta: Meta): Promise<Array<{ season: number; episode: number }>> {
  const source = meta.videos?.length
    ? meta
    : ((await fetchMeta("series", meta.id).catch(() => null)) ?? meta);
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
  const eps = await releasedEpisodes(meta);
  if (eps.length > 0) setManualWatchedMany(meta.id, eps, true);
  const isAnime = /^(kitsu|mal|anilist|anidb):/.test(meta.id);
  const imdb = imdbId ?? (meta.id.startsWith("tt") ? meta.id : undefined);
  const tmdb = typeof tmdbId === "string" ? Number(tmdbId) || undefined : (tmdbId ?? undefined);
  if (!isAnime && (imdb || tmdb)) {
    const ids = { ...(imdb ? { imdb } : {}), ...(tmdb ? { tmdb } : {}) };
    await Promise.allSettled([
      pushWatched({ kind: "show", ids }),
      simklAddToHistory({ kind: "show", ids }),
    ]);
  }
}

export async function unmarkMetaWatched(meta: Meta): Promise<void> {
  setWatchedFlag(meta.id, false);
  if (narrowMediaType(meta.type) === "movie") {
    setMovieWatchedLocal(meta.id, false);
    return;
  }
  const eps = await releasedEpisodes(meta);
  if (eps.length > 0) setManualWatchedMany(meta.id, eps, false);
}
