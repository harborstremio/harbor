import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import type { HomeRow } from "@/views/home/home-types";
import {
  enrich,
  hydrateStripped,
  loadCloudAddons,
  mergeCloud,
  readLocalAddonEntries,
  sameEntries,
  type BpAddonEntry,
} from "./bp-addon-entries";
import { bpAddonIngestRows, bpAddonPosterStore, bpAddonTopUp } from "./bp-addon-posters";

export type { BpAddonEntry } from "./bp-addon-entries";

export type BpAddonRowData = {
  entries: readonly BpAddonEntry[];
  posters: ReadonlyMap<string, readonly string[]>;
  onFocusAddon: (transportUrl: string | null) => void;
};

const SETTLE_MS = 180;

/**
 * Reads the user's own addon list at frame 0 from localStorage, so every card
 * paints at full size before anything is asked of the network, and feeds each
 * one a poster pool keyed by the addon's own base URL.
 *
 * Signed in, the mount effect costs one POST for the cloud list plus, only when
 * a quota strip has left entries manifest-less, up to eight manifest GETs to
 * recover their marks. Signed out it costs nothing.
 *
 * Pass 2 is free but has to be handed its rows: see bpAddonIngestRows, which
 * bp-shell calls with the rows it already holds. Calling useBpCatalog() here
 * would mount a third copy of the home catalog build and a third
 * useBpExtraRows, and neither is memoised, so the row would pay for a full
 * duplicate of Trakt, Simkl, Letterboxd and every addon catalog.
 */
export function useBpAddonRow(rows?: readonly HomeRow[]): BpAddonRowData {
  const { authKey } = useAuth();
  const [entries, setEntries] = useState<BpAddonEntry[]>(readLocalAddonEntries);
  const posters = useSyncExternalStore(
    bpAddonPosterStore.subscribe,
    bpAddonPosterStore.getSnapshot,
    bpAddonPosterStore.getSnapshot,
  );
  const live = useRef(entries);
  const dwell = useRef<number | null>(null);

  useEffect(() => {
    live.current = entries;
  }, [entries]);

  useEffect(() => {
    if (rows && rows.length > 0) bpAddonIngestRows(rows);
  }, [rows]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const local = readLocalAddonEntries();
      const cloud = authKey ? await loadCloudAddons(authKey) : [];
      if (!alive) return;
      const merged = enrich(mergeCloud(local, cloud), cloud);
      // A late list that says the same thing must not hand the row a new array:
      // sixteen cards would re-render and every band-art effect would refire.
      setEntries((prev) => (sameEntries(prev, merged) ? prev : merged));
      const hydrated = await hydrateStripped(merged);
      if (alive && hydrated !== merged) setEntries(hydrated);
    })();
    return () => {
      alive = false;
    };
  }, [authKey]);

  useEffect(
    () => () => {
      if (dwell.current != null) window.clearTimeout(dwell.current);
    },
    [],
  );

  // Imperative on purpose. Scanning a row of sixteen cards must not re-render
  // the row once per step, so focus arms a timer and only a landed poster set
  // ever reaches React.
  const onFocusAddon = useCallback((transportUrl: string | null) => {
    if (dwell.current != null) window.clearTimeout(dwell.current);
    dwell.current = null;
    if (!transportUrl) return;
    const entry = live.current.find((e) => e.transportUrl === transportUrl);
    if (!entry || !entry.hasCatalogs) return;
    dwell.current = window.setTimeout(() => {
      dwell.current = null;
      void bpAddonTopUp(entry);
    }, SETTLE_MS);
  }, []);

  return { entries, posters, onFocusAddon };
}
