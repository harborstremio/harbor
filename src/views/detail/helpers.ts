import { daysFromTodayLocal } from "@/lib/dates";
import type { Meta } from "@/lib/cinemeta";
import type { Episode, Season, TmdbDetail } from "@/lib/providers/tmdb";

export function isUpcomingDate(date: string | null | undefined): boolean {
  const d = daysFromTodayLocal(date);
  return d != null && d > 0;
}

export function airedWithinDays(date: string | null | undefined, days: number): boolean {
  const d = daysFromTodayLocal(date);
  return d != null && d <= 0 && d >= -days;
}

export { airedOnly } from "@/lib/aired";

export function isNewSeason(
  s: Season,
  lastEpisodeAir?: { seasonNumber: number; airDate: string | null },
): boolean {
  if (airedWithinDays(s.airDate, 30)) return true;
  if (
    lastEpisodeAir &&
    lastEpisodeAir.seasonNumber === s.seasonNumber &&
    airedWithinDays(lastEpisodeAir.airDate, 7)
  ) {
    return true;
  }
  return false;
}

export function isNewEpisode(ep: Episode): boolean {
  return airedWithinDays(ep.airDate, 3);
}

export function isUpcomingEpisode(ep: Episode): boolean {
  return isUpcomingDate(ep.airDate);
}

export function isTitleUpcoming(detail: TmdbDetail | null, meta: Meta): boolean {
  if (detail) {
    const date = detail.kind === "movie" ? detail.releaseDate : detail.firstAirDate;
    if (date) return isUpcomingDate(date);
    const s = (detail.status ?? "").toLowerCase();
    if (
      s.includes("upcoming") ||
      s.includes("unreleased") ||
      s.includes("tba") ||
      s === "planned" ||
      s === "rumored"
    ) {
      return true;
    }
    return false;
  }
  const yearStr = meta.releaseInfo;
  if (!yearStr) return false;
  const m = /^(\d{4})/.exec(yearStr);
  if (!m) return false;
  const yr = parseInt(m[1], 10);
  if (!Number.isFinite(yr)) return false;
  return yr > new Date().getFullYear();
}
