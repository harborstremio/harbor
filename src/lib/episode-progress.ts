import { manualWatchedState } from "@/lib/manual-watched";
import { lastPlayedEpisode, readResumeEntry } from "@/lib/resume";

export type EpisodeProgress = {
  ratio: number;
  watched: boolean;
  startedAt: number;
};

const WATCHED_THRESHOLD = 0.85;
const SEASON_DONE_RATIO = 0.9;

export function resumeDefaultSeason(
  seriesId: string,
  seasons: { seasonNumber: number; episodeCount: number }[],
  stremioWatched?: Set<string>,
  lastPlayedSeasonHint?: number | null,
): number {
  const real = seasons
    .filter((s) => s.seasonNumber >= 1)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const first = real[0]?.seasonNumber ?? seasons[0]?.seasonNumber ?? 1;
  if (real.length <= 1) return first;

  const watchedInSeason = (sn: number): number => {
    if (!stremioWatched || stremioWatched.size === 0) return 0;
    let n = 0;
    const prefix = `${sn}:`;
    for (const k of stremioWatched) if (k.startsWith(prefix)) n += 1;
    return n;
  };
  const seasonDone = (s: { seasonNumber: number; episodeCount: number }): boolean =>
    s.episodeCount > 0 && watchedInSeason(s.seasonNumber) / s.episodeCount >= SEASON_DONE_RATIO;

  const nextUnwatched = real.find((s) => !seasonDone(s))?.seasonNumber ?? null;

  const hint =
    lastPlayedSeasonHint != null && real.some((s) => s.seasonNumber === lastPlayedSeasonHint)
      ? lastPlayedSeasonHint
      : (lastPlayedEpisode(seriesId)?.season ?? null);

  if (hint != null && real.some((s) => s.seasonNumber === hint)) {
    const hintObj = real.find((s) => s.seasonNumber === hint)!;
    if (seasonDone(hintObj) && nextUnwatched != null && nextUnwatched > hint) return nextUnwatched;
    return hint;
  }

  return nextUnwatched ?? real[real.length - 1]?.seasonNumber ?? first;
}

export function getEpisodeProgress(
  resumeId: string,
  season: number,
  episode: number,
  runtimeMin: number | null,
  traktImdbId: string | null,
  traktWatched: Set<string>,
  stremioWatched?: Set<string>,
  anilistWatched?: Set<string>,
  simklWatched?: Set<string>,
  malWatched?: Set<string>,
  traktSeason?: number,
  traktEpisode?: number,
): EpisodeProgress {
  const resumeIds = traktImdbId && traktImdbId !== resumeId ? [resumeId, traktImdbId] : [resumeId];
  let entry: { ms: number; t: number } | null = null;
  for (const id of resumeIds) {
    const e = readResumeEntry(id, season, episode);
    if (e && (!entry || e.t > entry.t)) entry = e;
  }
  const startedAt = entry?.t ?? 0;

  const canonS = traktSeason ?? season;
  const canonE = traktEpisode ?? episode;
  const canonDiffers = canonS !== season || canonE !== episode;
  const manualSelf = manualWatchedState(resumeId, season, episode);
  const manualCanon = canonDiffers ? manualWatchedState(resumeId, canonS, canonE) : undefined;
  const manual = manualSelf !== undefined ? manualSelf : manualCanon;
  if (manual === false) return { ratio: 0, watched: false, startedAt };

  const ms = entry?.ms ?? 0;
  const durationMs = runtimeMin && runtimeMin > 0 ? runtimeMin * 60 * 1000 : 0;
  const ratio = durationMs > 0 && ms > 0 ? Math.min(1, ms / durationMs) : 0;

  const traktKey = traktImdbId
    ? `imdb:${traktImdbId}:${traktSeason ?? season}:${traktEpisode ?? episode}`
    : null;
  const traktDone = traktKey ? traktWatched.has(traktKey) : false;
  const stremioDone = stremioWatched ? stremioWatched.has(`${season}:${episode}`) : false;
  const anilistDone = anilistWatched ? anilistWatched.has(`${season}:${episode}`) : false;
  const simklDone = simklWatched ? simklWatched.has(`${season}:${episode}`) : false;
  const malDone = malWatched ? malWatched.has(`${season}:${episode}`) : false;
  const manualDone = resumeIds.some(
    (id) =>
      manualWatchedState(id, season, episode) === true ||
      (canonDiffers && manualWatchedState(id, canonS, canonE) === true),
  );
  const done = manualDone || traktDone || stremioDone || anilistDone || simklDone || malDone;

  return {
    ratio: done ? 1 : ratio,
    watched: done || ratio >= WATCHED_THRESHOLD,
    startedAt,
  };
}

export function formatRelativeWatched(ts: number): string {
  if (!ts) return "";
  const now = Date.now();
  const diffMs = Math.max(0, now - ts);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.floor(hour / 24);
  if (day === 1) return "yesterday";
  if (day < 7) return `${day} days ago`;
  if (day < 14) return "last week";
  if (day < 30) return `${Math.floor(day / 7)} weeks ago`;
  if (day < 365) {
    const month = Math.floor(day / 30);
    return month === 1 ? "last month" : `${month} months ago`;
  }
  const year = Math.floor(day / 365);
  return year === 1 ? "last year" : `${year} years ago`;
}
