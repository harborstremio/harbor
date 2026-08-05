import { isCollectionCatalog, type Addon } from "./addons";
import type { Meta } from "./cinemeta";
import { safeFetch } from "./safe-fetch";

const CAP_PER_CATALOG = 20;
const MAX_CATALOGS = 12;

function addonOrigin(addon: Addon) {
  return {
    id: addon.manifest.id,
    name: addon.manifest.name,
    logo: addon.manifest.logo,
    base: addon.transportUrl.replace(/\/manifest\.json$/, ""),
  };
}

export async function searchAddonCatalogs(
  addons: Addon[],
  query: string,
): Promise<{ movies: Meta[]; series: Meta[] }> {
  const q = query.trim();
  if (!q) return { movies: [], series: [] };

  const targets: Array<{ addon: Addon; type: string; id: string; collection: boolean }> = [];
  for (const addon of addons) {
    for (const c of addon.manifest.catalogs ?? []) {
      if (!c?.type || !c?.id) continue;
      if (c.type !== "movie" && c.type !== "series") continue;
      if (!c.extra?.some((e) => e.name === "search")) continue;
      targets.push({ addon, type: c.type, id: c.id, collection: isCollectionCatalog(c) });
      if (targets.length >= MAX_CATALOGS) break;
    }
    if (targets.length >= MAX_CATALOGS) break;
  }
  if (targets.length === 0) return { movies: [], series: [] };

  const settled = await Promise.allSettled(
    targets.map(async ({ addon, type, id, collection }) => {
      const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
      const url = `${base}/catalog/${type}/${id}/search=${encodeURIComponent(q)}.json`;
      const res = await safeFetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return { type, collection, metas: [] as Meta[], origin: addonOrigin(addon) };
      const json = (await res.json()) as { metas?: Meta[] };
      return {
        type,
        collection,
        metas: (json.metas ?? []).slice(0, CAP_PER_CATALOG),
        origin: addonOrigin(addon),
      };
    }),
  );

  const movies: Meta[] = [];
  const series: Meta[] = [];
  const seen = new Set<string>();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const m of r.value.metas) {
      if (!m?.id || seen.has(m.id)) continue;
      seen.add(m.id);
      const tagged = {
        ...m,
        addonOrigin: r.value.origin,
        ...(r.value.collection ? { isCollection: true } : null),
      };
      if (r.value.type === "series" || m.type === "series") series.push(tagged);
      else movies.push(tagged);
    }
  }
  return { movies, series };
}

export function mergeMetas(primary: Meta[], extra: Meta[], cap = 20): Meta[] {
  const seen = new Set(primary.map((m) => m.id));
  const out = [...primary];
  for (const m of extra) {
    if (!m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out.slice(0, cap);
}

export type AddonResultGroup = {
  id: string;
  name: string;
  logo?: string;
  metas: Meta[];
};

const CAP_PER_GROUP = 14;
const GROUP_CONCURRENCY = 8;
const GROUP_TIMEOUT_MS = 20_000;

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

// A title query can only match these. "channel" and "collections" catalogs used to
// consume group slots and push real content addons out of the results.
const SEARCHABLE_TYPES = new Set(["movie", "series", "tv", "anime"]);

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function searchAddonGroups(
  addons: Addon[],
  query: string,
  onGroup?: (group: AddonResultGroup) => void,
): Promise<AddonResultGroup[]> {
  const q = query.trim();
  if (!q) return [];

  const byAddon = new Map<
    string,
    { addon: Addon; targets: Array<{ type: string; id: string; collection: boolean }> }
  >();
  for (const addon of addons) {
    for (const c of addon.manifest.catalogs ?? []) {
      if (!c?.type || !c?.id) continue;
      if (!SEARCHABLE_TYPES.has(c.type)) continue;
      if (!c.extra?.some((e) => e.name === "search")) continue;
      const entry = byAddon.get(addon.manifest.id) ?? { addon, targets: [] };
      if (entry.targets.length >= 6) continue;
      entry.targets.push({ type: c.type, id: c.id, collection: isCollectionCatalog(c) });
      byAddon.set(addon.manifest.id, entry);
    }
  }
  if (byAddon.size === 0) return [];

  // Every addon the user installed gets asked. Truncating this list by arbitrary
  // order silently hid whichever addon happened to sort last, which is how an
  // installed IPTV addon returned nothing while the same query worked elsewhere.
  const entries = [...byAddon.values()];
  const groups = await mapLimit(entries, GROUP_CONCURRENCY, async ({ addon, targets }): Promise<AddonResultGroup> => {
      const origin = addonOrigin(addon);
      const base = origin.base;
      const settled = await Promise.allSettled(
        targets.map(async ({ type, id, collection }) => {
          const url = `${base}/catalog/${type}/${id}/search=${encodeURIComponent(q)}.json`;
          // An IPTV catalog scanning tens of thousands of titles can take ~9s, so the
          // budget is generous. It exists only so one unreachable addon cannot hang
          // the whole results section.
          const res = await withDeadline(
            safeFetch(url, { headers: { Accept: "application/json" } }),
            GROUP_TIMEOUT_MS,
          );
          if (!res || !res.ok) return { collection, metas: [] as Meta[] };
          const json = (await res.json()) as { metas?: Meta[] };
          return { collection, metas: (json.metas ?? []).slice(0, CAP_PER_GROUP) };
        }),
      );
      const seen = new Set<string>();
      const metas: Meta[] = [];
      for (const r of settled) {
        if (r.status !== "fulfilled") continue;
        for (const m of r.value.metas) {
          if (!m?.id || seen.has(m.id)) continue;
          seen.add(m.id);
          metas.push({
            ...m,
            addonOrigin: origin,
            ...(r.value.collection ? { isCollection: true } : null),
          });
          if (metas.length >= CAP_PER_GROUP) break;
        }
      }
      const group = { id: origin.id, name: origin.name, logo: origin.logo, metas };
      // Publish the moment this addon answers. A catalog scanning tens of thousands
      // of titles can take ~9s, and waiting for it used to hide every fast addon too.
      if (metas.length > 0) onGroup?.(group);
      return group;
  });
  return groups.filter((g) => g.metas.length > 0);
}
