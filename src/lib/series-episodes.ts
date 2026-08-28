import { lruSet } from "@/lib/cache";
import { registerCache } from "@/lib/memory-profiler";
import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { Meta } from "./cinemeta";
import type { PlayEpisode } from "./view";
import { tmdbDetails, tmdbSeasonEpisodes } from "./providers/tmdb";
import { resolveMeta } from "./meta-resource";
import { animeKitsuMeta } from "./providers/anime-kitsu-addon";
import { externalToKitsu, kitsuToAnilist } from "./providers/anime-mapping";
import { parseKitsuId } from "./providers/kitsu";
import { aniZipByAnilist, aniZipByKitsu, pickEpisodeTitle } from "./providers/anizip";
import { fetchTvdbProxyImages, pickTvdbImage } from "./providers/tvdb-proxy";
import { franchiseRoot } from "./providers/anime-franchise-root";
import { foreignAnimeProviderSeasons } from "./streams/anime-identity";

async function filterForeignAnimeSeasons(
  metaId: string,
  imdbId: string | null,
  nums: number[],
): Promise<number[]> {
  try {
    const foreign = await foreignAnimeProviderSeasons(metaId, imdbId);
    if (!foreign) return nums;
    const out = nums.filter((n) => !foreign.has(n));
    return out.length > 0 ? out : nums;
  } catch {
    return nums;
  }
}

export function isAnimeId(id: string): boolean {
  return (
    id.startsWith("kitsu:") ||
    id.startsWith("mal:") ||
    id.startsWith("anilist:") ||
    id.startsWith("anidb:")
  );
}

export function animeSeriesFromStreamId(streamId: string | undefined): string | null {
  if (!streamId) return null;
  const m = /^(kitsu|mal|anilist|anidb):(\d+):/.exec(streamId);
  return m ? `${m[1]}:${m[2]}` : null;
}

async function resolveAnimeKitsuId(id: string): Promise<number | null> {
  const direct = parseKitsuId(id);
  if (direct != null) return direct;
  const ext: Array<[string, string]> = [
    ["mal:", "myanimelist"],
    ["anilist:", "anilist"],
    ["anidb:", "anidb"],
  ];
  for (const [prefix, source] of ext) {
    if (id.startsWith(prefix)) {
      const n = parseInt(id.slice(prefix.length), 10);
      return Number.isFinite(n) ? externalToKitsu(source, n) : null;
    }
  }
  return null;
}

