import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth";
import type { AddonRow } from "@/lib/addons";
import { loadAnimeAddonRows } from "@/lib/addons-anime-filter";
import { absorbCloudAnimeCw } from "@/lib/anime-cw-absorb";
import { detectAnimeForCw, useDetectedAnimeVersion } from "@/lib/anime-detect";
import { isCwDismissed, useCwDismissVersion } from "@/lib/cw-dismiss";
import { franchiseRoot, franchiseRootSync } from "@/lib/providers/anime-franchise-root";
import { publishResumeStates } from "@/lib/hover-preview/store";
import { runLanes } from "@/lib/run-lanes";
import { listLocalCw, localCwEntry, localCwVersion, subscribeLocalCw } from "@/lib/local-cw";
import {
  manualWatchedLibraryItems,
  manualWatchedVersion,
  subscribeManualWatched,
} from "@/lib/manual-watched";
import { useSettings } from "@/lib/settings";
import { fetchSimklPlaybackItems } from "@/lib/simkl/playback";
import { useSimkl } from "@/lib/simkl/provider";
import { ANIME_CLOUD_ID, isAnimeCwItem, isCwMember, library, type LibraryItem } from "@/lib/stremio";

const CW_CAP = 20;
// Each root is a walk of up to eight sequential kitsu calls, and the pool this
// runs over is the whole anime library, not the capped row.
const ROOT_LANES = 4;
const SETTLE_MS = 150;
const SETTLE_CAP_MS = 650;

export type BpAnimeCwBase = {
  raw: LibraryItem[];
  libItems: LibraryItem[];
  resurfaceLibrary: LibraryItem[];
  addonRows: AddonRow[];
  manualWatchedVer: number;
  animeDetectVer: number;
  ready: boolean;
};

function localItems(): LibraryItem[] {
  return listLocalCw()
    .filter((e) => ANIME_CLOUD_ID.test(e.id))
    .map((e) => ({
      _id: e.id,
      type: e.type,
      name: e.name,
      poster: e.poster,
      background: e.background,
      state: {
        timeOffset: e.positionMs,
        duration: e.durationMs,
        season: e.season,
        episode: e.episode,
        video_id: e.videoId,
        flaggedWatched: e.durationMs > 0 && e.positionMs / e.durationMs >= 0.9 ? 1 : 0,
        lastWatched: new Date(e.t).toISOString(),
      },
      removed: false,
      temp: false,
      _ctime: new Date(e.t).toISOString(),
      _mtime: new Date(e.t).toISOString(),
      local: true,
    }));
}

export function useBpAnimeCwBase(): BpAnimeCwBase {
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const { isConnected: simklConnected } = useSimkl();
  const cwVersion = useCwDismissVersion();
  const animeDetectVer = useDetectedAnimeVersion();
  const localCwVer = useSyncExternalStore(subscribeLocalCw, localCwVersion);
  const manualWatchedVer = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const [libItems, setLibItems] = useState<LibraryItem[]>([]);
  const [simklCw, setSimklCw] = useState<LibraryItem[]>([]);
  const [addonRows, setAddonRows] = useState<AddonRow[]>([]);
  const [rootVersion, setRootVersion] = useState(0);

  useEffect(() => {
    if (!authKey) {
      setLibItems([]);
      return;
    }
    const load = () => {
      library(authKey)
        .then((li) => {
          setLibItems(li);
          if (!settings.cwPerProfile) absorbCloudAnimeCw(li);
        })
        .catch(() => setLibItems([]));
    };
    load();
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [authKey, settings.cwPerProfile]);

  // Catalogs do not depend on cwPerProfile, so this used to re-sweep every installed
  // addon whenever that toggle moved. Keyed on authKey alone, and the returned canceller
  // is what stops a stale sign-in's rows from landing after a switch.
  useEffect(() => {
    if (!authKey) {
      setAddonRows([]);
      return;
    }
    return loadAnimeAddonRows(authKey, setAddonRows);
  }, [authKey]);

  useEffect(() => {
    if (!simklConnected) {
      setSimklCw([]);
      return;
    }
    let cancelled = false;
    fetchSimklPlaybackItems()
      .then((cw) => {
        if (!cancelled) setSimklCw(cw.filter(isAnimeCwItem));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected]);

  const localAnimeCw = useMemo<LibraryItem[]>(() => {
    void localCwVer;
    return localItems();
  }, [localCwVer]);

  const pool = useMemo(
    () => [...localAnimeCw, ...libItems.filter((i) => !ANIME_CLOUD_ID.test(i._id)), ...simklCw],
    [localAnimeCw, libItems, simklCw],
  );

  const raw = useMemo(() => {
    void cwVersion;
    void animeDetectVer;
    void rootVersion;
    const seen = new Set<string>();
    const seenRoot = new Set<string>();
    return pool
      .filter((i) => {
        if (!isCwMember(i)) return false;
        if (!i.local && !isAnimeCwItem(i)) return false;
        if (isCwDismissed(i)) return false;
        if (settings.cwPerProfile && localCwEntry(i._id) === null && !i.local) return false;
        if (seen.has(i._id)) return false;
        seen.add(i._id);
        return true;
      })
      .sort(
        (a, b) =>
          Date.parse(b.state?.lastWatched ?? b._mtime) -
          Date.parse(a.state?.lastWatched ?? a._mtime),
      )
      .filter((i) => {
        const root = franchiseRootSync(i._id);
        if (!root) return true;
        if (seenRoot.has(root)) return false;
        seenRoot.add(root);
        return true;
      })
      .slice(0, CW_CAP);
  }, [pool, cwVersion, animeDetectVer, rootVersion, settings.cwPerProfile]);

  // franchiseRootSync only answers once the walk is warm, so the collapse runs in
  // two phases or three seasons of one show sit in the row.
  useEffect(() => {
    const ids = pool
      .filter((i) => isCwMember(i) && (i.local || isAnimeCwItem(i)))
      .map((i) => i._id);
    if (ids.length === 0) return;
    if (ids.every((id) => franchiseRootSync(id))) return;
    let cancelled = false;
    void runLanes(ids, ROOT_LANES, (id) => franchiseRoot(id).catch(() => id)).then(() => {
      if (!cancelled) setRootVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [pool]);

  useEffect(() => {
    publishResumeStates(raw);
  }, [raw]);

  useEffect(() => {
    void detectAnimeForCw(libItems);
  }, [libItems]);

  const resurfaceLibrary = useMemo(() => {
    void manualWatchedVer;
    const manual = manualWatchedLibraryItems().filter(isAnimeCwItem);
    if (manual.length === 0) return libItems;
    const memberIds = new Set(libItems.filter(isCwMember).map((i) => i._id));
    const usable = manual.filter((i) => !memberIds.has(i._id));
    if (usable.length === 0) return libItems;
    const overrideIds = new Set(usable.map((i) => i._id));
    return [...libItems.filter((i) => !overrideIds.has(i._id)), ...usable];
  }, [libItems, manualWatchedVer]);

  const sig = raw.map((i) => `${i._id}:${i.state?.season ?? ""}:${i.state?.episode ?? ""}`).join("|");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    const settle = window.setTimeout(() => setReady(true), SETTLE_MS);
    return () => window.clearTimeout(settle);
  }, [sig, ready]);
  useEffect(() => {
    const cap = window.setTimeout(() => setReady(true), SETTLE_CAP_MS);
    return () => window.clearTimeout(cap);
  }, []);

  return {
    raw,
    libItems,
    resurfaceLibrary,
    addonRows,
    manualWatchedVer,
    animeDetectVer,
    ready,
  };
}
