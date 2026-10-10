import {
  aniZipByAnidb,
  aniZipByAnilist,
  aniZipByImdb,
  aniZipByKitsu,
  aniZipByMal,
  aniZipByTmdbTv,
  type AniZipMapping,
} from "@/lib/providers/anizip";

export type AnimeNumberingMode = "longRunning" | "seasonal";

/**
 * Subtitle search coordinates for one anime episode. Long-running shows
 * (One Piece) are indexed by absolute episode number on subtitle sites and
 * must be searched without a season; seasonal shows (Re:Zero) are indexed by
 * season + within-season episode.
 */
export type AnimeSearchCoords = {
  mode: AnimeNumberingMode;
  season?: number;
  episode?: number;
};

export type AnimeEpisodeCoords = {
  season?: number | null;
  episode?: number | null;
  imdbSeason?: number | null;
  imdbEpisode?: number | null;
  absoluteNumber?: number | null;
};

const posInt = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * AniZip keys episodes by entry-relative number. A single entry spanning two
 * or more non-special provider seasons is a continuous long-running list;
 * one entry per cour (distinct count of 1) follows per-season numbering.
 * Entries without usable season data return null so callers keep their
 * previous behavior.
 */
export function classifyAnimeNumbering(
  az: AniZipMapping | null | undefined,
): AnimeNumberingMode | null {
  const seasons = new Set<number>();
  for (const ep of Object.values(az?.episodes ?? {})) {
    if (!posInt(ep?.seasonNumber)) continue;
    seasons.add(ep.seasonNumber);
    if (seasons.size >= 2) return "longRunning";
  }
  return seasons.size === 1 ? "seasonal" : null;
}

function providerPairOf(
  az: AniZipMapping | null | undefined,
  entryEpisode: number | null,
): { season: number | null; episode: number | null } {
  const rec = entryEpisode != null ? az?.episodes?.[String(entryEpisode)] : undefined;
  return posInt(rec?.seasonNumber) && posInt(rec?.episodeNumber)
    ? { season: rec.seasonNumber, episode: rec.episodeNumber }
    : { season: null, episode: null };
}

/**
 * Resolve search coordinates from an AniZip mapping. Returns null whenever
 * the mapping cannot answer so callers fall back to their previous logic.
 */
export function animeSearchCoordsFromMapping(
  az: AniZipMapping | null | undefined,
  ep: AnimeEpisodeCoords | null | undefined,
): AnimeSearchCoords | null {
  const mode = classifyAnimeNumbering(az);
  if (!mode) return null;
  const entryEpisode = posInt(ep?.episode) ? ep!.episode : null;

  if (mode === "longRunning") {
    // Entry-relative numbers ARE absolute numbers for these entries.
    const absolute = entryEpisode ?? (posInt(ep?.absoluteNumber) ? ep!.absoluteNumber : null);
    if (!posInt(absolute)) return null;
    return { mode, episode: absolute! };
  }

  const fromRecord = providerPairOf(az, entryEpisode);
  const season = fromRecord.season ?? (posInt(ep?.imdbSeason) ? ep!.imdbSeason : null);
  const episode = fromRecord.episode ?? (posInt(ep?.imdbEpisode) ? ep!.imdbEpisode : null);
  if (!posInt(season) || !posInt(episode)) return null;
  return { mode, season: season!, episode: episode! };
}

async function mappingForMetaId(metaId: string | null | undefined): Promise<AniZipMapping | null> {
  const anime = /^(kitsu|mal|anilist|anidb):(\d+)/.exec(metaId ?? "");
  if (anime) {
    const n = Number(anime[2]);
    return anime[1] === "kitsu"
      ? aniZipByKitsu(n)
      : anime[1] === "anilist"
        ? aniZipByAnilist(n)
        : anime[1] === "mal"
          ? aniZipByMal(n)
          : aniZipByAnidb(n);
  }
  const tv = /^tmdb:tv:(\d+)/.exec(metaId ?? "");
  if (tv) return aniZipByTmdbTv(Number(tv[1]));
  return null;
}

/**
 * Look up the playing entry on AniZip and derive which coordinates subtitle
 * providers should be queried with. Non-anime content and any lookup failure
 * resolve to null (callers keep their previous behavior).
 */
export async function resolveAnimeSearchCoords(params: {
  isAnime: boolean;
  metaId?: string | null;
  imdbId?: string | null;
  imdbVerified?: boolean;
  episode?: AnimeEpisodeCoords | null;
}): Promise<AnimeSearchCoords | null> {
  if (!params.isAnime) return null;
  const ep = params.episode;
  if (!ep || !posInt(ep.episode)) return null;
  let az = await mappingForMetaId(params.metaId).catch(() => null);
  if (!az && params.imdbVerified && /^tt\d+/.test(params.imdbId ?? "")) {
    az = await aniZipByImdb(params.imdbId!).catch(() => null);
  }
  if (!az) return null;
  return animeSearchCoordsFromMapping(az, ep);
}