async function getAnimeEpisodes(id: string): Promise<PlayEpisode[] | null> {
  const cacheKey = `anime:${id}`;
  if (addonEpsCache.has(cacheKey)) return addonEpsCache.get(cacheKey)!;
  const kitsuId = await resolveAnimeKitsuId(id).catch(() => null);
  if (kitsuId == null) return null;
  const addonMeta = await animeKitsuMeta(`kitsu:${kitsuId}`).catch(() => null);
  const raw = addonMeta?.videos ?? [];
  const eps: PlayEpisode[] = [];
  for (const v of raw) {
    if (!Number.isFinite(v.episode)) continue;
    const season = v.season >= 0 ? v.season : 1;
    const ep: PlayEpisode = {
      season,
      episode: v.episode,
      name: v.title || undefined,
      still: v.thumbnail ?? undefined,
      overview: v.overview ?? undefined,
      airDate: v.released,
    };
    if (v.id) ep.kitsuStreamId = v.id;
    if (v.imdb_id ?? addonMeta?.imdb_id) ep.imdbId = v.imdb_id ?? addonMeta?.imdb_id;
    if (v.imdbSeason != null) ep.imdbSeason = v.imdbSeason;
    if (v.imdbEpisode != null) ep.imdbEpisode = v.imdbEpisode;
    eps.push(ep);
  }
  if (eps.length === 0) return null;

  const distinctReleased = new Set(eps.map((e) => e.airDate).filter(Boolean));
  const bogusAirdates = eps.length > 1 && distinctReleased.size <= 1;
  if (bogusAirdates) for (const ep of eps) ep.airDate = undefined;

  const seriesImdb = addonMeta?.imdb_id ?? eps.find((e) => e.imdbId)?.imdbId ?? undefined;
  const rootId = await franchiseRoot(id).catch(() => id);
  const rootKitsu = parseKitsuId(rootId) ?? kitsuId;
  let az = await aniZipByKitsu(kitsuId).catch(() => null);
  if (!az?.mappings?.thetvdb_id) {
    const anilistId = await kitsuToAnilist(kitsuId).catch(() => null);
    if (anilistId != null) {
      const alt = await aniZipByAnilist(anilistId).catch(() => null);
      if (alt?.mappings?.thetvdb_id || (alt?.episodes && !az?.episodes)) az = alt;
    }
  }
  const tvdbImages = await fetchTvdbProxyImages({
    series: az?.mappings?.thetvdb_id,
    kitsuId: rootKitsu,
    imdb: seriesImdb ?? az?.mappings?.imdb_id,
  }).catch(() => ({}) as Record<string, string>);
  if (az?.episodes) {
    for (const ep of eps) {
      const m = az.episodes[String(ep.episode)];
      if (!m) continue;
      if (ep.imdbSeason == null && m.seasonNumber != null && m.seasonNumber >= 1) {
        ep.imdbSeason = m.seasonNumber;
      }
      if (ep.imdbEpisode == null && m.episodeNumber != null) ep.imdbEpisode = m.episodeNumber;
      if (ep.absoluteNumber == null && m.absoluteEpisodeNumber)
        ep.absoluteNumber = m.absoluteEpisodeNumber;
      if (ep.tvdbEpisodeId == null && m.tvdbId) ep.tvdbEpisodeId = m.tvdbId;
      const air = m.airDateUtc ?? m.airDate;
      if (air && (!ep.airDate || bogusAirdates)) ep.airDate = air;
      if (!ep.overview && m.overview) ep.overview = m.overview;
      if (!ep.name) ep.name = pickEpisodeTitle(m) ?? undefined;
      if (!ep.still && m.image) ep.still = m.image;
      if (ep.runtime == null && m.runtime && m.runtime > 0) ep.runtime = m.runtime;
      if (ep.rating == null && m.rating) {
        const r = Number(m.rating);
        if (Number.isFinite(r) && r > 0) ep.rating = r;
      }
    }
  }
  if (Object.keys(tvdbImages).length > 0) {
    for (const ep of eps) {
      const img = pickTvdbImage(tvdbImages, {
        number: ep.episode,
        seasonNumber: ep.season,
        imdbSeason: ep.imdbSeason,
        imdbEpisode: ep.imdbEpisode,
      });
      if (img) ep.still = img;
    }
  }
  eps.sort((a, b) => a.season - b.season || a.episode - b.episode);
  lruSet(addonEpsCache, cacheKey, eps, SEASON_CACHE_MAX);
  return eps;
}

async function getNonStandardEpisodes(meta: Meta): Promise<PlayEpisode[] | null> {
  if (isAnimeId(meta.id)) {
    const anime = await getAnimeEpisodes(meta.id);
    if (anime) return anime;
  }
  return getAddonEpisodes(meta.id);
}

type Adjacent = { prev: PlayEpisode | null; next: PlayEpisode | null };

const TT_CACHE_MAX = 800;
const SEASON_CACHE_MAX = 400;
const ttCache = new Map<string, Adjacent>();
const tmdbSeasonCache = new Map<string, PlayEpisode[]>();
const addonEpsCache = new Map<string, PlayEpisode[]>();
const cinemetaListCache = new Map<string, PlayEpisode[]>();

registerCache("episodes:tt", () => ttCache.size);
registerCache("episodes:tmdbSeason", () => tmdbSeasonCache.size);
registerCache("episodes:addon", () => addonEpsCache.size);
registerCache("episodes:cinemetaList", () => cinemetaListCache.size);

function readAuthKey(): string | null {
  try {
    const raw = localStorage.getItem("harbor.auth");
    return raw ? ((JSON.parse(raw) as { authKey?: string }).authKey ?? null) : null;
  } catch {
    return null;
  }
}

