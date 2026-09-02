// Every one of these caches used to be read from localStorage at the top of an
// async function, mutated after the await, and written back whole. Eight mapping
// workers run at once now, so each one held a snapshot taken before the others
// wrote and the last writer erased the rest: roughly one new entry in eight
// survived, and the cold boot it was meant to warm paid the same lookups again.
// One shared in-memory record per key, one debounced write.
const FLUSH_MS = 600;

export type MappingStore<T> = {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
};

export function mappingStore<T>(storageKey: string): MappingStore<T> {
  let mem: Record<string, T> | null = null;
  let timer = 0;

  const load = (): Record<string, T> => {
    if (mem) return mem;
    try {
      const raw = localStorage.getItem(storageKey);
      mem = raw ? (JSON.parse(raw) as Record<string, T>) : {};
    } catch {
      mem = {};
    }
    return mem;
  };

  const flush = () => {
    if (typeof window === "undefined") return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(mem ?? {}));
      } catch {}
    }, FLUSH_MS);
  };

  return {
    get(key) {
      return load()[key];
    },
    set(key, value) {
      load()[key] = value;
      flush();
    },
  };
}
