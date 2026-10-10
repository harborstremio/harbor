import { aniZipByAnilist, aniZipByKitsu, type AniZipMapping } from "@/lib/providers/anizip";
import {
  externalToKitsu,
  imdbToKitsu,
  kitsuToAnilist,
  tmdbTvToKitsu,
} from "@/lib/providers/anime-mapping";
import { parseKitsuId } from "@/lib/providers/kitsu";
import {
  animeCoordPairs,
  findAnimeEntryNumber,
  type AnimeEpisodeCoords,
} from "@/lib/streams/anime-identity-core";

export type TrackerAnimeEntry = { id: string; episode: number; baseId: string };

export type TrackerEntryDeps = {
  baseKitsuId: (metaId: string) => Promise<number | null>;
  azByKitsu: (kitsuId: number) => Promise<AniZipMapping | null>;
  anilistOfKitsu: (kitsuId: number) => Promise<number | null>;
  sequels: (anilistId: number) => Promise<Array<{ id: number }>>;
  kitsuOfAnilist: (anilistId: number) => Promise<number | null>;
};

function catalogBaseKitsuId(metaId: string): Promise<number | null> {
  const direct = parseKitsuId(metaId);
  if (direct != null) return Promise.resolve(direct);
  if (metaId.startsWith("mal:")) {
    const n = Number(metaId.slice(4));
    return Number.isFinite(n)
      ? externalToKitsu("myanimelist", n).catch(() => null)
      : Promise.resolve(null);
  }
  if (metaId.startsWith("anilist:")) {
    const n = Number(metaId.slice(8));
    return Number.isFinite(n)
      ? externalToKitsu("anilist", n).catch(() => null)
      : Promise.resolve(null);
  }
  if (metaId.startsWith("anidb:")) {
    const n = Number(metaId.slice(6));
    return Number.isFinite(n)
      ? externalToKitsu("anidb", n).catch(() => null)
      : Promise.resolve(null);
  }
  if (/^tt\d+/.test(metaId)) return imdbToKitsu(metaId).catch(() => null);
  const tmdb = /^tmdb:tv:(\d+)/.exec(metaId);
  if (tmdb) return tmdbTvToKitsu(Number(tmdb[1])).catch(() => null);
  return Promise.resolve(null);
}

async function kitsuOfAnilist(anilistId: number): Promise<number | null> {
  const az = await aniZipByAnilist(anilistId).catch(() => null);
  if (typeof az?.mappings?.kitsu_id === "number") return az.mappings.kitsu_id;
  return externalToKitsu("anilist", anilistId).catch(() => null);
}

/** Highest provider season an AniZip entry covers; a flat entry covers season 1. */
function maxCoveredSeason(az: AniZipMapping | null): number {
  let max = 1;
  for (const m of Object.values(az?.episodes ?? {})) {
    if (typeof m.seasonNumber === "number" && m.seasonNumber > max) max = m.seasonNumber;
  }
  return max;
}

const DEFAULT_DEPS: TrackerEntryDeps = {
  baseKitsuId: catalogBaseKitsuId,
  azByKitsu: (kitsuId) => aniZipByKitsu(kitsuId).catch(() => null),
  anilistOfKitsu: (kitsuId) => kitsuToAnilist(kitsuId).catch(() => null),
  sequels: async (anilistId) => {
    // Browser-only AniList client, loaded lazily so this module stays testable.
    const { animeRelations } = await import("@/lib/anilist/relations");
    const relations = await animeRelations(anilistId).catch(() => []);
    return relations.filter((r) => r.kind === "sequel").map((r) => ({ id: r.id }));
  },
  kitsuOfAnilist: (anilistId) => kitsuOfAnilist(anilistId),
};

/**
 * Resolve the tracker entry that owns a row's episode. Newly aired
 * sequels/cours publish their AniZip/anime-lists mapping days after the episode,
 * so an IMDb/TMDB row mapped to its parent entry — or a Kitsu entry with no
 * cross-ids — resolves only to the earlier cour.
 *
 * This reproduces the row's own resolution first, then walks the franchise to
 * the cour that aired the requested provider season. The result carries the
 * chosen `id` plus the row's `baseId`, so a caller can tell "same entry" from
 * "later cour" and keep a stream-scoped cour as its own priority.
 */
export async function resolveTrackerAnimeEntry(
  metaId: string,
  coords: AnimeEpisodeCoords,
  overrides?: Partial<TrackerEntryDeps>,
): Promise<TrackerAnimeEntry | null> {
  const deps: TrackerEntryDeps = { ...DEFAULT_DEPS, ...overrides };
  const pairs = animeCoordPairs(coords);
  if (pairs.length === 0) return null;
  const [targetSeason, targetEpisode] = pairs[0];

  const baseKitsu = await deps.baseKitsuId(metaId);
  if (baseKitsu == null) return null;
  const baseId = `kitsu:${baseKitsu}`;

  const baseAz = await deps.azByKitsu(baseKitsu);
  const direct = findAnimeEntryNumber(baseAz, pairs);
  if (direct != null) return { id: baseId, episode: direct, baseId };

  // Only a provider season past what the mapped entry covers can be a sequel.
  // An earlier or already-covered season is left to the caller's fallbacks.
  const hop = targetSeason - maxCoveredSeason(baseAz);
  if (hop < 1) return null;

  const baseAnilist = await deps.anilistOfKitsu(baseKitsu);
  if (baseAnilist == null) return null;
  const sequels = await deps.sequels(baseAnilist);
  const target = sequels[hop - 1];
  if (!target) return null;

  const seqKitsu = await deps.kitsuOfAnilist(target.id);
  if (seqKitsu != null) {
    const seqAz = await deps.azByKitsu(seqKitsu);
    const number = findAnimeEntryNumber(seqAz, pairs) ?? targetEpisode;
    return { id: `kitsu:${seqKitsu}`, episode: number, baseId };
  }
  // AniList keeps the sequel even when no Kitsu/cross mapping exists yet.
  return { id: `anilist:${target.id}`, episode: targetEpisode, baseId };
}
