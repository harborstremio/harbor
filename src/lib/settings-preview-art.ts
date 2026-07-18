import { useEffect, useState } from "react";
import { meta, topMovies, topSeries } from "@/lib/cinemeta";
import { fetchAnilistTrendingAnime } from "@/lib/anilist/browse";

export type PreviewArt = {
  posters: string[];
  anime: string[];
  stills: string[];
};

let cache: PreviewArt | null = null;
let inflight: Promise<PreviewArt> | null = null;

async function pickStills(): Promise<string[]> {
  const series = await topSeries();
  for (const s of series.slice(0, 4)) {
    const full = await meta("series", s.id);
    const thumbs = (full?.videos ?? []).map((v) => v.thumbnail).filter((x): x is string => !!x);
    if (thumbs.length >= 2) return thumbs.slice(0, 6);
  }
  return [];
}

async function load(): Promise<PreviewArt> {
  const [movies, anime, stills] = await Promise.all([
    topMovies().catch(() => []),
    fetchAnilistTrendingAnime(12).catch(() => []),
    pickStills().catch(() => []),
  ]);
  const posterOf = (m: { poster?: string }) => m.poster;
  return {
    posters: movies
      .map(posterOf)
      .filter((x): x is string => !!x)
      .slice(0, 8),
    anime: anime
      .map(posterOf)
      .filter((x): x is string => !!x)
      .slice(0, 6),
    stills,
  };
}

export function useSettingsPreviewArt(): PreviewArt | null {
  const [art, setArt] = useState<PreviewArt | null>(cache);
  useEffect(() => {
    if (cache) {
      setArt(cache);
      return;
    }
    let alive = true;
    if (!inflight) inflight = load();
    inflight.then((a) => {
      cache = a;
      if (alive) setArt(a);
    });
    return () => {
      alive = false;
    };
  }, []);
  return art;
}
