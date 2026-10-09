import type { MusicTrack } from "./types";

const CLEAN_MARK = /\(\s*(?:clean|edited)[^)]*\)|\[\s*(?:clean|edited)[^\]]*\]|\b(?:clean version|edited version)\b/i;
const EXPLICIT_MARK = /\(\s*explicit[^)]*\)|\[\s*explicit[^\]]*\]|\bexplicit version\b/i;

export function explicitnessOf(track: MusicTrack): boolean | undefined {
  if (typeof track.explicit === "boolean") return track.explicit;
  const labelled = `${track.title ?? ""} ${track.version ?? ""}`;
  if (EXPLICIT_MARK.test(labelled)) return true;
  if (CLEAN_MARK.test(labelled)) return false;
  return undefined;
}

function distance(candidate: MusicTrack, wanted: boolean): number {
  const value = explicitnessOf(candidate);
  if (value === wanted) return 0;
  if (value === undefined) return 1;
  return 2;
}

/**
 * A song asked for explicit must not be answered with its clean edit, nor the reverse. Sources are
 * still chosen by connector first; this only settles which cut that connector hands over.
 */
export function rankByExplicitness<T extends { track: MusicTrack }>(
  candidates: readonly T[],
  wanted: boolean | undefined,
): T[] {
  if (wanted === undefined) return [...candidates];
  return [...candidates].sort((a, b) => distance(a.track, wanted) - distance(b.track, wanted));
}
