import { resolveHeroBackdrop } from "@/lib/anime-backdrop";
import { narrowMediaType, type Meta } from "@/lib/cinemeta";
import { externalToKitsu } from "@/lib/providers/anime-mapping";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { tmdbAnimeMatch, tmdbIdFromImdb, tmdbMovieImages } from "@/lib/providers/tmdb";
import { fetchTvdbArtwork } from "@/lib/providers/tvdb-proxy";
import { getLocalCache } from "@/lib/simkl/activities";
import { simklRequest } from "@/lib/simkl/client";
import {
  isSuitableWideArtworkSize,
  pickAlternativeWideArtwork,
  rewriteWideArtworkRung,
} from "@/lib/poster-backdrop-expansion";

const ARTWORK_CACHE_MAX = 300;
const prepared = new Map<string, string>();
const inflight = new Map<string, Promise<string | undefined>>();
const decoded = new Set<string>();
const decoding = new Map<string, { image: HTMLImageElement; promise: Promise<boolean> }>();
const failed = new Set<string>();
const urgent = new Set<string>();
const activeUrl = new Map<string, string>();

export type ExpandingCardArtworkPriority = "auto" | "high";

type AnimeArtworkIds = {
  kitsuId?: number;
  imdb?: string;
  tvdb?: number;
  tmdbMetaId?: string;
};

type SimklAnimeDetail = {
  ids?: {
    kitsu?: number | string;
    mal?: number;
    anidb?: number;
    imdb?: string;
    tvdb?: number;
    tmdb?: number;
  };
};

function rememberPrepared(key: string, url: string): void {
  prepared.delete(key);
  prepared.set(key, url);
  while (prepared.size > ARTWORK_CACHE_MAX) {
    const oldest = prepared.keys().next().value;
    if (typeof oldest !== "string") break;
    prepared.delete(oldest);
  }
}

