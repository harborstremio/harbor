export type WatchEvent = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  season?: number;
  episode?: number;
  at: number;
};

const KEY = "harbor.watchevents.v1";
const MAX = 40;
const subs = new Set<() => void>();

function load(): WatchEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WatchEvent[]) : [];
  } catch {
    return [];
  }
}

export function listWatchEvents(): WatchEvent[] {
  return load();
}

export function recordWatchEvent(e: WatchEvent): void {
  if (!e.id || !e.name) return;
  const key = `${e.id}|${e.season ?? ""}|${e.episode ?? ""}`;
  const next = [e, ...load().filter((p) => `${p.id}|${p.season ?? ""}|${p.episode ?? ""}` !== key)];
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    return;
  }
  subs.forEach((fn) => fn());
}

export function subscribeWatchEvents(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
