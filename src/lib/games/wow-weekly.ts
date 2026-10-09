import type { WowCharacter, WowCharacterRun } from "./wow-character-data";
import { activeWowPeriod, type WowPeriod, type WowRegion, type WowSeason } from "./wow-data";

export type WowResetContext = { periods: WowPeriod[]; at: number; now: number };
export type WowWeeklyPeriod = { id: number; start: number; end: number; runs: WowCharacterRun[] | null; partial: boolean };
export type WowWeeklyProgress = { current: WowWeeklyPeriod; previous: WowWeeklyPeriod | null };

/** Source fields are relative to the observed reset. Never relabel a cached week at rollover. */
export function wowWeeklyProgress(character: WowCharacter, checkedAt: number, season: WowSeason | null, region: WowRegion, reset: WowResetContext | null): WowWeeklyProgress | null {
  if (!reset || !season || character.target.region !== region || character.season !== season.slug || !(season.start <= reset.now && reset.now < season.end)) return null;
  const period = activeWowPeriod(reset.periods, region, reset.now);
  // Requests have a 15-second deadline. An observation this close to reset could have begun in the prior week.
  if (!period?.matchesProvider || ![checkedAt, reset.at].every(at => Number.isFinite(at) && at >= period.start + 15_000 && at <= reset.now)) return null;
  const previous = reset.periods.find(value => value.region === region)?.periods.find(value => value.end === period.start && value.id !== period.id);
  const project = (window: { id: number; start: number; end: number }, key: "current" | "previous"): WowWeeklyPeriod => {
    const source = character.weekly[key];
    const runs = source?.runs.filter(run => run.completedAt >= Math.max(window.start, season.start) && run.completedAt < window.end && run.completedAt <= checkedAt)
      .sort((a, b) => b.level - a.level || Number(b.timed) - Number(a.timed) || b.completedAt - a.completedAt) ?? null;
    const partial = !!source && (source.partial || runs!.length !== source.runs.length);
    return { ...window, runs: source?.runs.length && !runs?.length ? null : runs, partial };
  };
  return { current: project(period, "current"), previous: previous ? project(previous, "previous") : null };
}
