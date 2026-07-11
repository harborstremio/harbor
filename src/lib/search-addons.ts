import type { Addon } from "./addons";
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

export async function searchAddonCatalogs(addons: Addon[], query: string): Promise<{ movies: Meta[]; series: Meta[] }> {
  const q = query.trim();
  if (!q) return { movies: [], series: [] };

  const targets: Array<{ addon: Addon; type: string; id: string }> = [];
  for (const addon of addons) {
    for (const c of addon.manifest.catalogs ?? []) {
      if (!c?.type || !c?.id) continue;
      if (c.type !== "movie" && c.type !== "series") continue;
      if (!c.extra?.some((e) => e.name === "search")) continue;
      targets.push({ addon, type: c.type, id: c.id });
      if (targets.length >= MAX_CATALOGS) break;
    }
    if (targets.length >= MAX_CATALOGS) break;
  }
  if (targets.length === 0) return { movies: [], series: [] };

  const settled = await Promise.allSettled(
    targets.map(async ({ addon, type, id }) => {
      const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
      const url = `${base}/catalog/${type}/${id}/search=${encodeURIComponent(q)}.json`;
      const res = await safeFetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return { type, metas: [] as Meta[], origin: addonOrigin(addon) };
      const json = (await res.json()) as { metas?: Meta[] };
      return { type, metas: (json.metas ?? []).slice(0, CAP_PER_CATALOG), origin: addonOrigin(addon) };
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
      const tagged = { ...m, addonOrigin: r.value.origin };
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

const MAX_GROUPS = 8;
const CAP_PER_GROUP = 14;

export async function searchAddonGroups(addons: Addon[], query: string): Promise<AddonResultGroup[]> {
  const q = query.trim();
  if (!q) return [];

  const byAddon = new Map<string, { addon: Addon; targets: Array<{ type: string; id: string }> }>();
  for (const addon of addons) {
    for (const c of addon.manifest.catalogs ?? []) {
      if (!c?.type || !c?.id) continue;
      if (c.type === "other") continue;
      if (!c.extra?.some((e) => e.name === "search")) continue;
      const entry = byAddon.get(addon.manifest.id) ?? { addon, targets: [] };
      if (entry.targets.length >= 6) continue;
      entry.targets.push({ type: c.type, id: c.id });
      byAddon.set(addon.manifest.id, entry);
    }
  }
  if (byAddon.size === 0) return [];

  const entries = [...byAddon.values()].slice(0, MAX_GROUPS);
  const groups = await Promise.all(
    entries.map(async ({ addon, targets }): Promise<AddonResultGroup> => {
      const origin = addonOrigin(addon);
      const base = origin.base;
      const settled = await Promise.allSettled(
        targets.map(async ({ type, id }) => {
          const url = `${base}/catalog/${type}/${id}/search=${encodeURIComponent(q)}.json`;
          const res = await safeFetch(url, { headers: { Accept: "application/json" } });
          if (!res.ok) return [] as Meta[];
          const json = (await res.json()) as { metas?: Meta[] };
          return (json.metas ?? []).slice(0, CAP_PER_GROUP);
        }),
      );
      const seen = new Set<string>();
      const metas: Meta[] = [];
      for (const r of settled) {
        if (r.status !== "fulfilled") continue;
        for (const m of r.value) {
          if (!m?.id || seen.has(m.id)) continue;
          seen.add(m.id);
          metas.push({ ...m, addonOrigin: origin });
          if (metas.length >= CAP_PER_GROUP) break;
        }
      }
      return { id: origin.id, name: origin.name, logo: origin.logo, metas };
    }),
  );
  return groups.filter((g) => g.metas.length > 0);
}
