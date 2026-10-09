import { curatedLists } from "./registry";
import type { CuratedList } from "./types";

export type Accolade = { listId: string; badge: string; year: number };

const MAX_PER_TITLE = 3;
const EMPTY: readonly Accolade[] = [];

function eligible(list: CuratedList): list is CuratedList & { badge: string } {
  return typeof list.badge === "string" && list.head.length >= list.count;
}

const byImdb = new Map<string, Accolade[]>();
for (const list of curatedLists()) {
  if (!eligible(list)) continue;
  for (const item of list.head) {
    if (item.awardYear == null) continue;
    const found = byImdb.get(item.imdb);
    const next = { listId: list.id, badge: list.badge, year: item.awardYear };
    if (found) found.push(next);
    else byImdb.set(item.imdb, [next]);
  }
}
for (const list of byImdb.values()) list.sort((a, b) => b.year - a.year);

export function accoladesFor(imdbId: string | null | undefined): readonly Accolade[] {
  if (!imdbId) return EMPTY;
  const found = byImdb.get(imdbId);
  return found ? found.slice(0, MAX_PER_TITLE) : EMPTY;
}
