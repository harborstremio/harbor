import type { Meta } from "@/lib/cinemeta";
import { registerEvictable } from "@/lib/maintenance";

const ARM = "https://relations.yuna.moe/api/ids";

const ARM_KEY = "harbor.armcache";
// 30 days, and it must stay there. A warm armcache is what keeps a full page of
// per-card relations.yuna.moe lookups off every profile that is not brand new.
const ARM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ARM_NEG_TTL_MS = 24 * 60 * 60 * 1000;
const ARM_TIMEOUT_MS = 3500;
const ARM_CONCURRENCY = 8;

type ArmEntry = { kitsu?: number; anilist?: number; t: number; neg?: boolean };
type ArmCache = Record<string, ArmEntry>;

function readCache(): ArmCache {
  try {
    return JSON.parse(localStorage.getItem(ARM_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(cache: ArmCache) {
  try {
    localStorage.setItem(ARM_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

const armMem: ArmCache = readCache();
const armInflight = new Map<number, Promise<ArmEntry | null>>();
let armFlushTimer = 0;

function armRemember(malId: number, entry: ArmEntry) {
  armMem[malId] = entry;
  window.clearTimeout(armFlushTimer);
  armFlushTimer = window.setTimeout(() => writeCache(armMem), 600);
}

async function armLookup(malId: number): Promise<ArmEntry | null> {
  const hit = armMem[malId];
  if (hit) {
    const age = Date.now() - hit.t;
    if (hit.neg ? age < ARM_NEG_TTL_MS : age < ARM_TTL_MS) return hit.neg ? null : hit;
  }
  const existing = armInflight.get(malId);
  if (existing) return existing;
  const p = (async () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ARM_TIMEOUT_MS);
    try {
      const r = await fetch(`${ARM}?source=myanimelist&id=${malId}`, { signal: ac.signal });
      if (!r.ok) {
        armRemember(malId, { t: Date.now(), neg: true });
        return null;
      }
      const j = await r.json();
      const entry: ArmEntry = { kitsu: j?.kitsu, anilist: j?.anilist, t: Date.now() };
      armRemember(malId, entry);
      return entry;
    } catch {
      armRemember(malId, { t: Date.now(), neg: true });
      return null;
    } finally {
      clearTimeout(timer);
      armInflight.delete(malId);
    }
  })();
  armInflight.set(malId, p);
  return p;
}

// A cold profile has no armcache, so an unbounded map over a catalog page opened
// one socket per card and a page of rows opened hundreds at once on a stick.
export async function armKitsuIds(malIds: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (malIds.length === 0) return out;
  let at = 0;
  const worker = async () => {
    while (at < malIds.length) {
      const malId = malIds[at++];
      const arm = await armLookup(malId);
      if (arm?.kitsu) out.set(malId, arm.kitsu);
    }
  };
  const lanes = Math.min(ARM_CONCURRENCY, malIds.length);
  await Promise.all(Array.from({ length: lanes }, worker));
  return out;
}

export const JIKAN_CACHE_TTL = 6 * 60 * 60 * 1000;

type CatalogEntry = { metas: Meta[]; t: number };

const CATALOG_KEY = "harbor.jikancatalog2";
const CATALOG_MAX = 40;
const PERSIST_DESC_MAX = 500;

const catalog = new Map<string, CatalogEntry>();

// Derived from the key, never from a flag a caller has to remember to pass.
// Title searches used to share the 40 slots with the 20 row catalogs the anime
// page is built from, and one crawl of a few hundred searches evicted every one
// of them, so every row refetched on the next cold boot.
function isSearchKey(key: string): boolean {
  return /[?&]q=/.test(key);
}

(() => {
  try {
    const raw = JSON.parse(localStorage.getItem(CATALOG_KEY) ?? "{}") as Record<
      string,
      CatalogEntry
    >;
    const now = Date.now();
    for (const [k, e] of Object.entries(raw)) {
      if (isSearchKey(k)) continue;
      if (e && Array.isArray(e.metas) && now - e.t < JIKAN_CACHE_TTL) catalog.set(k, e);
    }
  } catch {
    localStorage.removeItem(CATALOG_KEY);
  }
})();

let catalogFlushTimer = 0;

function persistCatalog() {
  window.clearTimeout(catalogFlushTimer);
  catalogFlushTimer = window.setTimeout(() => {
    try {
      const entries: Array<[string, CatalogEntry]> = [...catalog.entries()]
        .sort((a, b) => {
          const sa = isSearchKey(a[0]);
          const sb = isSearchKey(b[0]);
          if (sa !== sb) return sa ? 1 : -1;
          return b[1].t - a[1].t;
        })
        .slice(0, CATALOG_MAX)
        .map(([k, e]): [string, CatalogEntry] => [
          k,
          {
            t: e.t,
            metas: e.metas.map((m) =>
              m.description && m.description.length > PERSIST_DESC_MAX
                ? { ...m, description: `${m.description.slice(0, PERSIST_DESC_MAX)}...` }
                : m,
            ),
          },
        ]);
      localStorage.setItem(CATALOG_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      localStorage.removeItem(CATALOG_KEY);
    }
  }, 1000);
}

export function catalogGet(key: string): Meta[] | null {
  const hit = catalog.get(key);
  if (hit && Date.now() - hit.t < JIKAN_CACHE_TTL) return hit.metas;
  return null;
}

// An empty result is never stored. catalogGet answers with the array itself and
// [] is truthy, so a single empty 200 used to short-circuit the network for six
// hours across cold boots, and a row that settles empty is dropped from the page
// rather than drawn empty. Refetching a genuinely empty row is the cheap side.
export function catalogSet(key: string, metas: Meta[]): void {
  if (metas.length === 0) return;
  catalog.set(key, { metas, t: Date.now() });
  persistCatalog();
}

registerEvictable("jikan-catalog", (aggressive) => {
  if (aggressive) return catalog.clear();
  const now = Date.now();
  for (const [k, e] of catalog) if (now - e.t > JIKAN_CACHE_TTL) catalog.delete(k);
});
