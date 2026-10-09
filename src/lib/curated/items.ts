import { curatedList } from "./registry";
import type { CuratedListItem, CuratedSnapshot } from "./types";

type SnapshotModule = { default: CuratedSnapshot };

const MODULES = import.meta.glob<SnapshotModule>([
  "../../data/curated/*.json",
  "!../../data/curated/index.json",
]);

const loaded = new Map<string, readonly CuratedListItem[]>();
const inflight = new Map<string, Promise<readonly CuratedListItem[]>>();

function moduleFor(id: string): (() => Promise<SnapshotModule>) | null {
  const path = `../../data/curated/${id}.json`;
  return MODULES[path] ?? null;
}

export function loadListItems(id: string): Promise<readonly CuratedListItem[]> {
  const cached = loaded.get(id);
  if (cached) return Promise.resolve(cached);
  const list = curatedList(id);
  if (!list) return Promise.resolve([]);
  if (list.head.length >= list.count) {
    loaded.set(id, list.head);
    return Promise.resolve(list.head);
  }
  const running = inflight.get(id);
  if (running) return running;
  const load = (async () => {
    const mod = moduleFor(id);
    if (!mod) return list.head;
    try {
      const items = (await mod()).default?.items;
      if (!Array.isArray(items) || items.length === 0) return list.head;
      loaded.set(id, items);
      return items as readonly CuratedListItem[];
    } catch {
      return list.head;
    }
  })();
  inflight.set(id, load);
  return load.finally(() => inflight.delete(id));
}
