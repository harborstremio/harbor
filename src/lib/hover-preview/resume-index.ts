import type { Meta } from "../cinemeta";
import { lastPlayedEpisode, readResumeEntry } from "../resume";
import { tmdbImdbCached } from "../providers/tmdb";
import { episodeFromVideoId, type LibraryItem } from "../stremio";
import { FRESH_FRACTION, RESUME_MEMO_TTL_MS } from "./timing";

export type PreviewResume = {
  season?: number;
  episode?: number;
  fraction: number | null;
  remainingMs: number | null;
  upNext: boolean;
  external: boolean;
};

const index = new Map<string, PreviewResume>();
const fallbackMemo = new Map<string, { at: number; value: PreviewResume | null }>();

export function publishResumeStates(items: LibraryItem[]): void {
  for (const item of items) {
    const dur = item.state?.duration ?? 0;
    const off = item.state?.timeOffset ?? 0;
    const kitsuThreeSeg =
      /^(kitsu|mal|anilist|anidb):/.test(item._id) &&
      (item.state?.video_id ?? "").split(":").length === 3;
    const ep =
      item.state?.season && item.state?.episode
        ? { season: item.state.season, episode: item.state.episode }
        : kitsuThreeSeg
          ? null
          : episodeFromVideoId(item.state?.video_id);
    index.set(item._id, {
      season: ep?.season,
      episode: ep?.episode,
      fraction: dur > 0 ? Math.min(1, off / dur) : null,
      remainingMs: dur > 0 ? Math.max(0, dur - off) : null,
      upNext: item.upNext === true,
      external: item.external === "simkl",
    });
  }
}

export function formatRemaining(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h left` : `${h}h ${m}m left`;
}

function runtimeMinutes(runtime?: string): number | null {
  if (!runtime) return null;
  const hours = runtime.match(/(\d+)\s*h(?:\D*?(\d+))?/i);
  if (hours) return parseInt(hours[1], 10) * 60 + (hours[2] ? parseInt(hours[2], 10) : 0);
  const minutes = runtime.match(/(\d+)/);
  return minutes ? parseInt(minutes[1], 10) : null;
}

function fallbackLookup(meta: Meta): PreviewResume | null {
  const alt = tmdbImdbCached(meta.id);
  const ids = alt && alt !== meta.id ? [meta.id, alt] : [meta.id];
  const minutes = runtimeMinutes(meta.runtime);
  if (meta.type === "series" || meta.type === "anime") {
    for (const id of ids) {
      const last = lastPlayedEpisode(id);
      if (!last || last.ms <= 0) continue;
      const fraction = minutes ? Math.min(1, last.ms / (minutes * 60000)) : null;
      if (fraction !== null && fraction >= FRESH_FRACTION) return null;
      return {
        season: last.displaySeason ?? last.season,
        episode: last.episode,
        fraction,
        remainingMs: minutes ? Math.max(0, minutes * 60000 - last.ms) : null,
        upNext: false,
        external: false,
      };
    }
    return null;
  }
  for (const id of ids) {
    const entry = readResumeEntry(id);
    if (!entry || entry.ms <= 0) continue;
    const fraction = minutes ? Math.min(1, entry.ms / (minutes * 60000)) : null;
    if (fraction !== null && fraction >= FRESH_FRACTION) return null;
    return {
      fraction,
      remainingMs: minutes ? Math.max(0, minutes * 60000 - entry.ms) : null,
      upNext: false,
      external: false,
    };
  }
  return null;
}

export function resolveResume(meta: Meta): PreviewResume | null {
  const hit = index.get(meta.id);
  if (hit) return hit;
  const cached = fallbackMemo.get(meta.id);
  if (cached && Date.now() - cached.at < RESUME_MEMO_TTL_MS) return cached.value;
  const value = fallbackLookup(meta);
  fallbackMemo.set(meta.id, { at: Date.now(), value });
  if (fallbackMemo.size > 600) {
    const first = fallbackMemo.keys().next();
    if (!first.done) fallbackMemo.delete(first.value);
  }
  return value;
}
