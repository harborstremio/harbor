import { fetchAnilistTopAnime, fetchAnilistTrendingAnime } from "@/lib/anilist/browse";
import type { Meta } from "@/lib/cinemeta";
import { useEffect, useState } from "react";

const cache: Record<string, Meta[]> = {};
const inflight: Record<string, Promise<Meta[]> | undefined> = {};

function useBrowse(key: "top" | "trending"): Meta[] {
  const [metas, setMetas] = useState<Meta[]>(() => cache[key] ?? []);

  useEffect(() => {
    if (cache[key]) {
      setMetas(cache[key]);
      return;
    }
    let cancelled = false;
    if (!inflight[key]) {
      const fetcher = key === "top" ? fetchAnilistTopAnime(100) : fetchAnilistTrendingAnime(40);
      inflight[key] = fetcher.then((list) => {
        cache[key] = list;
        return list;
      });
    }
    inflight[key]
      ?.then((list) => {
        if (!cancelled) setMetas(list);
      })
      .catch((e) => {
        console.error(`[useBrowse] Anilist ${key} fetch failed:`, e);
        inflight[key] = undefined;
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return metas;
}

export function useAnilistTop(): Meta[] {
  return useBrowse("top");
}

export function useAnilistTrending(): Meta[] {
  return useBrowse("trending");
}
