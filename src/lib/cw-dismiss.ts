import { useSyncExternalStore } from "react";
import { clearResume } from "./resume";
import { episodeFromVideoId, libraryPut, type LibraryItem } from "./stremio";

const SIMKL_KEY = "harbor.cw.dismissed.simkl";
const dismissed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

(() => {
  try {
    const raw = JSON.parse(localStorage.getItem(SIMKL_KEY) ?? "[]");
    const arr = Array.isArray(raw) ? (raw as string[]) : [];
    const migrated = arr.map((v) => (v.startsWith("simkl|") ? v : `simkl|${v}`));
    if (migrated.some((v, i) => v !== arr[i])) {
      localStorage.setItem(SIMKL_KEY, JSON.stringify(migrated));
    }
    for (const v of migrated) dismissed.add(v);
  } catch {}
})();

function emit(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function isCwDismissed(item: LibraryItem): boolean {
  return (
    dismissed.has(item._id) || (item.external === "simkl" && dismissed.has(`simkl|${item._id}`))
  );
}

export function dismissCw(item: LibraryItem, authKey: string | null): void {
  const id = item._id;
  dismissed.add(id);
  if (item.external === "simkl") {
    dismissed.add(`simkl|${id}`);
    try {
      const raw = JSON.parse(localStorage.getItem(SIMKL_KEY) ?? "[]");
      const set = new Set(Array.isArray(raw) ? (raw as string[]) : []);
      set.add(`simkl|${id}`);
      localStorage.setItem(SIMKL_KEY, JSON.stringify([...set]));
    } catch {}
    emit();
    return;
  }
  emit();
  if (!authKey || !item.state) return;
  const vid = item.state.video_id ?? "";
  const kitsuThreeSeg = /^(kitsu|mal|anilist|anidb):/.test(id) && vid.split(":").length === 3;
  const se = kitsuThreeSeg ? null : episodeFromVideoId(item.state.video_id);
  clearResume(
    id,
    item.state.season ?? (kitsuThreeSeg ? 1 : se?.season),
    item.state.episode ?? (kitsuThreeSeg ? Number(vid.split(":")[2]) : se?.episode),
  );
  void libraryPut(authKey, {
    ...item,
    state: { ...item.state, timeOffset: 0 },
    _mtime: new Date().toISOString(),
  }).catch(() => {});
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useCwDismissVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}
