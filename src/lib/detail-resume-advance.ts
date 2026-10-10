import { manualWatchedState } from "@/lib/manual-watched";
import { readResumeEntry } from "@/lib/resume";

const FINISHED_RATIO = 0.9;

export type EpisodePoint = { season: number; episode: number };

type EpisodeRef = {
  season?: number | null;
  episode?: number | null;
  number?: number | null;
};

export function isEpisodeFinished(metaId: string, at: EpisodePoint): boolean {
  const manual = manualWatchedState(metaId, at.season, at.episode);
  if (manual !== undefined) return manual;
  const entry = readResumeEntry(metaId, at.season, at.episode);
  if (!entry || entry.ms <= 0) return false;
  return typeof entry.pct === "number" && entry.pct >= FINISHED_RATIO;
}

export function advancePastFinished(
  metaId: string,
  at: EpisodePoint,
  videos: EpisodeRef[] | undefined,
): EpisodePoint {
  if (!isEpisodeFinished(metaId, at)) return at;
  const ordered = (videos ?? [])
    .map((v) => ({ season: v.season ?? 1, episode: v.episode ?? v.number ?? 0 }))
    .filter((v) => v.season >= 1 && v.episode >= 1)
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
  const idx = ordered.findIndex((v) => v.season === at.season && v.episode === at.episode);
  if (idx < 0) return at;
  for (let i = idx + 1; i < ordered.length; i += 1) {
    if (!isEpisodeFinished(metaId, ordered[i])) return ordered[i];
  }
  return at;
}