async function getAddonEpisodes(id: string): Promise<PlayEpisode[] | null> {
  if (addonEpsCache.has(id)) return addonEpsCache.get(id)!;
  const m = await resolveMeta(readAuthKey(), "series", id).catch(() => null);
  const raw = m?.videos ?? [];
  const eps: PlayEpisode[] = [];
  for (const v of raw) {
    const season = typeof v.season === "number" ? v.season : null;
    const episode =
      typeof v.episode === "number" ? v.episode : typeof v.number === "number" ? v.number : null;
    if (season == null || episode == null || season < 1) continue;
    const ep: PlayEpisode = {
      season,
      episode,
      name: v.title || v.name || undefined,
      still: v.thumbnail,
    };
    const vid = (v as { id?: string }).id;
    if (vid && (vid.startsWith("kitsu:") || vid.startsWith("mal:"))) ep.kitsuStreamId = vid;
    else if (vid) ep.videoId = vid;
    eps.push(ep);
  }
  if (eps.length === 0) return null;
  eps.sort((a, b) => a.season - b.season || a.episode - b.episode);
  lruSet(addonEpsCache, id, eps, SEASON_CACHE_MAX);
  return eps;
}

export async function fetchAdjacentEpisodes(
  meta: Meta,
  current: { season: number; episode: number },
  opts: {
    tmdbKey: string;
    kitsuStreamId?: string;
    skip?: (season: number, episode: number) => boolean;
  },
): Promise<Adjacent> {
  const animeSeries = animeSeriesFromStreamId(opts.kitsuStreamId);
  if (animeSeries) {
    const eps = await getAnimeEpisodes(animeSeries);
    if (eps) return computeAdjacent(eps, current, opts.skip);
  }

  if (meta.type !== "series" && !isAnimeId(meta.id)) return { prev: null, next: null };

  if (meta.id.startsWith("tt")) {
    const key = `${meta.id}:${current.season}:${current.episode}`;
    if (ttCache.has(key)) return ttCache.get(key)!;
    const eps = await loadCinemetaEpisodes(meta.id);
    if (!eps) return { prev: null, next: null };
    const result = computeAdjacent(eps, current, opts.skip);
    lruSet(ttCache, key, result, TT_CACHE_MAX);
    return result;
  }

  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const tvId = parseInt(meta.id.split(":")[2] ?? "", 10);
    if (!Number.isFinite(tvId)) return { prev: null, next: null };
    return tmdbAdjacent(opts.tmdbKey, tvId, current, opts.skip);
  }

  const eps = await getNonStandardEpisodes(meta);
  if (!eps) return { prev: null, next: null };
  return computeAdjacent(eps, current, opts.skip);
}

export async function fetchUpcomingEpisodes(
  meta: Meta,
  current: { season: number; episode: number },
  count: number,
  opts: { tmdbKey: string },
): Promise<PlayEpisode[]> {
  if ((meta.type !== "series" && !isAnimeId(meta.id)) || count <= 0) return [];
  if (meta.id.startsWith("tt")) {
    const eps = await loadCinemetaEpisodes(meta.id);
    if (!eps) return [];
    const idx = eps.findIndex((v) => v.season === current.season && v.episode === current.episode);
    if (idx === -1) return eps.slice(0, count);
    return eps.slice(idx + 1, idx + 1 + count);
  }
  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const tvId = parseInt(meta.id.split(":")[2] ?? "", 10);
    if (!Number.isFinite(tvId)) return [];
    const out: PlayEpisode[] = [];
    let season = current.season;
    let cursor = current.episode;
    while (out.length < count && season <= current.season + 3) {
      const eps = await tmdbSeason(opts.tmdbKey, tvId, season);
      const start = season === current.season ? eps.findIndex((e) => e.episode === cursor) + 1 : 0;
      if (start < 0) break;
      for (let i = start; i < eps.length && out.length < count; i++) out.push(eps[i]);
      season += 1;
      cursor = 0;
    }
    return out;
  }
  const eps = await getNonStandardEpisodes(meta);
  if (!eps) return [];
  const idx = eps.findIndex((v) => v.season === current.season && v.episode === current.episode);
  if (idx === -1) return eps.slice(0, count);
  return eps.slice(idx + 1, idx + 1 + count);
}

