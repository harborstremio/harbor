import { useSyncExternalStore } from "react";

const idSet = new Set<string>();
const nameSet = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function setTop10Metas(metas: Array<{ id: string; name: string }>): void {
  const nextIds = new Set(metas.map((m) => m.id));
  let changed = nextIds.size !== idSet.size;
  if (!changed) for (const id of nextIds) if (!idSet.has(id)) { changed = true; break; }
  if (!changed) return;
  idSet.clear();
  nameSet.clear();
  for (const m of metas) {
    idSet.add(m.id);
    if (m.name) nameSet.add(norm(m.name));
  }
  version += 1;
  for (const l of listeners) l();
}

export function isTop10(id: string, name?: string): boolean {
  if (idSet.has(id)) return true;
  return !!name && nameSet.has(norm(name));
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useTop10Version(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}
