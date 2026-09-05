import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { listLocalCw, subscribeLocalCw } from "@/lib/local-cw";
import { setExternalCwSources } from "@/lib/feed/external-cw";
import { useExternalCw } from "@/lib/feed/external-cw";
import {
  ANIME_CLOUD_ID,
  cwSortKey,
  episodeFromVideoId,
  isCwMember,
  library,
  type LibraryItem,
} from "@/lib/stremio";

export type CwCard = {
  id: string;
  type: "movie" | "series";
  name: string;
  poster?: string;
  background?: string;
  season?: number;
  episode?: number;
  videoId?: string;
  progress: number;
  at: number;
};

export function localToLibraryItem(e: ReturnType<typeof listLocalCw>[number]): LibraryItem {
  return {
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
      video_id:
        e.videoId ??
        (e.season != null && e.episode != null ? `${e.id}:${e.season}:${e.episode}` : undefined),
      flaggedWatched: e.durationMs > 0 && e.positionMs / e.durationMs >= 0.9 ? 1 : 0,
      lastWatched: new Date(e.t).toISOString(),
    },
    removed: false,
    temp: false,
    _ctime: new Date(e.t).toISOString(),
    _mtime: new Date(e.t).toISOString(),
    local: true,
  };
}

function episodeOf(i: LibraryItem): { season: number; episode: number } | null {
  const season = i.state?.season;
  const episode = i.state?.episode;
  if (season && episode) return { season, episode };
  const vid = i.state?.video_id ?? "";
  if (/^(kitsu|mal|anilist|anidb):/.test(i._id) && vid.split(":").length === 3) {
    const ep = Number(vid.split(":")[2]);
    return Number.isFinite(ep) && ep > 0 ? { season: 1, episode: ep } : null;
  }
  const parsed = episodeFromVideoId(vid);
  return parsed && parsed.episode > 0 ? parsed : null;
}

function watchedAt(i: LibraryItem): number {
  const lw = i.state?.lastWatched ? Date.parse(i.state.lastWatched) : NaN;
  if (Number.isFinite(lw)) return lw;
  const m = i._mtime ? Date.parse(i._mtime) : NaN;
  return Number.isFinite(m) ? m : 0;
}

function toCard(i: LibraryItem): CwCard {
  const ep = i.type === "movie" ? null : episodeOf(i);
  const duration = i.state?.duration ?? 0;
  const offset = i.state?.timeOffset ?? 0;
  return {
    id: i._id,
    type: i.type === "movie" ? "movie" : "series",
    name: i.name,
    poster: i.poster,
    background: i.background,
    season: ep?.season,
    episode: ep?.episode,
    videoId: i.state?.video_id,
    progress: duration > 0 ? Math.min(1, offset / duration) : 0,
    at: watchedAt(i),
  };
}

const CW_RETRY_DELAYS_MS = [1000, 4000, 10000];
let cwCacheKey: string | null = null;
let cwCacheItems: LibraryItem[] = [];

export function useContinueWatching(excludeId?: string, limit = 12): CwCard[] {
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const cwPerProfile = settings.cwPerProfile;
  const cwSources = settings.cwSources;
  useEffect(() => {
    setExternalCwSources({ trakt: cwSources.trakt, simkl: cwSources.simkl });
  }, [cwSources.trakt, cwSources.simkl]);
  const externalCw = useExternalCw(!cwPerProfile && (cwSources.trakt || cwSources.simkl));
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [localVersion, setLocalVersion] = useState(0);

  useEffect(() => {
    if (!authKey) {
      setItems([]);
      return;
    }
    let cancelled = false;
    let timer: number | null = null;
    let attempt = 0;
    if (cwCacheKey === authKey && cwCacheItems.length > 0) setItems(cwCacheItems);
    const load = () => {
      library(authKey)
        .then((li) => {
          cwCacheKey = authKey;
          cwCacheItems = li;
          attempt = 0;
          if (!cancelled) setItems(li);
        })
        .catch(() => {
          if (cancelled || attempt >= CW_RETRY_DELAYS_MS.length) return;
          const wait = CW_RETRY_DELAYS_MS[attempt];
          attempt += 1;
          timer = window.setTimeout(load, wait);
        });
    };
    load();
    const retryNow = () => {
      if (cancelled || cwCacheKey === authKey) return;
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
      attempt = 0;
      load();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") retryNow();
    };
    window.addEventListener("online", retryNow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      window.removeEventListener("online", retryNow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authKey]);

  useEffect(() => subscribeLocalCw(() => setLocalVersion((v) => v + 1)), []);

  return useMemo(() => {
    void localVersion;
    const base = cwPerProfile
      ? []
      : [
          ...(cwSources.library ? items.filter((i) => !ANIME_CLOUD_ID.test(i._id)) : []),
          ...externalCw,
        ];
    const merged = [...base, ...(cwSources.local ? listLocalCw().map(localToLibraryItem) : [])]
      .filter((i) => (i.type as string) !== "other" && !i._id.startsWith("iptv:") && isCwMember(i))
      .map((i) => ({ i, k: cwSortKey(i) }))
      .sort((a, b) => b.k - a.k)
      .map((e) => e.i);
    const seen = new Set<string>();
    const out: CwCard[] = [];
    for (const i of merged) {
      if (i._id === excludeId || seen.has(i._id)) continue;
      seen.add(i._id);
      out.push(toCard(i));
      if (out.length >= limit) break;
    }
    return out;
  }, [items, externalCw, localVersion, excludeId, limit, cwPerProfile, cwSources]);
}
