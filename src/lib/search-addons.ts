import { isCollectionCatalog, type Addon, type CatalogDef } from "./addons";
import type { Meta } from "./cinemeta";
import { safeFetch } from "./safe-fetch";

const CAP_PER_CATALOG = 20;
const MAX_CATALOGS = 24;

function addonOrigin(addon: Addon) {
  return {
    id: addon.manifest.id,
    name: addon.manifest.name,
    logo: addon.manifest.logo,
    base: addon.transportUrl.replace(/\/manifest\.json$/, ""),
  };
}

// The Stremio manifest declares a searchable catalog two ways. Reading only
// `extra` missed every addon that uses `extraSupported`, and a never-queried
// addon is indistinguishable from one that answered with nothing, which is
// exactly what "search finds less than Stremio does" looks like from outside.
function catalogSupportsSearch(c: CatalogDef): boolean {
  if (c.extra?.some((e) => e.name === "search")) return true;
  return !!c.extraSupported?.some((e) => e === "search");
}

// A denylist, matching addons.ts and catalog-browse.ts, never an allowlist.
// Catalog type is whatever the addon author typed, so an allowlist silently
// drops "manga", "channel", "book" and any custom type, and drops "Movie" and
// "TV" purely for their capitalisation.
const NON_SEARCHABLE_TYPES = new Set(["addon_catalog"]);

function catalogIsSearchable(c: CatalogDef | undefined | null): boolean {
  if (!c?.type || !c?.id) return false;
  if (NON_SEARCHABLE_TYPES.has(c.type.toLowerCase())) return false;
  return catalogSupportsSearch(c);
}

export async function searchAddonCatalogs(
  addons: Addon[],
  query: string,
): Promise<{ movies: Meta[]; series: Meta[] }> {
  const q = query.trim();
  if (!q) return { movies: [], series: [] };

  // Round-robin, one catalog per addon per pass. Walking addon by addon and
  // breaking at the cap spent the whole budget on whichever addons happened to
  // sort first, so a title carried only by a later addon appeared under that
  // addon's own row and was missing from the fused Movies and Series rows.
  const perAddon = addons.map((addon) => ({
    addon,
    catalogs: (addon.manifest.catalogs ?? []).filter(
      (c) => catalogIsSearchable(c) && (c.type === "movie" || c.type === "series"),
    ),
  }));
  const deepest = perAddon.reduce((n, a) => Math.max(n, a.catalogs.length), 0);
  const targets: Array<{ addon: Addon; type: string; id: string; collection: boolean }> = [];
  for (let pass = 0; pass < deepest && targets.length < MAX_CATALOGS; pass++) {
    for (const { addon, catalogs } of perAddon) {
      const c = catalogs[pass];
      if (!c) continue;
      targets.push({ addon, type: c.type, id: c.id, collection: isCollectionCatalog(c) });
      if (targets.length >= MAX_CATALOGS) break;
    }
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

export type AddonQueryState = "pending" | "ok" | "empty" | "failed";

// AddonResultGroup drops any addon that returned nothing, so a timed-out addon and
// an addon that genuinely had no match are indistinguishable by the time a consumer
// sees them. That is why a slow or broken addon reads as a search that found less
// than it should. AddonQuery keeps the slot either way, and keeps the metas before
// the promotion strip in search-context removes ids already shown in the fused rows.
export type AddonQuery = {
  id: string;
  name: string;
  logo?: string;
  state: AddonQueryState;
  metas: Meta[];
};

const CAP_PER_GROUP = 14;
const GROUP_CONCURRENCY = 8;
const GROUP_TIMEOUT_MS = 20_000;
// mapLimit drains sequentially, so a per-catalog deadline alone bounds the whole
// fan-out at ceil(addons / concurrency) x GROUP_TIMEOUT_MS. Seventeen installed
// addons behind a dead network held the screen on "Searching" for a minute. This
// is the only wall clock over the entire set.
const ALL_GROUPS_BUDGET_MS = 30_000;

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), Math.max(0, ms));
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
  onQuery?: (query: AddonQuery) => void,
): Promise<AddonResultGroup[]> {
  const q = query.trim();
  if (!q) return [];

  const byAddon = new Map<
    string,
    { addon: Addon; targets: Array<{ type: string; id: string; collection: boolean }> }
  >();
  for (const addon of addons) {
    for (const c of addon.manifest.catalogs ?? []) {
      if (!catalogIsSearchable(c)) continue;
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
  // Every addon gets its slot before the first fetch starts. mapLimit only runs
  // GROUP_CONCURRENCY workers, so announcing from inside the worker would leave the
  // ninth addon invisible until a slot freed, and a row set that grows late is a row
  // set that renumbers under a viewer already stepping through it.
  if (onQuery) {
    for (const { addon } of entries) {
      const o = addonOrigin(addon);
      onQuery({ id: o.id, name: o.name, logo: o.logo, state: "pending", metas: [] });
    }
  }
  const startedAt = Date.now();
  const remainingBudget = () => ALL_GROUPS_BUDGET_MS - (Date.now() - startedAt);
  const groups = await mapLimit(entries, GROUP_CONCURRENCY, async ({ addon, targets }): Promise<AddonResultGroup> => {
      const origin = addonOrigin(addon);
      const base = origin.base;
      const settled = await Promise.allSettled(
        targets.map(async ({ type, id, collection }) => {
          const url = `${base}/catalog/${type}/${id}/search=${encodeURIComponent(q)}.json`;
          // An IPTV catalog scanning tens of thousands of titles can take ~9s, so the
          // budget is generous. It exists only so one unreachable addon cannot hang
          // the whole results section.
          //
          // The deadline covers the body read as well as the headers. safeFetch falls
          // through to a bare fetch with no signal on the web and on the plugin-http
          // path, so an addon that returns headers and then stalls its body left this
          // promise unsettled forever, and with it the addon's "pending" row.
          const read = withDeadline(
            (async () => {
              const res = await safeFetch(url, { headers: { Accept: "application/json" } });
              if (!res.ok) return null;
              return (await res.json()) as { metas?: Meta[] };
            })(),
            Math.min(GROUP_TIMEOUT_MS, remainingBudget()),
          );
          const json = await read;
          if (!json) return { collection, answered: false, metas: [] as Meta[] };
          return { collection, answered: true, metas: (json.metas ?? []).slice(0, CAP_PER_GROUP) };
        }),
      );
      const seen = new Set<string>();
      const metas: Meta[] = [];
      let answered = false;
      for (const r of settled) {
        if (r.status !== "fulfilled") continue;
        if (r.value.answered) answered = true;
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
      // Partial success is still success. "failed" means not one catalog on this
      // addon came back ok, which is the only case a viewer should be told about.
      // An addon the overall budget ran out on lands here too. It genuinely did
      // not answer, the row says so rather than going quiet, and the retry tile
      // in that row is the way back.
      onQuery?.({
        id: origin.id,
        name: origin.name,
        logo: origin.logo,
        state: !answered ? "failed" : metas.length > 0 ? "ok" : "empty",
        metas,
      });
      return group;
  });
  return groups.filter((g) => g.metas.length > 0);
}
