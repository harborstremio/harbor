import { curatedList, curatedLists } from "./registry";
import { CRITERION_LIST_ID, spineFor } from "./spine";
import type { CuratedCompanion, CuratedList, CuratedListItem, ListBrand, ListOrdering } from "./types";

export type CanonEntry = {
  listId: string;
  title: string;
  curator: string;
  brand?: ListBrand;
  ordering: ListOrdering;
  place: number | null;
  year?: number;
  companion?: CuratedCompanion;
};

export const MAX_PER_TITLE = 4;
const EMPTY: readonly CanonEntry[] = [];

export function complete(list: CuratedList): boolean {
  return list.head.length >= list.count;
}

/** Festival winners already have their own grouped block, and Criterion answers from its spine file. */
export function eligible(list: CuratedList, kind: "movie" | "series"): boolean {
  return list.kind === kind && list.ordering !== "awarded" && list.id !== CRITERION_LIST_ID;
}

export function entryOf(list: CuratedList, place: number | null): CanonEntry {
  return {
    listId: list.id,
    title: list.title,
    curator: list.curator,
    brand: list.brand,
    ordering: list.ordering,
    place,
    year: list.publishedYear,
    companion:
      list.companion && (list.companion.forRank == null || list.companion.forRank === place)
        ? list.companion
        : undefined,
  };
}

function ranked(entry: CanonEntry): boolean {
  return entry.ordering === "ranked" && entry.place != null;
}

/** A placement says more than bare membership, and a poll placement says more than a spine number. */
export function order(found: CanonEntry[]): readonly CanonEntry[] {
  found.sort((a, b) => {
    if (ranked(a) !== ranked(b)) return ranked(a) ? -1 : 1;
    if (ranked(a) && ranked(b)) return (a.place ?? 0) - (b.place ?? 0);
    const placed = (entry: CanonEntry) => entry.place != null;
    if (placed(a) !== placed(b)) return placed(a) ? -1 : 1;
    return a.curator.localeCompare(b.curator);
  });
  return found.slice(0, MAX_PER_TITLE);
}

/** The lists whose bundled head is too short to settle membership either way. */
export function canonPending(kind: "movie" | "series"): readonly CuratedList[] {
  return curatedLists().filter((list) => eligible(list, kind) && !complete(list));
}

export function canonInItems(
  list: CuratedList,
  items: readonly CuratedListItem[],
  imdbId: string,
): CanonEntry | null {
  const item = items.find((entry) => entry.imdb === imdbId);
  return item ? entryOf(list, item.rank) : null;
}

/** What can be answered with what is already bundled, so the block never waits to appear. */
export function canonFor(
  imdbId: string | null | undefined,
  kind: "movie" | "series",
): readonly CanonEntry[] {
  if (!imdbId) return EMPTY;
  const found: CanonEntry[] = [];
  for (const list of curatedLists()) {
    if (!eligible(list, kind) || !complete(list)) continue;
    const entry = canonInItems(list, list.head, imdbId);
    if (entry) found.push(entry);
  }
  const spine = spineFor(imdbId);
  if (spine != null) {
    const criterion = curatedList(CRITERION_LIST_ID);
    if (criterion && criterion.kind === kind) found.push(entryOf(criterion, spine));
  }
  return order(found);
}
