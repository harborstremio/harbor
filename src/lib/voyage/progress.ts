import type { Meta } from "@/lib/cinemeta";
import { externalWatchedIds } from "@/lib/feed/external-watched";
import { isMovieWatchedLocal } from "@/lib/movie-watched";
import { readResumeEntry } from "@/lib/resume";
import { isWatchedFlagged } from "@/lib/watched-flag";

const DONE_RATIO = 0.9;
const START_MS = 60_000;

export function runtimeMs(meta: Meta | undefined): number {
  const raw = meta?.runtime;
  if (!raw) return 0;
  const m = /(\d+)\s*h/i.exec(raw);
  const mm = /(\d+)\s*m/i.exec(raw);
  const hours = m ? Number(m[1]) : 0;
  const mins = mm ? Number(mm[1]) : m ? 0 : Number(/(\d+)/.exec(raw)?.[1] ?? 0);
  const total = hours * 60 + mins;
  return total > 0 ? total * 60_000 : 0;
}

export function watchedOutright(id: string): boolean {
  return isMovieWatchedLocal(id) || isWatchedFlagged(id) || externalWatchedIds().has(id);
}

export function voyageProgress(id: string, meta: Meta | undefined): number {
  const ms = readResumeEntry(id)?.ms ?? 0;
  if (ms <= 0) return 0;
  const dur = runtimeMs(meta);
  if (dur <= 0) return ms >= START_MS ? 0.5 : 0;
  return Math.min(1, ms / dur);
}

export function isVoyageWatched(id: string, meta: Meta | undefined): boolean {
  if (watchedOutright(id)) return true;
  return voyageProgress(id, meta) >= DONE_RATIO;
}
