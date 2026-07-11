import { useAuth } from "@/lib/auth";
import { listLocalCw, subscribeLocalCw } from "@/lib/local-cw";
import { cwSortKey, episodeFromVideoId, isCwMember, library, type LibraryItem } from "@/lib/stremio";
import { useEffect, useMemo, useState } from "react";

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
};

function localToLibraryItem(e: ReturnType<typeof listLocalCw>[number]): LibraryItem {
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
      video_id: e.videoId,
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
  };
}

export function useContinueWatching(excludeId?: string, limit = 12): CwCard[] {
  const { authKey } = useAuth();
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [localVersion, setLocalVersion] = useState(0);

  useEffect(() => {
    if (!authKey) {
      setItems([]);
      return;
    }
    let cancelled = false;
    library(authKey)
      .then((li) => {
        if (!cancelled) setItems(li);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  useEffect(() => subscribeLocalCw(() => setLocalVersion((v) => v + 1)), []);

  return useMemo(() => {
    void localVersion;
    const merged = [...items, ...listLocalCw().map(localToLibraryItem)]
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
  }, [items, localVersion, excludeId, limit]);
}
