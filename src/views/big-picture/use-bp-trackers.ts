import { useCallback, useEffect, useState } from "react";
import anilistLogo from "@/assets/anilist.png";
import malLogo from "@/assets/mal.png";
import simklLogo from "@/assets/simkl.png";
import type { Meta } from "@/lib/cinemeta";
import {
  deleteListEntry as anilistDelete,
  fetchListEntry as anilistFetch,
  saveListEntry as anilistSave,
} from "@/lib/anilist/mutations";
import { useAnilist } from "@/lib/anilist/provider";
import { resolveAnilistMediaId } from "@/lib/anilist/sync";
import type { MediaListStatus } from "@/lib/anilist/types";
import {
  deleteListEntry as malDelete,
  fetchListEntry as malFetch,
  resolveMalMediaId,
  saveListEntry as malSave,
} from "@/lib/mal/mutations";
import { useMal } from "@/lib/mal/provider";
import type { MalListStatus } from "@/lib/mal/types";
import { resolveSimklTarget } from "@/lib/simkl/ids";
import {
  clearSimklStatus,
  loadSimklStatusMap,
  MOVIE_STATUS_ORDER,
  setSimklStatus,
  SHOW_STATUS_ORDER,
  SIMKL_STATUS_LABELS,
  statusForId,
  type WatchlistStatus,
} from "@/lib/simkl/list-status";
import { useSimkl } from "@/lib/simkl/provider";
import type { SimklTarget } from "@/lib/simkl/types";

const ANIME_ID_RE = /^(kitsu|mal|anilist|anidb):/;

const ANILIST_LABELS: Record<MediaListStatus, string> = {
  CURRENT: "Watching",
  PLANNING: "Plan to Watch",
  COMPLETED: "Completed",
  REPEATING: "Rewatching",
  PAUSED: "On Hold",
  DROPPED: "Dropped",
};

const ANILIST_ORDER: MediaListStatus[] = [
  "CURRENT",
  "PLANNING",
  "COMPLETED",
  "REPEATING",
  "PAUSED",
  "DROPPED",
];

const MAL_LABELS: Record<MalListStatus, string> = {
  watching: "Watching",
  plan_to_watch: "Plan to Watch",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
};

const MAL_ORDER: MalListStatus[] = [
  "watching",
  "plan_to_watch",
  "completed",
  "on_hold",
  "dropped",
];

export type BpTrackerChoice = { id: string; label: string };

export type BpTracker = {
  key: string;
  name: string;
  logo: string;
  status: string | null;
  statusLabel: string | null;
  choices: BpTrackerChoice[];
  set: (id: string) => void;
  remove: (() => void) | null;
};

export function isBpAnime(meta: Meta): boolean {
  return meta.type === "anime" || ANIME_ID_RE.test(meta.id);
}

