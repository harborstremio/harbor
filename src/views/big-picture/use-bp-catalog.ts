import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";
import { buildCinemetaRows, buildTmdbRows, mergeRows, isStreamingServiceRow } from "@/views/home/home-rows";
import { loadAddonRows, type AddonRow } from "@/lib/addons";
import { isAnimeRow } from "@/views/anime";
import { applyHomeRowCustomization } from "@/lib/home-customization";
import { bpHomeCacheLoad, bpHomeCacheSave } from "./bp-home-cache";
import { useBpExtraRows } from "./use-bp-extra-rows";
import { useBpTop10Base } from "./bp-top10-feed";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { useHideAnimeRows } from "@/lib/anime-hide";

export type BpCatalog = { rows: HomeRow[]; hero: Meta[]; loading: boolean; failed: boolean };

type Built = { rows: HomeRow[]; hero: Meta[] };

const EMPTY: Built = { rows: [], hero: [] };
const NO_METAS: Meta[] = [];
let cache: { key: string; built: Built } | null = null;

export function useBpCatalog(): BpCatalog {
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const extra = useBpExtraRows();

  const key = [
    settings.tmdbKey ? "tmdb" : "cinemeta",
    settings.homeMode ?? "",
    settings.region ?? "",
    settings.homeShowAllAddonRows ? "all" : "dedup",
    authKey ? "auth" : "anon",
  ].join(":");

  const primed = cache?.key === key ? cache.built : null;
  const [built, setBuilt] = useState<Built>(primed ?? EMPTY);
  const [loading, setLoading] = useState(!primed);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cache?.key === key) {
      setBuilt(cache.built);
      setLoading(false);
      return;
    }
    let alive = true;
    let live = false;
    setLoading(true);
    setFailed(false);

    // Last session's shelves, drawn while this session's are still in flight.
    // A television kills the process between sessions, so the module cache
    // above is always cold on the boot that matters and the viewer used to
    // watch an empty screen for twenty seconds. Never allowed to land on top
    // of a live build that already finished.
    void bpHomeCacheLoad(key).then((snap) => {
      if (!alive || live || !snap) return;
      setBuilt(snap);
      setLoading(false);
    });

    (async () => {
      try {
        const classic = settings.homeMode === "classic";
        let base: Built = EMPTY;
        if (!classic) {
          base = settings.tmdbKey
            ? await buildTmdbRows(settings).catch(() => EMPTY)
            : await buildCinemetaRows().catch(() => EMPTY);
        }
        if (base.rows.length === 0) base = await buildCinemetaRows().catch(() => EMPTY);
        if (!alive) return;

        const merged = { rows: mergeRows(base.rows, []), hero: base.hero };
        live = true;
        cache = { key, built: merged };
        setBuilt(merged);
        setFailed(merged.rows.length === 0);
        setLoading(false);
        void bpHomeCacheSave(key, merged);

        const dedup = classic ? false : !settings.homeShowAllAddonRows;
        const addons = await loadAddonRows(authKey, { dedup }).catch(() => [] as AddonRow[]);
        if (!alive || addons.length === 0) return;
        const usable = classic
          ? addons
          : addons.filter((a) => !isAnimeRow(a) && !isStreamingServiceRow(a.name));
        const withAddons = { rows: mergeRows(base.rows, usable, { dedup }), hero: base.hero };
        cache = { key, built: withAddons };
        setBuilt(withAddons);
        void bpHomeCacheSave(key, withAddons);
      } catch {
        if (alive) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [key, authKey]);

  const ordered = useMemo(() => {
    const seen = new Set<string>();
    const all: HomeRow[] = [];
    for (const row of [...extra.before, ...built.rows, ...extra.after]) {
      if (seen.has(row.key)) continue;
      seen.add(row.key);
      all.push(row);
    }
    return applyHomeRowCustomization(all, settings.homeRows, false);
  }, [extra.before, extra.after, built.rows, settings.homeRows]);

  const rows = useHideAnimeRows(ordered);
  // Desktop takes its top ten off the first home row (views/home.tsx). Nothing in
  // the TV shell ever did, so isTop10 was permanently false and the top-ten mark
  // could not appear on Home however the user had it set. Keyed on the ids so a
  // late addon merge does not hand the store a new array of the same titles.
  const lead = rows[0]?.metas.slice(0, 10) ?? NO_METAS;
  const leadKey = lead.map((m) => m.id).join("|");
  const top10 = useMemo(() => lead, [leadKey]);
  useBpTop10Base(top10);

  return { rows, hero: built.hero, loading, failed };
}
