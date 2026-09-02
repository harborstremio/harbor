import { aniZipByKitsu } from "@/lib/providers/anizip";
import {
  externalToKitsu,
  findSiblingAnidbEntries,
  imdbToKitsu,
  kitsuToAnidb,
  loadAnidbMaps,
  tmdbTvToKitsu,
} from "@/lib/providers/anime-mapping";
import { franchiseRoot } from "@/lib/providers/anime-franchise-root";
import type { PlayEpisode } from "@/lib/view";
import {
  animeAbsoluteFromScopedId,
  animeCoordPairs,
  findAnimeEntryNumber,
  isScopedSplitFranchiseRoot,
  type AnimeEpisodeCoords,
} from "./anime-identity-core";
import { buildStreamIds } from "./stream-ids";
import { dlog } from "@/lib/debug";

const ANIME_META_RX = /^(kitsu|mal|anilist|anidb):(\d+)/;

export type AnimeStreamIdentity = { streamId: string; kitsuId: number; number: number };

async function baseKitsuId(metaId: string): Promise<number | null> {
  const match = ANIME_META_RX.exec(metaId);
  if (match) {
    if (match[1] === "kitsu") return Number(match[2]);
    if (match[1] === "mal")
      return externalToKitsu("myanimelist", Number(match[2])).catch(() => null);
    return externalToKitsu(match[1], Number(match[2])).catch(() => null);
  }
  if (/^tt\d+/.test(metaId)) return imdbToKitsu(metaId).catch(() => null);
  const tmdb = /^tmdb:tv:(\d+)/.exec(metaId);
  if (tmdb) return tmdbTvToKitsu(Number(tmdb[1])).catch(() => null);
  return null;
}

/**
 * True when a stream query for this meta/episode should attempt kitsu identity
 * resolution: non-anime-native ids opened with an episode that carries no
 * kitsu stream id of its own. Specials (season 0) stay on legacy paths.
 */
export function animeIdentityEligible(
  metaId: string,
  episode: PlayEpisode | null | undefined,
): boolean {
  if (!episode) return false;
  if (episode.kitsuStreamId != null) return false;
  if (ANIME_META_RX.test(metaId)) {
    return typeof episode.imdbSeason === "number" && episode.imdbSeason >= 1;
  }
  if (!(metaId.startsWith("tt") || metaId.startsWith("tmdb:tv:"))) return false;
  const season = episode.imdbSeason ?? episode.season;
  return typeof season === "number" && season >= 1;
}

const identityCache = new Map<string, Promise<AnimeStreamIdentity | null>>();
const IDENTITY_CACHE_MAX = 400;

async function resolveViaSiblingEntry(
  kitsuId: number,
  az: Awaited<ReturnType<typeof aniZipByKitsu>>,
  pairs: Array<[number, number]>,
): Promise<AnimeStreamIdentity | null> {
  const season = pairs[0][0];
  const attempts: Array<{ provider: "tvdb" | "imdb"; id: string }> = [];
  const tvdbId = az?.mappings?.thetvdb_id;
  if (tvdbId) attempts.push({ provider: "tvdb", id: String(tvdbId) });
  const imdbId = az?.mappings?.imdb_id ?? null;
  if (imdbId) attempts.push({ provider: "imdb", id: imdbId });
  if (attempts.length === 0) return null;
  const myAnidb = await kitsuToAnidb(kitsuId).catch(() => null);
  for (const attempt of attempts) {
    const siblings = await findSiblingAnidbEntries(
      attempt.provider,
      attempt.id,
      season,
      myAnidb,
    ).catch(() => []);
    if (siblings.length === 0) continue;
    dlog(
      `[anime-identity] season ${season} not on base entry — trying ${siblings.length} sibling(s) via ${attempt.provider}:${attempt.id}`,
    );
    for (const anidb of siblings.slice(0, 4)) {
      const siblingKitsu = await externalToKitsu("anidb", anidb).catch(() => null);
      if (!siblingKitsu || siblingKitsu === kitsuId) continue;
      const siblingAz = await aniZipByKitsu(siblingKitsu).catch(() => null);
      const number = findAnimeEntryNumber(siblingAz, pairs);
      if (number != null) {
        return { streamId: `kitsu:${siblingKitsu}:${number}`, kitsuId: siblingKitsu, number };
      }
    }
  }
  return null;
}

