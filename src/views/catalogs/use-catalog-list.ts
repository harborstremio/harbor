import type { BrowseCatalog } from "@/lib/catalog-browse";
import { useMemo } from "react";

export type AddonGroup = { name: string; logo?: string; cats: BrowseCatalog[] };
export type AddonRef = { name: string; logo?: string; count: number };

export type CatalogFilters = { query: string; typeFilter: string; addonFilter: string };

export function useCatalogList(catalogs: BrowseCatalog[], filters: CatalogFilters, pinned: string[], hidden: string[]) {
  const types = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of catalogs)
      if (!seen.has(c.type)) {
        seen.add(c.type);
        out.push(c.type);
      }
    return out;
  }, [catalogs]);

  const addons = useMemo<AddonRef[]>(() => {
    const m = new Map<string, AddonRef>();
    for (const c of catalogs) {
      const cur = m.get(c.addonName);
      if (cur) cur.count += 1;
      else m.set(c.addonName, { name: c.addonName, logo: c.addonLogo, count: 1 });
    }
    return [...m.values()];
  }, [catalogs]);

  const filtered = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return catalogs.filter((c) => {
      if (filters.typeFilter !== "all" && c.type !== filters.typeFilter) return false;
      if (filters.addonFilter !== "all" && c.addonName !== filters.addonFilter) return false;
      if (q && !`${c.name} ${c.addonName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalogs, filters.query, filters.typeFilter, filters.addonFilter]);

  const pinnedSet = useMemo(() => new Set(pinned), [pinned]);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  const pinnedCats = useMemo(() => {
    const byKey = new Map(filtered.map((c) => [c.key, c] as const));
    return pinned.map((k) => byKey.get(k)).filter((c): c is BrowseCatalog => !!c);
  }, [filtered, pinned]);

  const groups = useMemo<AddonGroup[]>(() => {
    const m = new Map<string, AddonGroup>();
    for (const c of filtered) {
      if (pinnedSet.has(c.key) || hiddenSet.has(c.key)) continue;
      let g = m.get(c.addonName);
      if (!g) {
        g = { name: c.addonName, logo: c.addonLogo, cats: [] };
        m.set(c.addonName, g);
      }
      g.cats.push(c);
    }
    return [...m.values()];
  }, [filtered, pinnedSet, hiddenSet]);

  return { types, addons, filtered, pinnedCats, pinnedSet, hiddenSet, groups };
}
