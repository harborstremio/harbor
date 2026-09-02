import { registerEvictable } from "@/lib/maintenance";

// Every catalog of every installed addon is swept by the home page AND by the
// anime page, both on mount, with the anime page then discarding everything that
// is not anime. On a loaded profile that is the great majority of the bridge
// crossings a cold boot pays, and tab hopping paid it again every single time.
// One short-lived memory cache in front of the row fetch, shared by all callers,
// plus in-flight dedupe so two surfaces mounting at once ask once.
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 80;

type Entry<T> = { v: T; t: number };

const rows = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

registerEvictable("addon-catalog-rows", (aggressive) => {
  if (aggressive) return rows.clear();
  const now = Date.now();
  for (const [k, e] of rows) if (now - e.t > TTL_MS) rows.delete(k);
});

export function cachedCatalogRow<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = rows.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return Promise.resolve(hit.v as T);
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      const v = await load();
      if (rows.size >= MAX_ENTRIES) {
        const oldest = rows.keys().next().value;
        if (oldest !== undefined) rows.delete(oldest);
      }
      rows.set(key, { v, t: Date.now() });
      return v;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