async function resolveTask(
  metaId: string,
  imdbId: string | null,
  coords: AnimeEpisodeCoords,
): Promise<AnimeStreamIdentity | null> {
  let kitsuId = await baseKitsuId(metaId);
  if (kitsuId == null && imdbId && /^tt\d+/.test(imdbId) && !metaId.startsWith("tt")) {
    kitsuId = await imdbToKitsu(imdbId).catch(() => null);
  }
  if (kitsuId == null) return null;
  const pairs = animeCoordPairs(coords);
  if (pairs.length === 0) return null;
  const az = await aniZipByKitsu(kitsuId).catch(() => null);
  const number = findAnimeEntryNumber(az, pairs);
  if (number != null) return { streamId: `kitsu:${kitsuId}:${number}`, kitsuId, number };
  return resolveViaSiblingEntry(kitsuId, az, pairs);
}

export function resolveAnimeIdentity(
  metaId: string,
  imdbId: string | null,
  episode: AnimeEpisodeCoords | null | undefined,
): Promise<AnimeStreamIdentity | null> {
  const pairs = animeCoordPairs(episode);
  if (pairs.length === 0) return Promise.resolve(null);
  const key = `${metaId}|${imdbId ?? ""}|${pairs.map((p) => p.join(":")).join("|")}`;
  const hit = identityCache.get(key);
  if (hit) return hit;
  const task = resolveTask(metaId, imdbId, episode ?? {});
  if (identityCache.size >= IDENTITY_CACHE_MAX) identityCache.clear();
  identityCache.set(key, task);
  return task;
}

/**
 * Provider seasons that belong to a *different* AniDB entry sharing this
 * series' provider id — e.g. Bleach TYBW folded into Bleach (2004) as S17.
 * Returns null when the title isn't a resolvable anime or no foreign seasons
 * were found, so callers can treat the result as "no filtering".
 */
export async function foreignAnimeProviderSeasons(
  metaId: string,
  imdbFallbackId: string | null,
): Promise<Set<number> | null> {
  try {
    let kitsuId = await baseKitsuId(metaId);
    if (
      kitsuId == null &&
      imdbFallbackId &&
      /^tt\d+$/.test(imdbFallbackId) &&
      !metaId.startsWith("tt")
    ) {
      kitsuId = await imdbToKitsu(imdbFallbackId).catch(() => null);
    }
    if (kitsuId == null) return null;
    const az = await aniZipByKitsu(kitsuId).catch(() => null);
    if (!az?.mappings) return null;
    // Scoped rollout: only franchises in the allowlist get foreign-season
    // handling; every other title keeps stock behavior.
    const rootKitsu = await franchiseRoot(`kitsu:${kitsuId}`)
      .then((r) => {
        const m = /^kitsu:(\d+)$/.exec(r);
        return m ? Number(m[1]) : null;
      })
      .catch(() => null);
    if (!isScopedSplitFranchiseRoot(rootKitsu)) return null;
    const covered = new Set<number>();
    for (const m of Object.values(az.episodes ?? {})) {
      if (typeof m.seasonNumber === "number" && m.seasonNumber >= 1) covered.add(m.seasonNumber);
    }
    const foreign = new Set<number>();
    const tvdbId = az.mappings.thetvdb_id;
    const imdbId = az.mappings.imdb_id;
    if (!tvdbId && !imdbId) return null;
    const maps = await loadAnidbMaps();
    if (tvdbId) {
      for (const w of maps.byTvdb?.[String(tvdbId)] ?? []) {
        if (typeof w.season === "number") foreign.add(w.season);
      }
    }
    if (imdbId) {
      for (const w of maps.byImdb?.[imdbId] ?? []) {
        if (typeof w.season === "number") foreign.add(w.season);
      }
    }
    for (const s of covered) foreign.delete(s);
    return foreign.size > 0 ? foreign : null;
  } catch {
    return null;
  }
}

/**
 * Legacy id list augmented with a resolved `kitsu:{entry}:{n}` query for
 * tt/tmdb-opened anime. The resolved id goes first; addons pick ids by their
 * own manifest prefixes, so tt-only addons still receive the legacy ids.
 */
export function animeAbsoluteFromStreamIds(ids: string[] | null | undefined): number | null {
  if (!ids) return null;
  for (const id of ids) {
    const n = animeAbsoluteFromScopedId(id);
    if (n != null) return n;
  }
  return null;
}

export async function buildStreamIdsWithIdentity(
  metaId: string,
  episode: PlayEpisode | undefined,
  imdbId: string | null,
  defaultVideoId?: string | null,
): Promise<string[]> {
  const base = buildStreamIds(metaId, episode, imdbId, defaultVideoId);
  if (!animeIdentityEligible(metaId, episode)) return base;
  const identity = await resolveAnimeIdentity(metaId, imdbId, episode);
  if (!identity || base[0] === identity.streamId) return base;
  return [identity.streamId, ...base.filter((id) => id !== identity.streamId)];
}
