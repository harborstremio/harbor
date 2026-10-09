import { useEffect, useState } from "react";
import type { SportsGame } from "@/lib/sports/espn";
import {
  artworkCacheKey,
  cachedArtwork,
  fetchSportsArtwork,
  type SportsArtwork,
} from "@/lib/sports/hub-artwork";
export function useSportsArtwork(game?: SportsGame) {
  const key = game ? artworkCacheKey(game) : "";
  const [loaded, setLoaded] = useState<{ key: string; art: SportsArtwork }>(() => ({
    key,
    art: game ? cachedArtwork(game) : {},
  }));
  useEffect(() => {
    if (!game) return;
    let active = true;
    void fetchSportsArtwork(game).then((art) => {
      if (active) setLoaded({ key, art });
    });
    return () => {
      active = false;
    };
  }, [key]);
  if (!game) return {};
  return loaded.key === key ? { ...loaded.art, ...cachedArtwork(game) } : cachedArtwork(game);
}