async function loadCinemetaEpisodes(id: string): Promise<PlayEpisode[] | null> {
  if (cinemetaListCache.has(id)) return cinemetaListCache.get(id)!;
  const res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${id}.json`);
  if (!res.ok) return null;
  const json = await res.json();
  const raw = (json?.meta?.videos ?? []) as Array<{
    season?: number;
    episode?: number;
    number?: number;
    title?: string;
    name?: string;
    thumbnail?: string;
    overview?: string;
    description?: string;
    released?: string;
    firstAired?: string;
  }>;
  const eps: PlayEpisode[] = [];
  for (const v of raw) {
    const season = typeof v.season === "number" ? v.season : null;
    const episode =
      typeof v.episode === "number" ? v.episode : typeof v.number === "number" ? v.number : null;
    if (season == null || episode == null) continue;
    if (season < 1) continue;
    eps.push({
      season,
      episode,
      name: v.title || v.name || undefined,
      still: v.thumbnail,
      overview: v.overview || v.description,
      airDate: v.released || v.firstAired,
    });
  }
  eps.sort((a, b) => a.season - b.season || a.episode - b.episode);
  lruSet(cinemetaListCache, id, eps, SEASON_CACHE_MAX);
  return eps;
}

function uniqueSeasons(eps: PlayEpisode[] | null): number[] {
  if (!eps) return [];
  const set = new Set<number>();
  for (const e of eps) if (e.season >= 1) set.add(e.season);
  return [...set].sort((a, b) => a - b);
}

function animeSeasonKey(e: PlayEpisode): number {
  if (e.imdbSeason === 0) return 0;
  return e.imdbSeason != null && e.imdbSeason >= 1 ? e.imdbSeason : e.season;
}

function uniqueAnimeSeasons(eps: PlayEpisode[] | null): number[] {
  if (!eps) return [];
  const set = new Set<number>();
  for (const e of eps) {
    const s = animeSeasonKey(e);
    if (s >= 1) set.add(s);
  }
  return [...set].sort((a, b) => a - b);
}

export async function fetchSeasonList(meta: Meta, opts: { tmdbKey: string }): Promise<number[]> {
  if (meta.type !== "series" && !isAnimeId(meta.id)) return [];
  if (meta.id.startsWith("tt")) {
    const nums = uniqueSeasons(await loadCinemetaEpisodes(meta.id));
    return filterForeignAnimeSeasons(meta.id, meta.id, nums);
  }
  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const detail = await tmdbDetails(opts.tmdbKey, meta).catch(() => null);
    const nums = (detail?.seasons ?? []).map((s) => s.seasonNumber).filter((n) => n >= 1);
    const deduped = [...new Set(nums)].sort((a, b) => a - b);
    return filterForeignAnimeSeasons(meta.id, null, deduped);
  }
  return uniqueAnimeSeasons(await getNonStandardEpisodes(meta));
}

export async function fetchSeasonEpisodes(
  meta: Meta,
  season: number,
  opts: { tmdbKey: string },
): Promise<PlayEpisode[]> {
  if ((meta.type !== "series" && !isAnimeId(meta.id)) || season < 1) return [];
  if (meta.id.startsWith("tt")) {
    const eps = await loadCinemetaEpisodes(meta.id);
    return (eps ?? []).filter((e) => e.season === season);
  }
  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const tvId = parseInt(meta.id.split(":")[2] ?? "", 10);
    if (!Number.isFinite(tvId)) return [];
    return tmdbSeason(opts.tmdbKey, tvId, season);
  }
  const eps = await getNonStandardEpisodes(meta);
  return (eps ?? []).filter((e) => animeSeasonKey(e) === season);
}

export async function fetchEpisodeList(
  meta: Meta,
  opts: { tmdbKey: string },
): Promise<PlayEpisode[]> {
  if (meta.type !== "series" && !isAnimeId(meta.id)) return [];
  if (meta.id.startsWith("tt")) return (await loadCinemetaEpisodes(meta.id)) ?? [];
  if (meta.id.startsWith("tmdb:tv:") && opts.tmdbKey) {
    const seasons = await fetchSeasonList(meta, opts);
    const all: PlayEpisode[] = [];
    for (const s of seasons) all.push(...(await fetchSeasonEpisodes(meta, s, opts)));
    return all;
  }
  return (await getNonStandardEpisodes(meta)) ?? [];
}

export function nextUnwatchedAfter(
  eps: PlayEpisode[],
  from: { season: number; episode: number },
  isWatched: (season: number, episode: number) => boolean,
  skip?: (season: number, episode: number) => boolean,
): PlayEpisode | null {
  const sorted = eps
    .filter((e) => e.season >= 1)
    .slice()
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
  let idx = sorted.findIndex((e) => e.season === from.season && e.episode === from.episode);
  if (idx < 0) idx = 0;
  for (let i = idx; i < sorted.length; i++) {
    if (skip?.(sorted[i].season, sorted[i].episode)) continue;
    if (!isWatched(sorted[i].season, sorted[i].episode)) return sorted[i];
  }
  return null;
}

function computeAdjacent(
  eps: PlayEpisode[],
  current: { season: number; episode: number },
  skip?: (season: number, episode: number) => boolean,
): Adjacent {
  const idx = eps.findIndex((v) => v.season === current.season && v.episode === current.episode);
  if (idx === -1) return { prev: null, next: null };
  let prev: PlayEpisode | null = null;
  let next: PlayEpisode | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (skip?.(eps[i].season, eps[i].episode)) continue;
    prev = eps[i];
    break;
  }
  for (let i = idx + 1; i < eps.length; i++) {
    if (skip?.(eps[i].season, eps[i].episode)) continue;
    next = eps[i];
    break;
  }
  return { prev, next };
}

async function tmdbSeason(key: string, tvId: number, season: number): Promise<PlayEpisode[]> {
  const cacheKey = `${key}:${tvId}:${season}`;
  if (tmdbSeasonCache.has(cacheKey)) return tmdbSeasonCache.get(cacheKey)!;
  if (season < 1) return [];
  const raw = await tmdbSeasonEpisodes(key, tvId, season);
  const eps: PlayEpisode[] = raw
    .map((e) => ({
      season: e.seasonNumber,
      episode: e.episodeNumber,
      name: e.name || undefined,
      still: e.stillPath ? `https://image.tmdb.org/t/p/w300${e.stillPath}` : undefined,
      overview: e.overview || undefined,
      rating: e.voteAverage && e.voteAverage > 0 ? e.voteAverage : undefined,
      airDate: e.airDate || undefined,
      runtime: e.runtime && e.runtime > 0 ? e.runtime : undefined,
    }))
    .sort((a, b) => a.episode - b.episode);
  lruSet(tmdbSeasonCache, cacheKey, eps, SEASON_CACHE_MAX);
  return eps;
}

