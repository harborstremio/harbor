import type { MusicCatalogItem } from "./types";

export type AlbumExplicitMark = "explicit" | "clean";

function titleKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()}::${artist.trim().toLowerCase()}`;
}

/**
 * Explicit releases are always marked. Clean ones are marked only where the same
 * release also ships an explicit cut, because that pair is the only case where
 * "which one is this" is a real question. Labelling every other album clean would
 * put a badge on almost every cover in the app and say nothing.
 */
export function albumExplicitMarks(
  items: readonly MusicCatalogItem[],
): Map<string, AlbumExplicitMark> {
  const explicitTitles = new Set<string>();
  for (const item of items) {
    if (item.kind === "album" && item.explicit === true) {
      explicitTitles.add(titleKey(item.title, item.artist));
    }
  }
  const marks = new Map<string, AlbumExplicitMark>();
  for (const item of items) {
    if (item.kind !== "album") continue;
    if (item.explicit === true) marks.set(item.id, "explicit");
    else if (item.explicit === false && explicitTitles.has(titleKey(item.title, item.artist)))
      marks.set(item.id, "clean");
  }
  return marks;
}
