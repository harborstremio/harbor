import type { Meta } from "@/lib/cinemeta";

import type { MalAnime } from "./types";

export function malAnimeToMeta(anime: MalAnime): Meta | null {
  if (!anime.title) return null;
  return {
    id: `mal:${anime.id}`,
    type: anime.mediaType === "movie" ? "movie" : "series",
    name: anime.title,
    poster: anime.mainPicture ?? undefined,
  };
}
