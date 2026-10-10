import {
  createListStore,
  readLists,
  removeFromList,
  type ListStore,
} from "./custom-lists";

export const mangaLists: ListStore = createListStore("harbor.mangalists.v1");

const MIGRATED_KEY = "harbor.mangalists.migrated.v1";

export function ensureMangaListsMigrated(): void {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return;
    for (const list of readLists()) {
      const moving = list.items.filter((it) => it.type === "manga");
      if (moving.length === 0) continue;
      let target = mangaLists.readLists().find((l) => l.name === list.name);
      let targetId = target?.id ?? null;
      if (!targetId) targetId = mangaLists.createList(list.name, list.description ?? "");
      if (!targetId) continue;
      for (const it of moving) {
        mangaLists.addToList(targetId, {
          id: it.id,
          type: "manga",
          name: it.name,
          poster: it.poster,
          addonOrigin: it.addonOrigin,
          videos: it.videos,
        });
        removeFromList(list.id, it.id);
      }
    }
    const remaining = readLists().some((l) => l.items.some((it) => it.type === "manga"));
    if (!remaining) localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    /* retry on next launch */
  }
}

try {
  ensureMangaListsMigrated();
} catch {
  /* retry on next launch */
}
