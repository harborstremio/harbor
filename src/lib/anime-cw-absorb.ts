import { isCwDismissed } from "@/lib/cw-dismiss";
import { localCwEntry, saveLocalCw } from "@/lib/local-cw";
import { ANIME_CLOUD_ID, episodeFromVideoId, type LibraryItem } from "@/lib/stremio";

const ABSORB_RECENT_MS = 45 * 864e5;

function mtimeMs(i: LibraryItem): number {
  const m = i._mtime as unknown;
  if (typeof m === "number" && Number.isFinite(m)) return m;
  const parsed = Date.parse(String(m ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function episodeOf(i: LibraryItem): { season?: number; episode?: number } {
  const season = i.state?.season;
  const episode = i.state?.episode;
  if (season && episode) return { season, episode };
  const vid = i.state?.video_id ?? "";
  const parts = vid.split(":");
  if (ANIME_CLOUD_ID.test(vid) && parts.length === 3) {
    const ep = Number(parts[2]);
    if (Number.isFinite(ep) && ep > 0) return { season: 1, episode: ep };
  }
  const parsed = episodeFromVideoId(vid);
  return parsed && parsed.episode > 0 ? parsed : {};
}

export function absorbCloudAnimeCw(items: LibraryItem[]): void {
  for (const i of items) {
    if (!ANIME_CLOUD_ID.test(i._id)) continue;
    if (i.removed && !i.temp) continue;
    const offset = i.state?.timeOffset ?? 0;
    if (offset <= 0 && !i.state?.video_id) continue;
    const t = mtimeMs(i);
    if (t <= 0 || Date.now() - t > ABSORB_RECENT_MS) continue;
    if (isCwDismissed(i)) continue;
    const existing = localCwEntry(i._id, false);
    if (existing && existing.t >= t) continue;
    const ep = episodeOf(i);
    saveLocalCw({
      id: i._id,
      type: i.type === "movie" ? "movie" : "series",
      name: i.name,
      poster: i.poster,
      background: i.background,
      season: ep.season,
      episode: ep.episode,
      videoId: i.state?.video_id ?? undefined,
      positionMs: offset,
      durationMs: i.state?.duration ?? 0,
      t,
    });
  }
}
