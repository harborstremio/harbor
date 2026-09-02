import { localLibraryGeneration, readLocalLibrary, type LocalEntry } from "@/lib/local-library";
import { parseStream } from "@/lib/streams/parser";
import { tierOf } from "@/lib/streams/scoring/scoring-resolution";
import type { ParsedStream, Stream, Tier } from "@/lib/streams/types";
import { episodeSpanContains, parseEpisodeSpan } from "@/lib/episode-span";

export { localGroupKey, localTitleKey } from "./group-key";

export const LOCAL_ADDON_ID = "harbor-local-files";
export const LOCAL_ADDON_NAME = "Local files";

/**
 * Feed a local file through the real stream parser instead of the scanner's
 * regex, so version rows get the same source/codec/HDR/audio facets as addon
 * streams. Mirrors buildLibraryStream in @/lib/streams/library.
 */
export function localEntryToStream(entry: LocalEntry): Stream {
  return {
    name: entry.filename,
    url: entry.path,
    behaviorHints: {
      filename: entry.filename,
      videoSize: entry.size ?? undefined,
      notWebReady: true,
    },
    addonId: LOCAL_ADDON_ID,
    addonName: LOCAL_ADDON_NAME,
  };
}

const parseCache = new Map<string, ParsedStream>();
let parseCacheGen = -1;

/** Parsed facets for a local file, memoized against the store generation. */
export function parseLocalEntry(entry: LocalEntry): ParsedStream {
  const gen = localLibraryGeneration();
  if (gen !== parseCacheGen) {
    parseCache.clear();
    parseCacheGen = gen;
  }
  const hit = parseCache.get(entry.path);
  if (hit) return hit;
  const parsed = parseStream(localEntryToStream(entry));
  // A file on disk is never debrid-cached; don't let filename noise imply it.
  parsed.cached = {};
  parsed.inLibrary = {};
  if (parsed.size == null && entry.size != null) parsed.size = entry.size;
  parseCache.set(entry.path, parsed);
  return parsed;
}

const TIER_RANK: Record<Tier, number> = {
  "4K_DV": 7,
  "4K_HDR": 6,
  "4K": 5,
  "1080p_HDR": 4,
  "1080p": 3,
  "720p": 2,
  SD: 1,
  ROUGH: 0,
};

const SOURCE_RANK: Record<string, number> = {
  REMUX: 6,
  BluRay: 5,
  "WEB-DL": 4,
  WEBRip: 3,
  BDRip: 3,
  HDRip: 2,
  DVDRip: 2,
  HDTV: 1,
};

function versionRank(entry: LocalEntry): number[] {
  const p = parseLocalEntry(entry);
  return [TIER_RANK[tierOf(p)] ?? 0, p.remux ? 1 : 0, SOURCE_RANK[p.source] ?? 0, p.size ?? 0];
}

/** Best version first. Ties fall back to filename for a stable order. */
export function sortVersions(entries: LocalEntry[]): LocalEntry[] {
  if (entries.length < 2) return entries;
  return entries
    .map((entry) => ({ entry, rank: versionRank(entry) }))
    .sort((a, b) => {
      for (let i = 0; i < a.rank.length; i++) {
        if (a.rank[i] !== b.rank[i]) return b.rank[i] - a.rank[i];
      }
      return a.entry.filename.localeCompare(b.entry.filename);
    })
    .map((x) => x.entry);
}

/**
 * Every local file for a movie, best first. The singular findLocalMovie in
 * @/lib/local-library returns only the first match; this is the version-aware
 * counterpart. It lives here rather than beside it to avoid an import cycle
 * with sortVersions.
 */
export function findLocalMovieVersions(
  tmdbId?: number | null,
  imdbId?: string | null,
): LocalEntry[] {
  if (tmdbId == null && imdbId == null) return [];
  return sortVersions(
    readLocalLibrary().filter(
      (e) =>
        e.type === "movie" &&
        ((tmdbId != null && e.tmdbId === tmdbId) || (imdbId != null && e.imdbId === imdbId)),
    ),
  );
}

/** Every local file for one episode, best first. */
export function findLocalEpisodeVersions(
  season: number,
  episode: number,
  tmdbId?: number | null,
  imdbId?: string | null,
): LocalEntry[] {
  if (tmdbId == null && imdbId == null) return [];
  return sortVersions(
    readLocalLibrary().filter(
      (e) =>
        e.type === "show" &&
        episodeSpanContains(
          { ...e, episodeEnd: e.episodeEnd ?? parseEpisodeSpan(e.filename)?.episodeEnd },
          season,
          episode,
        ) &&
        ((tmdbId != null && e.tmdbId === tmdbId) || (imdbId != null && e.imdbId === imdbId)),
    ),
  );
}
