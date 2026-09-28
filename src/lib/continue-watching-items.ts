import { cwSortKey, type LibraryItem } from "@/lib/stremio";

export function continueWatchingKey(item: Pick<LibraryItem, "_id" | "type">): string {
  const id = item._id
    .replace(/^cnative:(?=tt\d+$|tmdb:\d+$)/, "")
    .replace(/^tmdb:(?:tv|movie):/, "tmdb:");
  return `${item.type}:${id}`;
}

export function mergeContinueWatchingItems(items: LibraryItem[], limit = Infinity): LibraryItem[] {
  const sorted = items.slice().sort((a, b) => cwSortKey(b) - cwSortKey(a));
  const merged = new Map<string, LibraryItem>();
  for (const item of sorted) {
    const key = continueWatchingKey(item);
    const latest = merged.get(key);
    if (!latest) {
      merged.set(key, item);
    } else if (item._id.startsWith("cnative:") && !latest._id.startsWith("cnative:")) {
      // Metadata belongs to cNative; progress belongs to the most recent viewing.
      merged.set(key, {
        ...latest,
        _id: item._id,
        name: item.name,
        local: item.local,
        external: item.external,
        manualWatched: item.manualWatched,
        poster: item.poster ?? latest.poster,
        background: item.background ?? latest.background,
      });
    }
  }
  return [...merged.values()].slice(0, Math.max(0, limit));
}
