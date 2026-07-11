import { episodeFromVideoId, type LibraryItem } from "@/lib/stremio";

function itemEpisode(item: LibraryItem): { season: number; episode: number } | null {
  const s = item.state?.season;
  const e = item.state?.episode;
  if (s != null && e != null) return { season: s, episode: e };
  return episodeFromVideoId(item.state?.video_id);
}

export function libraryItemWatchedKeys(item: LibraryItem): string[] {
  const id = item._id;
  if (!id) return [];

  if (/^tt\d+$/.test(id)) {
    if (item.type === "movie") return [`imdb:${id}`];
    const se = itemEpisode(item);
    if (item.type === "series" && se) {
      return [`imdb:${id}:${se.season}:${se.episode}`];
    }
    return [];
  }

  if (id.startsWith("tmdb:")) {
    const parts = id.split(":");
    const num = Number(parts[2]);
    if (!Number.isFinite(num)) return [];
    if (parts[1] === "movie") return [`tmdb:${num}`];
    if (parts[1] === "tv") {
      const se = itemEpisode(item);
      if (se) return [`tmdb:${num}:${se.season}:${se.episode}`];
    }
  }

  return [];
}

export function isLibraryItemWatched(item: LibraryItem, watched: Set<string>): boolean {
  if (watched.size === 0) return false;
  const keys = libraryItemWatchedKeys(item);
  for (const k of keys) {
    if (watched.has(k)) return true;
  }
  return false;
}
