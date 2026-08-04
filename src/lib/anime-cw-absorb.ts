import { isCwDismissed } from "@/lib/cw-dismiss";
import { localCwEntry, saveLocalCw } from "@/lib/local-cw";
import { ANIME_CLOUD_ID, episodeFromVideoId, type LibraryItem } from "@/lib/stremio";

const ABSORB_RECENT_MS = 45 * 864e5;

function mtimeMs(item: LibraryItem): number {
  const modified = item._mtime as unknown;
  if (typeof modified === "number" && Number.isFinite(modified)) return modified;
  const parsed = Date.parse(String(modified ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function episodeOf(item: LibraryItem): { season?: number; episode?: number } {
  const season = item.state?.season;
  const episode = item.state?.episode;
  if (season && episode) return { season, episode };
  const videoId = item.state?.video_id ?? "";
  const parts = videoId.split(":");
  if (ANIME_CLOUD_ID.test(videoId) && parts.length === 3) {
    const parsedEpisode = Number(parts[2]);
    if (Number.isFinite(parsedEpisode) && parsedEpisode > 0) {
      return { season: 1, episode: parsedEpisode };
    }
  }
  const parsed = episodeFromVideoId(videoId);
  return parsed && parsed.episode > 0 ? parsed : {};
}

export function absorbCloudAnimeCw(items: LibraryItem[]): void {
  for (const item of items) {
    if (!ANIME_CLOUD_ID.test(item._id)) continue;
    if (item.removed && !item.temp) continue;
    const offset = item.state?.timeOffset ?? 0;
    if (offset <= 0 && !item.state?.video_id) continue;
    const watchedAt = mtimeMs(item);
    if (watchedAt <= 0 || Date.now() - watchedAt > ABSORB_RECENT_MS) continue;
    if (isCwDismissed(item)) continue;
    const existing = localCwEntry(item._id);
    if (existing && existing.t >= watchedAt) continue;
    const episode = episodeOf(item);
    saveLocalCw({
      id: item._id,
      type: item.type === "movie" ? "movie" : "series",
      name: item.name,
      poster: item.poster,
      background: item.background,
      season: episode.season,
      episode: episode.episode,
      videoId: item.state?.video_id ?? undefined,
      positionMs: offset,
      durationMs: item.state?.duration ?? 0,
      t: watchedAt,
    });
  }
}