function uniqueAlternatives(candidates: string[], current: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const alternative = current.every(
      (artwork) => pickAlternativeWideArtwork([candidate], artwork) === candidate,
    );
    const url = rewriteWideArtworkRung(candidate);
    if (!alternative || failed.has(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function reverseSimklKey(map: Record<string, number>, simklId: number): string | undefined {
  return Object.keys(map).find((key) => map[key] === simklId);
}

async function resolveAnimeArtworkIds(meta: Meta): Promise<AnimeArtworkIds> {
  let kitsuId = parseKitsuId(meta.id) ?? undefined;
  let imdb: string | undefined;
  let tvdb: number | undefined;
  let tmdbMetaId: string | undefined;
  let malId = meta.malId;
  let anidbId: number | undefined;

  const external = meta.id.match(/^(mal|anilist|anidb):(\d+)/);
  if (external) {
    const source = external[1];
    const id = Number(external[2]);
    if (source === "mal") malId = id;
    else if (source === "anidb") anidbId = id;
    if (!kitsuId) {
      kitsuId =
        (await externalToKitsu(source === "mal" ? "myanimelist" : source, id).catch(() => null)) ??
        undefined;
    }
  }

  const simklMatch = meta.id.match(/^simkl:(\d+)/);
  if (simklMatch) {
    const simklId = Number(simklMatch[1]);
    const cache = getLocalCache();
    if (cache) {
      const cachedKitsu = reverseSimklKey(cache.kitsuToSimkl, simklId);
      const cachedMal = reverseSimklKey(cache.malToSimkl, simklId);
      const cachedImdb = reverseSimklKey(cache.imdbToSimkl, simklId);
      const cachedTmdb = reverseSimklKey(cache.tmdbToSimkl, simklId);
      if (cachedKitsu) kitsuId = Number(cachedKitsu) || undefined;
      if (cachedMal) malId = Number(cachedMal) || undefined;
      if (cachedImdb) imdb = cachedImdb;
      if (cachedTmdb && /^(movie|tv):\d+$/.test(cachedTmdb)) {
        tmdbMetaId = `tmdb:${cachedTmdb}`;
      }
    }

    if (!kitsuId && !imdb && !tvdb && !tmdbMetaId) {
      const detail = await simklRequest<SimklAnimeDetail>(`/anime/${simklId}`, {
        method: "GET",
        authed: false,
      }).catch(() => null);
      const ids = detail?.ids;
      const detailKitsu = Number(ids?.kitsu);
      if (!kitsuId && Number.isFinite(detailKitsu) && detailKitsu > 0) kitsuId = detailKitsu;
      if (!malId && typeof ids?.mal === "number") malId = ids.mal;
      if (!anidbId && typeof ids?.anidb === "number") anidbId = ids.anidb;
      if (!imdb && typeof ids?.imdb === "string") imdb = ids.imdb;
      if (!tvdb && typeof ids?.tvdb === "number") tvdb = ids.tvdb;
      if (!tmdbMetaId && typeof ids?.tmdb === "number") {
        const kind = meta.type === "movie" ? "movie" : "tv";
        tmdbMetaId = `tmdb:${kind}:${ids.tmdb}`;
      }
    }
  }

  if (!kitsuId && malId) {
    kitsuId = (await externalToKitsu("myanimelist", malId).catch(() => null)) ?? undefined;
  }
  if (!kitsuId && anidbId) {
    kitsuId = (await externalToKitsu("anidb", anidbId).catch(() => null)) ?? undefined;
  }

  return { kitsuId, imdb, tvdb, tmdbMetaId };
}

async function loadWideArtwork(
  url: string,
  priority: ExpandingCardArtworkPriority,
): Promise<boolean> {
  if (decoded.has(url)) return true;
  const pending = decoding.get(url);
  if (pending) {
    if (priority === "high") pending.image.fetchPriority = "high";
    return pending.promise;
  }
  if (typeof Image === "undefined") return false;

  const image = new Image();
  const promise = new Promise<boolean>((resolve) => {
    image.decoding = "async";
    image.fetchPriority = priority;
    image.onload = () => {
      const finish = () => {
        const suitable = isSuitableWideArtworkSize(image.naturalWidth, image.naturalHeight);
        if (suitable) decoded.add(url);
        resolve(suitable);
      };
      if (typeof image.decode === "function") void image.decode().then(finish, finish);
      else finish();
    };
    image.onerror = () => resolve(false);
    image.src = url;
  }).finally(() => decoding.delete(url));

  decoding.set(url, { image, promise });
  return promise;
}

async function artworkCandidates(meta: Meta, tmdbKey: string): Promise<string[]> {
  const current = [meta.poster];

  if (/^(kitsu|mal|anilist|anidb|simkl):/.test(meta.id)) {
    const ids = await resolveAnimeArtworkIds(meta);
    const kind = meta.type === "movie" ? "movie" : "tv";
    let tmdbMetaId = ids.tmdbMetaId;
    if (!tmdbMetaId && tmdbKey) {
      const match = await tmdbAnimeMatch(tmdbKey, meta.name, meta.releaseInfo, kind).catch(
        () => null,
      );
      if (match) tmdbMetaId = `tmdb:${kind}:${match.id}`;
    }
    const [tmdbArtwork, tvdbArtwork] = await Promise.all([
      tmdbMetaId && tmdbKey
        ? tmdbMovieImages(tmdbKey, tmdbMetaId).catch(() => [])
        : Promise.resolve([]),
      fetchTvdbArtwork({
        series: ids.tvdb,
        kitsuId: ids.kitsuId,
        imdb: ids.imdb,
      }).catch(() => null),
    ]);
    const alternatives = uniqueAlternatives(
      [
        ...tmdbArtwork,
        ...(tvdbArtwork?.backgrounds ?? []),
        ...(meta.background ? [meta.background] : []),
      ],
      current,
    );
    if (alternatives.length > 0) return alternatives;
    const resolved = await resolveHeroBackdrop(tmdbKey, meta).catch(() => undefined);
    return uniqueAlternatives(resolved ? [resolved] : [], current);
  }

  const tmdbIdPromise = meta.id.startsWith("tmdb:")
    ? Promise.resolve(meta.id)
    : meta.id.startsWith("tt") && tmdbKey
      ? tmdbIdFromImdb(tmdbKey, meta.id, narrowMediaType(meta.type)).catch(() => null)
      : Promise.resolve(null);
  const tvdbPromise = meta.id.startsWith("tt")
    ? fetchTvdbArtwork({ imdb: meta.id }).catch(() => null)
    : Promise.resolve(null);
  const [tmdbId, tvdbArtwork] = await Promise.all([tmdbIdPromise, tvdbPromise]);
  const tmdbArtwork = tmdbId ? await tmdbMovieImages(tmdbKey, tmdbId).catch(() => []) : [];

  return uniqueAlternatives(
    [
      ...tmdbArtwork,
      ...(tvdbArtwork?.backgrounds ?? []),
      ...(meta.background ? [meta.background] : []),
    ],
    current,
  );
}

export function expandingCardArtworkKey(meta: Meta, tmdbKey: string): string {
  return `${meta.id}|${meta.type}|${tmdbKey}|${meta.background ?? ""}|${meta.poster ?? ""}`;
}

export function prepareExpandingCardArtwork(
  meta: Meta,
  tmdbKey: string,
  priority: ExpandingCardArtworkPriority = "auto",
): Promise<string | undefined> {
  const key = expandingCardArtworkKey(meta, tmdbKey);
  const cached = prepared.get(key);
  if (cached) return Promise.resolve(cached);
  if (priority === "high") {
    urgent.add(key);
    const url = activeUrl.get(key);
    const pending = url ? decoding.get(url) : undefined;
    if (pending) pending.image.fetchPriority = "high";
  }
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const tried = new Set<string>();
    const firstSuitable = async (candidates: string[]): Promise<string | undefined> => {
      for (const candidate of candidates) {
        if (tried.has(candidate)) continue;
        tried.add(candidate);
        activeUrl.set(key, candidate);
        if (await loadWideArtwork(candidate, urgent.has(key) ? "high" : "auto")) {
          rememberPrepared(key, candidate);
          return candidate;
        }
      }
      return undefined;
    };

    const immediate = uniqueAlternatives(meta.background ? [meta.background] : [], [meta.poster]);
    const preparedBackground = await firstSuitable(immediate);
    if (preparedBackground) return preparedBackground;

    const candidates = await artworkCandidates(meta, tmdbKey);
    return firstSuitable(candidates.slice(0, 8));
  })().finally(() => {
    inflight.delete(key);
    urgent.delete(key);
    activeUrl.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export function invalidateExpandingCardArtwork(key: string, url: string): void {
  if (prepared.get(key) === url) prepared.delete(key);
  decoded.delete(url);
  failed.add(url);
  while (failed.size > ARTWORK_CACHE_MAX) {
    const oldest = failed.values().next().value;
    if (typeof oldest !== "string") break;
    failed.delete(oldest);
  }
}
