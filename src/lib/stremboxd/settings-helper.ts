import type { LetterboxdSettings } from "@/lib/settings/types";

import { encodeStremboxdConfig, type StremboxdPublicConfig } from "./config";

export function buildStremboxdConfig(settings: LetterboxdSettings): string {
  const selected = new Set(settings.selectedCatalogs);
  const username = settings.username.trim();
  const config: StremboxdPublicConfig = {
    ...(username ? { u: username } : {}),
    c: {
      popular: selected.has("letterboxd-popular"),
      top250: selected.has("letterboxd-top250"),
      ...(selected.has("letterboxd-watchlist") ? { watchlist: true } : {}),
      ...(selected.has("letterboxd-liked") ? { likedFilms: true } : {}),
    },
    l: settings.listRefs.map((r) => r.id),
    r: settings.showRatingsOnPosters,
  };
  return encodeStremboxdConfig(config);
}
