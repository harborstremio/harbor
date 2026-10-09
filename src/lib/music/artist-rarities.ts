import { searchMusic } from "./sources";
import { artistCreditParts } from "./search-artists";
import type { MusicTrack } from "./types";

const OPEN_SOURCES = ["soundcloud", "youtube"] as const;
const TERMS = ["unreleased", "leak", "snippet", "demo"] as const;
const PER_QUERY = 20;
const MAX_RESULTS = 80;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function mentionsArtist(track: MusicTrack, wanted: string): boolean {
  if (!wanted) return false;
  if (normalize(track.title).includes(wanted)) return true;
  const credits = [track.artist, ...artistCreditParts(track.artist)].map(normalize);
  return credits.some((name) => name === wanted);
}

function rareness(track: MusicTrack): number {
  const title = track.title.toLowerCase();
  return TERMS.reduce((score, term) => score + (title.includes(term) ? 1 : 0), 0);
}

export async function loadArtistRarities(
  artist: string,
  signal?: AbortSignal,
): Promise<MusicTrack[]> {
  const wanted = normalize(artist);
  if (wanted.length < 2) return [];
  const queries = OPEN_SOURCES.flatMap((source) =>
    TERMS.map((term) => ({ source, query: `${artist} ${term}` })),
  );
  const pages = await Promise.all(
    queries.map((entry) =>
      searchMusic(entry.query, PER_QUERY, entry.source).catch(() => [] as MusicTrack[]),
    ),
  );
  if (signal?.aborted) return [];
  const seen = new Set<string>();
  const found: MusicTrack[] = [];
  for (const page of pages) {
    for (const track of page) {
      if (!mentionsArtist(track, wanted)) continue;
      const key = `${normalize(track.title)}:${track.connectorId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(track);
    }
  }
  return found.sort((left, right) => rareness(right) - rareness(left)).slice(0, MAX_RESULTS);
}
