import { useSyncExternalStore } from "react";

const NEW_BADGE_RESET_GENERATION = 1;

const NEW_SECTIONS = new Set(["library", "badges", "theme", "tv"]);
const NEW_SETTINGS = new Set([
  "library:award-tab",
  "library:top-10",
  "theme:hero-video",
  "theme:drag-anywhere",
  "theme:liquid-glass",
  "tv:subtitle-look",
  "mpv:buffer-size",
]);

const LS = "harbor.settingsNew.v1";

type SeenStore = { gen: number; sections: string[]; items: string[] };

function readStore(): SeenStore {
  try {
    const raw = JSON.parse(localStorage.getItem(LS) ?? "null");
    if (raw && typeof raw === "object" && raw.gen === NEW_BADGE_RESET_GENERATION) {
      return {
        gen: NEW_BADGE_RESET_GENERATION,
        sections: Array.isArray(raw.sections) ? raw.sections : [],
        items: Array.isArray(raw.items) ? raw.items : [],
      };
    }
  } catch {
    /* fall through to a fresh store */
  }
  return { gen: NEW_BADGE_RESET_GENERATION, sections: [], items: [] };
}

let store = readStore();
const subs = new Set<() => void>();
let snapshot = `${store.gen}|${store.sections.join(",")}|${store.items.join(",")}`;

function persist(): void {
  try {
    localStorage.setItem(LS, JSON.stringify(store));
  } catch {
    /* ignore */
  }
  snapshot = `${store.gen}|${store.sections.join(",")}|${store.items.join(",")}`;
  for (const fn of subs) fn();
}

persist();

function subscribe(cb: () => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function markSectionSeen(id: string): void {
  if (!NEW_SECTIONS.has(id) || store.sections.includes(id)) return;
  store.sections = [...store.sections, id];
  persist();
}

export function markSettingSeen(id: string): void {
  if (!NEW_SETTINGS.has(id) || store.items.includes(id)) return;
  store.items = [...store.items, id];
  persist();
}

export function useSettingsNew(): (id: string) => boolean {
  useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  const seen = new Set(store.sections);
  return (id: string) => NEW_SECTIONS.has(id) && !seen.has(id);
}

export function useSettingNew(): (id: string) => boolean {
  useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  const seen = new Set(store.items);
  return (id: string) => NEW_SETTINGS.has(id) && !seen.has(id);
}
