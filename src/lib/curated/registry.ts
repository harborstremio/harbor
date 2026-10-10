import rawIndex from "@/data/curated/index.json";
import type { Meta } from "@/lib/cinemeta";
import { LIST_SEEDS } from "./catalog";
import { spineFor } from "./spine";
import type { CuratedList, CuratedListIndex, CuratedListItem } from "./types";

const index = rawIndex as CuratedListIndex;

const byId = new Map<string, CuratedList>();
for (const seed of LIST_SEEDS) {
  const entry = index.lists.find((l) => l.id === seed.id);
  if (!entry || entry.head.length === 0) continue;
  byId.set(seed.id, {
    ...seed,
    count: entry.count,
    snapshotDate: entry.snapshotDate,
    head: entry.head,
  });
}

const ordered: readonly CuratedList[] = [...byId.values()];
const shelf: readonly CuratedList[] = ordered.filter((l) => l.discoverRow !== true);

export function curatedLists(): readonly CuratedList[] {
  return ordered;
}

export function curatedList(id: string): CuratedList | null {
  return byId.get(id) ?? null;
}

export function shelfLists(): readonly CuratedList[] {
  return shelf;
}

function itemType(list: CuratedList, item: CuratedListItem): "movie" | "series" {
  return item.type ?? (list.kind === "series" ? "series" : "movie");
}

export function itemMeta(list: CuratedList, item: CuratedListItem): Meta {
  return {
    id: item.imdb,
    type: itemType(list, item),
    name: item.title,
    poster: `https://images.metahub.space/poster/small/${item.imdb}/img`,
    background: `https://images.metahub.space/background/medium/${item.imdb}/img`,
    releaseInfo: item.year ? String(item.year) : undefined,
  };
}

export function cardBadge(list: CuratedList, item: CuratedListItem): string | null {
  if (list.ordering === "ranked") return item.rank == null ? null : String(item.rank);
  if (list.ordering === "spine") {
    const spine = spineFor(item.imdb);
    return spine == null ? null : String(spine);
  }
  if (list.ordering === "awarded") return item.awardYear == null ? null : String(item.awardYear);
  return null;
}
