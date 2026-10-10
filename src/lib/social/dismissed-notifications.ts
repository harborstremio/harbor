import { persistCritical } from "@/lib/storage-recovery";

const KEY = "harbor.nc.dismissed.v1";
const CAP = 500;

let set: Set<string> | null = null;
const subs = new Set<() => void>();

function load(): Set<string> {
  if (set) return set;
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    set = new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    set = new Set();
  }
  return set;
}

function persist(): void {
  persistCritical(KEY, JSON.stringify([...load()].slice(-CAP)));
}

export function isDismissed(id: string): boolean {
  return load().has(id);
}

export function dismissNotifs(ids: string[]): void {
  const s = load();
  let changed = false;
  for (const id of ids) {
    if (!s.has(id)) {
      s.add(id);
      changed = true;
    }
  }
  if (!changed) return;
  persist();
  for (const f of subs) f();
}

export function subscribeDismissed(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}
