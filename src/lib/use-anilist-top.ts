import { useCallback, useEffect, useState } from "react";
import { fetchAnilistTopAnime, fetchAnilistTrendingAnime } from "@/lib/anilist/browse";
import { createBrowseCache, type BrowseKey } from "@/lib/anilist/browse-cache";
import type { Meta } from "@/lib/cinemeta";

const browse = createBrowseCache(key => key === "top" ? fetchAnilistTopAnime(100) : fetchAnilistTrendingAnime(40));

export function useAnilistBrowseState(key: BrowseKey) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const [state, setState] = useState(() => ({ metas: browse.peek(key), loading: true, error: false }));
  useEffect(() => {
    let cancelled = false;
    setState({ metas: browse.peek(key), loading: true, error: false });
    browse.load(key).then(metas => {
      if (!cancelled) setState({ metas, loading: false, error: false });
    }).catch(() => {
      if (!cancelled) setState(previous => ({ ...previous, loading: false, error: true }));
    });
    return () => { cancelled = true; };
  }, [key, attempt]);
  return { ...state, retry };
}

export function useAnilistTop(): Meta[] { return useAnilistBrowseState("top").metas; }
export function useAnilistTrending(): Meta[] { return useAnilistBrowseState("trending").metas; }
