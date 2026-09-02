import { useEffect, useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useAnilist } from "@/lib/anilist/provider";
import { fetchMediaListCollection, readCachedCollection } from "@/lib/anilist/lists";
import { anilistEntryToMeta } from "@/lib/anilist/to-meta";
import type { AnilistMediaEntry } from "@/lib/anilist/types";
import { useMal } from "@/lib/mal/provider";
import { fetchMalList, readCachedMalList } from "@/lib/mal/lists";
import { malAnimeToMeta } from "@/lib/mal/to-meta";
import type { MalListEntry } from "@/lib/mal/types";
import { useSimkl } from "@/lib/simkl/provider";
import { getLocalCache, syncWatchlistCache, type SimklCache } from "@/lib/simkl/activities";
import { SIMKL_STATUS_LABELS } from "@/lib/simkl/list-status";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { fetchFullModeCatalog, fetchStremboxdCatalog } from "@/lib/stremboxd/client";
import { stremboxdMetaToMeta } from "@/lib/stremboxd/to-meta";
import { parseTs } from "@/views/library/shared";
import type { BpLibEntry, BpLibFeed, BpLibGroup, BpLibStatus } from "./bp-library-types";

const EMPTY: BpLibFeed = { entries: [], status: "ready", groups: [] };

const ANILIST_GROUPS: Array<BpLibGroup & { statuses: string[] }> = [
  { id: "watching", label: "Watching", statuses: ["CURRENT", "REPEATING"] },
  { id: "planning", label: "Plan to Watch", statuses: ["PLANNING"] },
  { id: "completed", label: "Completed", statuses: ["COMPLETED"] },
  { id: "paused", label: "On Hold", statuses: ["PAUSED"] },
  { id: "dropped", label: "Dropped", statuses: ["DROPPED"] },
];

const MAL_GROUPS: Array<BpLibGroup & { statuses: string[] }> = [
  { id: "watching", label: "Watching", statuses: ["watching"] },
  { id: "planning", label: "Plan to Watch", statuses: ["plan_to_watch"] },
  { id: "completed", label: "Completed", statuses: ["completed"] },
  { id: "paused", label: "On Hold", statuses: ["on_hold"] },
  { id: "dropped", label: "Dropped", statuses: ["dropped"] },
];

const SIMKL_GROUPS: BpLibGroup[] = (
  Object.keys(SIMKL_STATUS_LABELS) as Array<keyof typeof SIMKL_STATUS_LABELS>
).map((id) => ({ id, label: SIMKL_STATUS_LABELS[id] }));

function groupOf(groups: Array<BpLibGroup & { statuses: string[] }>, status: string): string {
  return groups.find((g) => g.statuses.includes(status))?.id ?? "";
}

