export type MangaPushResult = "synced" | "noop" | "title-miss" | "error";

// A single candidate a tracker search returns, enough to render in the manual
// match picker and to push against once the user confirms it.
export type MangaCandidate = {
  id: string;
  title: string;
  cover?: string;
  chapters?: number | null;
  /** Localized format/type label shown in the match picker (e.g. "Manhwa", "Manga", "Novel"). */
  type?: string;
  /** User score on the tracker, 0-100 for AniList, 0-10 for MAL. */
  score?: number | null;
  /** ISO release/start date of the work. */
  releaseDate?: string;
  /** Cross-database MAL id, when the candidate came from a source that knows it (AniList). */
  malId?: number | null;
  /** Alternate names (AniList synonyms, MAL english title) used to auto-match a
   * local title that differs from the tracker's primary title (e.g. an English
   * local title against a romaji-named Korean manhwa). */
  altTitles?: string[];
};

export type MangaSyncError = "update-not-confirmed" | "unreachable" | "title-miss";

export type MangaSyncEvent =
  | { kind: "syncing"; title: string; chapter: number }
  | { kind: "ok"; title: string; chapter: number }
  | { kind: "error"; title: string; error: MangaSyncError };

export type MangaTracker = "anilist" | "mal";

const listeners = new Map<MangaTracker, Set<(e: MangaSyncEvent) => void>>();
const last = new Map<MangaTracker, MangaSyncEvent | null>();

function setFor(tracker: MangaTracker): Set<(e: MangaSyncEvent) => void> {
  let set = listeners.get(tracker);
  if (!set) {
    set = new Set();
    listeners.set(tracker, set);
  }
  return set;
}

export function subscribeMangaSync(
  tracker: MangaTracker,
  fn: (e: MangaSyncEvent) => void,
): () => void {
  setFor(tracker).add(fn);
  return () => {
    setFor(tracker).delete(fn);
  };
}

export function getLastMangaSync(tracker: MangaTracker): MangaSyncEvent | null {
  return last.get(tracker) ?? null;
}

export function emitMangaSync(tracker: MangaTracker, e: MangaSyncEvent): void {
  last.set(tracker, e);
  for (const fn of setFor(tracker)) fn(e);
}
