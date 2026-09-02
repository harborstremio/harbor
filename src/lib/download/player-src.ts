import type { Meta } from "@/lib/cinemeta";
import type { LocalEntry } from "@/lib/local-library";
import type { PlayEpisode, PlayerSrc } from "@/lib/view";
import type { DownloadItem } from "./downloads-store";

export function downloadPlayerSrc(
  meta: Meta,
  episode: PlayEpisode | undefined,
  item: DownloadItem,
  opts?: { imdbId?: string | null; isAnime?: boolean },
): PlayerSrc {
  const cut = Math.max(item.path.lastIndexOf("/"), item.path.lastIndexOf("\\"));
  const filename = cut >= 0 ? item.path.slice(cut + 1) : item.path;
  return {
    meta,
    imdbId: opts?.imdbId ?? undefined,
    episode,
    url: item.path,
    title: meta.name || item.title,
    subtitle: item.subtitle ?? undefined,
    notWebReady: true,
    isAnime: opts?.isAnime,
    streamRef: { resolvedFilename: filename },
  };
}

export function downloadLocalEntry(item: DownloadItem): LocalEntry {
  const cut = Math.max(item.path.lastIndexOf("/"), item.path.lastIndexOf("\\"));
  return {
    id: `download:${item.id}`,
    path: item.path,
    filename: cut >= 0 ? item.path.slice(cut + 1) : item.path,
    title: item.title,
    year: null,
    type: item.season != null && item.episode != null ? "show" : "movie",
    poster: item.poster,
    season: item.season,
    episode: item.episode,
    addedAt: item.startedAt,
  };
}