async function tmdbAdjacent(
  key: string,
  tvId: number,
  current: { season: number; episode: number },
  skip?: (season: number, episode: number) => boolean,
): Promise<Adjacent> {
  const cur = await tmdbSeason(key, tvId, current.season);
  const idx = cur.findIndex((e) => e.episode === current.episode);
  let prev: PlayEpisode | null = null;
  let next: PlayEpisode | null = null;
  if (idx >= 0) {
    for (let i = idx - 1; i >= 0; i--) {
      if (skip?.(cur[i].season, cur[i].episode)) continue;
      prev = cur[i];
      break;
    }
    for (let i = idx + 1; i < cur.length; i++) {
      if (skip?.(cur[i].season, cur[i].episode)) continue;
      next = cur[i];
      break;
    }
  }
  if (!prev && current.season > 1) {
    const before = await tmdbSeason(key, tvId, current.season - 1);
    for (let i = before.length - 1; i >= 0; i--) {
      if (skip?.(before[i].season, before[i].episode)) continue;
      prev = before[i];
      break;
    }
  }
  if (!next) {
    const after = await tmdbSeason(key, tvId, current.season + 1);
    for (let i = 0; i < after.length; i++) {
      if (skip?.(after[i].season, after[i].episode)) continue;
      next = after[i];
      break;
    }
  }
  return { prev, next };
}
