import type { LibraryItem } from "@/lib/stremio";
import type { AnimeProgressSource, NextEpisodeCandidate } from "./types";

/** Converts a decided next episode into a Continue Watching library item. */
export function candidateToLibraryItem(
  c: {
    season: number;
    episode: number;
    kind: NextEpisodeCandidate["kind"];
    source: AnimeProgressSource;
    metaId: string;
    title: string;
    poster?: string | null;
    updatedAt: string | null;
  },
): LibraryItem {
  const now = new Date().toISOString();
  const lastWatched = c.updatedAt ?? now;
  return {
    _id: c.metaId,
    type: "series",
    name: c.title,
    poster: c.poster ?? undefined,
    state: {
      timeOffset: 0, // no playback position yet; native resume wins when present
      duration: 0,
      season: c.season,
      episode: c.episode,
      video_id: `${c.metaId}:${c.season}:${c.episode}`,
      lastWatched,
    },
    removed: false,
    temp: false,
    _ctime: now,
    _mtime: lastWatched,
    external: c.source,
    isAnime: true,
    upNext: true,
  };
}

/**
 * Native Stremio progress takes priority: an imported episode is dropped when
 * the native library already holds the same item (same metadata id or a name
 * match), because native progress already drives Continue Watching and the
 * next-episode advancement flow.
 */
export function mergeImportedWithNative(
  native: readonly LibraryItem[],
  imported: readonly LibraryItem[],
): LibraryItem[] {
  if (imported.length === 0) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
  const nativeIds = new Set<string>();
  const nativeNames = new Set<string>();
  for (const n of native) {
    nativeIds.add(n._id);
    const nm = norm(n.name ?? "");
    if (nm) nativeNames.add(`${n.type}:${nm}`);
  }
  return imported.filter((i) => {
    if (nativeIds.has(i._id)) return false;
    const nm = norm(i.name ?? "");
    if (nm && nativeNames.has(`${i.type}:${nm}`)) return false;
    return true;
  });
}

/** Shared ordering for imported entries: most recently updated first. */
export function sortImported(items: LibraryItem[]): LibraryItem[] {
  const at = (i: LibraryItem) => {
    const lw = Date.parse(i.state?.lastWatched ?? "");
    return Number.isFinite(lw) ? lw : 0;
  };
  return [...items].sort((a, b) => at(b) - at(a));
}