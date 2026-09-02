import { useEffect, useMemo, useRef, useState } from "react";
import { createAddonCatalogFetcher, type AddonCatalogCursor, type CatalogDef } from "@/lib/addons";
import { fetchManifestAt, loadInstalled } from "@/lib/addon-store";
import type { Meta } from "@/lib/cinemeta";
import { bpAddonBase, bpCursorFor, bpUsableCatalogs } from "./bp-addon-entries";

export type BpAddonCatalog = {
  key: string;
  name: string;
  type: string;
  cursor: AddonCatalogCursor;
};

function toCatalogs(base: string, defs: CatalogDef[]): BpAddonCatalog[] {
  const out: BpAddonCatalog[] = [];
  for (const def of defs) {
    const cursor = bpCursorFor(base, [def]);
    if (!cursor) continue;
    out.push({ key: `${def.type}:${def.id}`, name: def.name, type: def.type, cursor });
  }
  return out;
}

function localCatalogs(base: string): BpAddonCatalog[] {
  try {
    const hit = loadInstalled().find((a) => bpAddonBase(a.transportUrl) === base);
    return hit ? toCatalogs(base, bpUsableCatalogs(hit.manifest)) : [];
  } catch {
    return [];
  }
}

/**
 * The install list is a synchronous localStorage read, so a normal open paints
 * its chips in frame 0. The fetch is only for the case slimManifest already
 * documents: a quota strip leaves the entry with no manifest at all, and
 * without it this page would be permanently empty rather than one GET slow.
 */
export function useBpAddonCatalogs(base: string): {
  catalogs: BpAddonCatalog[];
  loading: boolean;
} {
  const seed = useMemo(() => localCatalogs(base), [base]);
  const [fetched, setFetched] = useState<BpAddonCatalog[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFetched(null);
    if (seed.length > 0) return;
    let alive = true;
    setLoading(true);
    void fetchManifestAt(`${base}/manifest.json`)
      .then((manifest) => {
        if (alive) setFetched(toCatalogs(base, bpUsableCatalogs(manifest)));
      })
      .catch(() => {
        if (alive) setFetched([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [base, seed]);

  return { catalogs: seed.length > 0 ? seed : (fetched ?? []), loading };
}

export function useBpAddonFeed(cursor: AddonCatalogCursor | undefined): {
  metas: Meta[];
  loading: boolean;
  done: boolean;
  loadMore: () => void;
} {
  const key = cursor ? `${cursor.base}|${cursor.type}|${cursor.id}` : "";
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // The fetcher learns the addon's page size from its first answer, so it has to
  // survive across loadMore calls or every page re-requests skip=0.
  const fetcher = useRef<((page: number, loaded?: number) => Promise<Meta[]>) | null>(null);
  const busy = useRef(false);
  const loaded = useRef(0);

  useEffect(() => {
    setMetas([]);
    setDone(false);
    loaded.current = 0;
    busy.current = false;
    fetcher.current = cursor ? createAddonCatalogFetcher(cursor) : null;
    if (!cursor) return;
    let alive = true;
    setLoading(true);
    void fetcher
      .current!(1, 0)
      .then((page) => {
        if (!alive) return;
        loaded.current = page.length;
        setMetas(page);
        setDone(page.length === 0);
      })
      .catch(() => {
        if (alive) setDone(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  const loadMore = (): void => {
    const next = fetcher.current;
    if (!next || busy.current || done || loading) return;
    busy.current = true;
    void next(2, loaded.current)
      .then((page) => {
        if (page.length === 0) {
          setDone(true);
          return;
        }
        loaded.current += page.length;
        // Addons repeat entries across pages far more often than TMDB does, and
        // a duplicated id inside a keyed grid is a React warning plus a tile
        // that shares focus state with its twin.
        setMetas((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...page.filter((m) => m.id && !seen.has(m.id))];
        });
      })
      .catch(() => setDone(true))
      .finally(() => {
        busy.current = false;
      });
  };

  return { metas, loading, done, loadMore };
}