function useAnilistFeed(enabled: boolean, reload: number): BpLibFeed {
  const { session } = useAnilist();
  const userId = session?.userId;
  const [raw, setRaw] = useState<AnilistMediaEntry[]>([]);
  const [status, setStatus] = useState<BpLibStatus>("loading");

  useEffect(() => {
    if (!enabled || userId == null) return;
    let alive = true;
    const cached = readCachedCollection(userId);
    if (cached) {
      setRaw(cached.flatMap((g) => g.entries));
      setStatus("ready");
    } else {
      setStatus("loading");
    }
    fetchMediaListCollection(userId)
      .then((groups) => {
        if (!alive) return;
        setRaw(groups.flatMap((g) => g.entries));
        setStatus("ready");
      })
      .catch(() => {
        if (alive && readCachedCollection(userId) == null) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [enabled, userId, reload]);

  const entries = useMemo(() => {
    const out: BpLibEntry[] = [];
    for (const e of raw) {
      const meta = anilistEntryToMeta(e);
      if (!meta) continue;
      out.push({
        key: `anilist:${e.id}`,
        meta,
        date: null,
        group: groupOf(ANILIST_GROUPS, e.status),
      });
    }
    return out;
  }, [raw]);

  return { entries, status, groups: ANILIST_GROUPS.map((g) => ({ id: g.id, label: g.label })) };
}

function useMalFeed(enabled: boolean, reload: number): BpLibFeed {
  const { isConnected } = useMal();
  const [raw, setRaw] = useState<MalListEntry[]>([]);
  const [status, setStatus] = useState<BpLibStatus>("loading");

  useEffect(() => {
    if (!enabled || !isConnected) return;
    let alive = true;
    const cached = readCachedMalList();
    if (cached) {
      setRaw(cached.flatMap((g) => g.entries));
      setStatus("ready");
    } else {
      setStatus("loading");
    }
    fetchMalList()
      .then((groups) => {
        if (!alive) return;
        setRaw(groups.flatMap((g) => g.entries));
        setStatus("ready");
      })
      .catch(() => {
        if (alive && readCachedMalList() == null) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [enabled, isConnected, reload]);

  const entries = useMemo(() => {
    const out: BpLibEntry[] = [];
    for (const e of raw) {
      const meta = malAnimeToMeta(e.anime);
      if (!meta) continue;
      out.push({
        key: `mal:${e.anime.id}`,
        meta,
        date: parseTs(e.updatedAt),
        group: groupOf(MAL_GROUPS, e.status),
      });
    }
    return out;
  }, [raw]);

  return { entries, status, groups: MAL_GROUPS.map((g) => ({ id: g.id, label: g.label })) };
}

function simklIdIndex(cache: SimklCache): Map<number, string> {
  const out = new Map<number, string>();
  // Written weakest first so the strongest id overwrites it, matching the
  // desktop preference order imdb > tmdb > mal > kitsu.
  for (const [k, v] of Object.entries(cache.kitsuToSimkl)) out.set(v, `kitsu:${k}`);
  for (const [k, v] of Object.entries(cache.malToSimkl)) out.set(v, `mal:${k}`);
  for (const [k, v] of Object.entries(cache.tmdbToSimkl)) {
    const parts = k.split(":");
    if (parts.length === 2) out.set(v, `tmdb:${parts[0]}:${parts[1]}`);
  }
  for (const [k, v] of Object.entries(cache.imdbToSimkl)) out.set(v, k);
  return out;
}

function useSimklFeed(enabled: boolean, reload: number): BpLibFeed {
  const { isConnected } = useSimkl();
  const [cache, setCache] = useState<SimklCache | null>(null);
  const [status, setStatus] = useState<BpLibStatus>("loading");

  useEffect(() => {
    if (!enabled || !isConnected) return;
    let alive = true;
    const local = getLocalCache();
    if (local) {
      setCache(local);
      setStatus("ready");
    } else {
      setStatus("loading");
    }
    syncWatchlistCache()
      .then((next) => {
        if (!alive) return;
        setCache(next);
        setStatus("ready");
      })
      .catch(() => {
        if (alive && !getLocalCache()) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [enabled, isConnected, reload]);

  const entries = useMemo(() => {
    if (!cache) return [];
    const index = simklIdIndex(cache);
    const out: BpLibEntry[] = [];
    for (const item of Object.values(cache.items)) {
      const meta: Meta = {
        id: index.get(item.simklId) ?? `simkl:${item.simklId}`,
        type: item.type === "movie" ? "movie" : "series",
        name: item.title,
        releaseInfo: item.year ? String(item.year) : undefined,
        poster: item.poster ? `https://simkl.in/posters/${item.poster}_m.jpg` : undefined,
      };
      out.push({
        key: `simkl:${item.simklId}`,
        meta,
        date: parseTs(item.watchedAt),
        group: item.status,
      });
    }
    return out;
  }, [cache]);

  return { entries, status, groups: SIMKL_GROUPS };
}

function useLetterboxdFeed(enabled: boolean, reload: number): BpLibFeed {
  const { session, configSegment } = useLetterboxd();
  const userId = session?.userId ?? null;
  const [entries, setEntries] = useState<BpLibEntry[]>([]);
  const [status, setStatus] = useState<BpLibStatus>("loading");

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setStatus("loading");
    const page = userId
      ? fetchFullModeCatalog(userId, "letterboxd-watchlist", 0)
      : fetchStremboxdCatalog(configSegment, "letterboxd-watchlist", 0);
    page
      .then((result) => {
        if (!alive) return;
        setEntries(
          result.metas.map((m) => {
            const meta = stremboxdMetaToMeta(m);
            return { key: meta.id, meta, date: null };
          }),
        );
        setStatus("ready");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [enabled, userId, configSegment, reload]);

  return { entries, status, groups: [] };
}

export function useBpServiceFeed(tab: string, reload: number): BpLibFeed {
  const anilist = useAnilistFeed(tab === "anilist", reload);
  const mal = useMalFeed(tab === "mal", reload);
  const simkl = useSimklFeed(tab === "simkl", reload);
  const letterboxd = useLetterboxdFeed(tab === "letterboxd", reload);

  if (tab === "anilist") return anilist;
  if (tab === "mal") return mal;
  if (tab === "simkl") return simkl;
  if (tab === "letterboxd") return letterboxd;
  return EMPTY;
}
