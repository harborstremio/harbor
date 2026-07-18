import type { Meta } from "@/lib/cinemeta";
import type { TraktItem } from "./types";

export function traktItemToMeta(item: TraktItem): Meta | null {
  const id = pickStremioId(item);
  if (!id) return null;
  return {
    id,
    type: item.type === "show" ? "series" : "movie",
    name: item.title,
    releaseInfo: item.year ? String(item.year) : undefined,
  };
}

function pickStremioId(item: TraktItem): string | null {
  if (item.ids.tmdb) {
    return item.type === "movie" ? `tmdb:movie:${item.ids.tmdb}` : `tmdb:tv:${item.ids.tmdb}`;
  }
  if (item.ids.imdb) return item.ids.imdb;
  return null;
}