function useBpSimkl(harborId: string, type: "movie" | "series", enabled: boolean): BpTracker | null {
  const { isConnected } = useSimkl();
  const [target, setTarget] = useState<SimklTarget | null>(null);
  const [status, setStatus] = useState<WatchlistStatus | null>(null);

  useEffect(() => {
    setTarget(null);
    setStatus(null);
    if (!isConnected || !enabled || !harborId) return;
    let cancelled = false;
    void (async () => {
      const tgt = await resolveSimklTarget(harborId, type).catch(() => null);
      if (cancelled || !tgt) return;
      setTarget(tgt);
      const malKey = "ids" in tgt && tgt.ids.mal != null ? `mal:${tgt.ids.mal}` : null;
      const map = await loadSimklStatusMap().catch(() => null);
      if (cancelled || !map) return;
      setStatus(statusForId(map, harborId) ?? (malKey ? statusForId(map, malKey) : null));
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, type, enabled]);

  const set = useCallback(
    (id: string) => {
      if (!target) return;
      const next = id as WatchlistStatus;
      setStatus(next);
      void setSimklStatus(target, next).then(setStatus).catch(() => setStatus(status));
    },
    [target, status],
  );

  const remove = useCallback(() => {
    if (!target) return;
    const prev = status;
    setStatus(null);
    void clearSimklStatus(target).catch(() => setStatus(prev));
  }, [target, status]);

  if (!isConnected || !enabled || !target) return null;
  const order = target.kind === "movie" ? MOVIE_STATUS_ORDER : SHOW_STATUS_ORDER;
  return {
    key: "simkl",
    name: "Simkl",
    logo: simklLogo,
    status,
    statusLabel: status ? SIMKL_STATUS_LABELS[status] : null,
    choices: order.map((s) => ({ id: s, label: SIMKL_STATUS_LABELS[s] })),
    set,
    remove: status ? remove : null,
  };
}

function useBpAnilist(harborId: string, enabled: boolean): BpTracker | null {
  const { isConnected } = useAnilist();
  const [mediaId, setMediaId] = useState<number | null>(null);
  const [entryId, setEntryId] = useState<number | null>(null);
  const [status, setStatus] = useState<MediaListStatus | null>(null);

  useEffect(() => {
    setMediaId(null);
    setEntryId(null);
    setStatus(null);
    if (!isConnected || !enabled || !harborId) return;
    let cancelled = false;
    void (async () => {
      const id = await resolveAnilistMediaId(harborId).catch(() => null);
      if (cancelled || id == null) return;
      setMediaId(id);
      const info = await anilistFetch(id).catch(() => null);
      if (cancelled) return;
      setEntryId(info?.entry?.id ?? null);
      setStatus(info?.entry?.status ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, enabled]);

  const set = useCallback(
    (id: string) => {
      if (mediaId == null) return;
      const next = id as MediaListStatus;
      const prev = status;
      setStatus(next);
      void anilistSave({ mediaId, status: next })
        .then((saved) => setEntryId(saved.id))
        .catch(() => setStatus(prev));
    },
    [mediaId, status],
  );

  const remove = useCallback(() => {
    if (entryId == null) return;
    const prev = status;
    setStatus(null);
    void anilistDelete(entryId)
      .then(() => setEntryId(null))
      .catch(() => setStatus(prev));
  }, [entryId, status]);

  if (!isConnected || !enabled || mediaId == null) return null;
  return {
    key: "anilist",
    name: "AniList",
    logo: anilistLogo,
    status,
    statusLabel: status ? ANILIST_LABELS[status] : null,
    choices: ANILIST_ORDER.map((s) => ({ id: s, label: ANILIST_LABELS[s] })),
    set,
    remove: entryId != null ? remove : null,
  };
}

function useBpMal(harborId: string, enabled: boolean): BpTracker | null {
  const { isConnected } = useMal();
  const [malId, setMalId] = useState<number | null>(null);
  const [status, setStatus] = useState<MalListStatus | null>(null);

  useEffect(() => {
    setMalId(null);
    setStatus(null);
    if (!isConnected || !enabled || !harborId) return;
    let cancelled = false;
    void (async () => {
      const id = await resolveMalMediaId(harborId).catch(() => null);
      if (cancelled || id == null) return;
      setMalId(id);
      const info = await malFetch(id).catch(() => null);
      if (cancelled) return;
      setStatus(info?.entry?.status ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [harborId, isConnected, enabled]);

  const set = useCallback(
    (id: string) => {
      if (malId == null) return;
      const next = id as MalListStatus;
      const prev = status;
      setStatus(next);
      void malSave({ malId, status: next })
        .then((saved) => setStatus(saved.status))
        .catch(() => setStatus(prev));
    },
    [malId, status],
  );

  const remove = useCallback(() => {
    if (malId == null) return;
    const prev = status;
    setStatus(null);
    void malDelete(malId).catch(() => setStatus(prev));
  }, [malId, status]);

  if (!isConnected || !enabled || malId == null) return null;
  return {
    key: "mal",
    name: "MyAnimeList",
    logo: malLogo,
    status,
    statusLabel: status ? MAL_LABELS[status] : null,
    choices: MAL_ORDER.map((s) => ({ id: s, label: MAL_LABELS[s] })),
    set,
    remove: status ? remove : null,
  };
}

export function useBpTrackers(params: { meta: Meta; isMovie: boolean }): BpTracker[] {
  const { meta, isMovie } = params;
  const anime = isBpAnime(meta);
  const id = meta.id;
  const simkl = useBpSimkl(id, isMovie ? "movie" : "series", Boolean(id));
  const anilist = useBpAnilist(id, anime && Boolean(id));
  const mal = useBpMal(id, anime && Boolean(id));
  return [simkl, anilist, mal].filter((t): t is BpTracker => t !== null);
}
