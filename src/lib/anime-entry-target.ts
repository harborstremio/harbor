import { aniZipByKitsu, type AniZipMapping } from "@/lib/providers/anizip";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { animeIdentityEligible, resolveAnimeIdentity } from "@/lib/streams/anime-identity";

/** A displayed anime row resolved to its tracker entry and the episode number inside that entry. */
export type AnimeEntryTarget = { kitsuId: number; number: number };

const KITSU_STREAM = /^kitsu:(\d+):(\d+)$/;

function numberedEpisodes(az: AniZipMapping | null | undefined) {
  return Object.entries(az?.episodes ?? {}).filter(([k]) => /^\d+$/.test(k));
}

// One entry spanning several TVDB seasons (Reborn, One Piece) counts episodes in TVDB absolute
// order. AniZip's absolute numbers agree with TVDB, but its keys drift around unmapped episodes.
function spansSeasons(az: AniZipMapping | null | undefined): boolean {
  const seasons = new Set(numberedEpisodes(az).map(([, m]) => m.seasonNumber));
  seasons.delete(undefined);
  seasons.delete(0);
  return seasons.size >= 2;
}

/** Entry episode number → TVDB "season:episode", using absolute order for multi-season entries. */
export function entryTvdbPairs(az: AniZipMapping | null | undefined): Map<number, string> {
  const out = new Map<number, string>();
  const absolute = spansSeasons(az);
  for (const [key, m] of numberedEpisodes(az)) {
    if (m.seasonNumber == null || m.seasonNumber < 1 || m.episodeNumber == null) continue;
    const n = absolute ? (m.absoluteEpisodeNumber ?? Number(key)) : Number(key);
    if (!out.has(n)) out.set(n, `${m.seasonNumber}:${m.episodeNumber}`);
  }
  if (!absolute) return out;
  // An unmapped episode between two same-season neighbours sits in the gap they leave.
  for (const [n, pair] of Array.from(out)) {
    if (out.has(n + 1) || !out.has(n + 2)) continue;
    const [s, e] = pair.split(":").map(Number);
    if (out.get(n + 2) === `${s}:${e + 2}`) out.set(n + 1, `${s}:${e + 1}`);
  }
  return out;
}

/** Absolute number of a TVDB pair inside an entry spanning several TVDB seasons, else null. */
export async function absoluteEntryNumber(
  kitsuId: number,
  season: number | undefined,
  episode: number | undefined,
  rowAbsolute: number | undefined,
): Promise<number | null> {
  if (season == null || episode == null || season < 1) return null;
  const az = await aniZipByKitsu(kitsuId).catch(() => null);
  if (!spansSeasons(az)) return null;
  const eps = numberedEpisodes(az);
  const hit = eps.find(([, m]) => m.seasonNumber === season && m.episodeNumber === episode)?.[1];
  const n = hit?.absoluteEpisodeNumber ?? rowAbsolute ?? gapNumber(az, season, episode);
  return n != null && Number.isInteger(n) && n >= 1 && n <= eps.length ? n : null;
}

// Rows without a TVDB absolute (ordering not loaded) fall back to the neighbours' numbering.
function gapNumber(az: AniZipMapping | null, season: number, episode: number): number | null {
  for (const [n, pair] of entryTvdbPairs(az)) if (pair === `${season}:${episode}`) return n;
  return null;
}

/** Display-season rows carry the TVDB/IMDb pair; tracker entries count episodes within themselves. */
export async function animeEntryTarget(
  metaId: string,
  ep: Pick<KitsuEpisode, "number" | "seasonNumber" | "imdbSeason" | "imdbEpisode"> &
    Partial<Pick<KitsuEpisode, "id" | "streamId" | "imdbId" | "sourceMetaId" | "absoluteNumber">>,
  trackId?: string,
): Promise<AnimeEntryTarget | null> {
  const stream = KITSU_STREAM.exec(ep.streamId ?? "");
  if (stream) return { kitsuId: Number(stream[1]), number: Number(stream[2]) };
  const owner = ep.sourceMetaId ?? metaId;
  const native = /^kitsu:(\d+)$/.exec(
    ep.sourceMetaId ?? (trackId?.startsWith("kitsu:") ? trackId : metaId),
  );
  const playEp = {
    season: ep.seasonNumber ?? 1,
    episode: ep.number,
    imdbSeason: ep.imdbSeason,
    imdbEpisode: ep.imdbEpisode,
  };
  const identity = animeIdentityEligible(owner, playEp)
    ? await resolveAnimeIdentity(owner, ep.imdbId ?? null, {
        season: playEp.season,
        episode: playEp.episode,
        imdbSeason: ep.imdbSeason,
        imdbEpisode: ep.imdbEpisode,
      }).catch(() => null)
    : null;
  const kitsuId = identity?.kitsuId ?? (native ? Number(native[1]) : null);
  if (kitsuId == null) return null;
  const absolute = await absoluteEntryNumber(
    kitsuId,
    ep.imdbSeason,
    ep.imdbEpisode,
    ep.absoluteNumber,
  );
  if (absolute != null) return { kitsuId, number: absolute };
  if (identity) return { kitsuId, number: identity.number };
  // Synthetic TVDB slots (negative id) number episodes within a TVDB season, not the entry.
  return (ep.id ?? 0) < 0 ? null : { kitsuId, number: ep.number };
}
