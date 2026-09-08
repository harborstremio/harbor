import type { FavoriteMedia, FavoriteKind } from "./providers/favorites-types";

type Favorites = Record<FavoriteKind, FavoriteMedia[]>;
/** Mutation reads preserve stored metadata; tolerant display normalization must not erase it. */
export function readOwnFavoriteSnapshot(value: unknown, handle: string): Favorites {
  if (
    !value ||
    typeof value !== "object" ||
    !("handle" in value) ||
    !("isOwner" in value) ||
    typeof value.handle !== "string" ||
    value.handle.toLowerCase() !== handle.toLowerCase() ||
    value.isOwner !== true
  )
    throw new Error("The server did not confirm your profile. Reload it before making changes.");
  const raw = "favorites" in value ? value.favorites : undefined;
  // ProfileSummary defines missing kinds (and a missing favorites section) as empty.
  if (raw === undefined) return { game: [], book: [], music: [] };
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).some((key) => !["game", "book", "music"].includes(key))
  )
    throw new Error("Your profile items could not be read safely. No changes were made.");
  const result: Favorites = { game: [], book: [], music: [] };
  for (const kind of ["game", "book", "music"] as const) {
    const entries: unknown = (raw as Record<string, unknown>)[kind];
    if (entries === undefined) continue;
    if (!Array.isArray(entries))
      throw new Error("Your profile items could not be read safely. No changes were made.");
    const ids = new Set<string>();
    for (const item of entries) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        !item.id.trim() ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        (item.kind !== undefined && item.kind !== kind) ||
        ids.has(item.id)
      )
        throw new Error("Your profile items could not be read safely. No changes were made.");
      ids.add(item.id);
      result[kind].push({ ...item, kind });
    }
  }
  return result;
}

export function appendProfileFavorite(
  previous: Favorites,
  item: FavoriteMedia,
  capacity: number,
): Favorites {
  const entries = previous[item.kind];
  if (entries.some((entry) => entry.id === item.id)) return previous;
  if (entries.length >= capacity)
    throw new Error("Your profile section is full. Remove an item before adding another.");
  return { ...previous, [item.kind]: [...entries, { ...item }] };
}
