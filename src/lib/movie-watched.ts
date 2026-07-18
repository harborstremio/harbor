const KEY = "harbor.moviewatched.v1";

const subs = new Set<() => void>();
let version = 0;
let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = new Set(
      Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [],
    );
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist(next: Set<string>): void {
  cache = next;
  version += 1;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* quota */
  }
  for (const fn of subs) fn();
}

export function isMovieWatchedLocal(metaId: string): boolean {
  return load().has(metaId);
}

export function setMovieWatchedLocal(metaId: string, watched: boolean): void {
  const cur = load();
  if (cur.has(metaId) === watched) return;
  const next = new Set(cur);
  if (watched) next.add(metaId);
  else next.delete(metaId);
  persist(next);
}

export function subscribeMovieWatched(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function movieWatchedVersion(): number {
  return version;
}
