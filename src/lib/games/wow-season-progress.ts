import type { WowCharacter, WowCharacterRun } from "./wow-character-data";
import type { WowDungeon, WowRegion, WowSeason } from "./wow-data";

export type WowDungeonCount = { id: number; total: number; timed: number };
export type WowDungeonProgress = { dungeon: WowDungeon; best: WowCharacterRun | null; count: WowDungeonCount | null };
export type WowProgressOrder = "season" | "score" | "untimed";

export function parseWowDungeonCounts(raw: unknown): WowDungeonCount[] | null {
  if (!Array.isArray(raw) || raw.length > 50) return null;
  const counts = new Map<number, WowDungeonCount | null>();
  for (const value of raw) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const { zone_id: id, season_runs_total: total, season_runs_timed: timed } = value;
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    if (counts.has(id) || !Number.isSafeInteger(total) || total < 0 || total > 1_000_000 || !Number.isSafeInteger(timed) || timed < 0 || timed > total) {
      counts.set(id, null);
    } else counts.set(id, { id, total, timed });
  }
  return [...counts.values()].filter((value): value is WowDungeonCount => value !== null);
}

export function wowSeasonProgress(character: WowCharacter, season: WowSeason, region: WowRegion) {
  if (character.target.region !== region || character.season !== season.slug || !season.dungeons.length) return null;
  const pool = new Set(season.dungeons.map(dungeon => dungeon.id));
  let partial = character.best === null || !!character.best?.some(run => run.zoneId === null || !pool.has(run.zoneId));
  const rows: WowDungeonProgress[] = season.dungeons.map(dungeon => {
    const best = character.best?.filter(run => run.zoneId === dungeon.id).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.level - a.level || b.completedAt - a.completedAt)[0] ?? null;
    let count = character.dungeonCounts?.find(count => count.id === dungeon.id) ?? null;
    // Conflicting provider observations cannot prove a dungeon has no runs.
    if (count && best && (count.total === 0 || best.timed && count.timed === 0)) count = null;
    if (!count || count.total > 0 && !best) partial = true;
    return { dungeon, best, count };
  });
  const complete = rows.every(row => row.count !== null);
  return {
    rows, partial,
    timedDungeons: complete ? rows.filter(row => row.count!.timed > 0).length : null,
    totalRuns: complete ? rows.reduce((sum, row) => sum + row.count!.total, 0) : null,
    timedRuns: complete ? rows.reduce((sum, row) => sum + row.count!.timed, 0) : null,
  };
}

export function orderWowProgress(rows: WowDungeonProgress[], order: WowProgressOrder) {
  if (order === "season") return rows;
  return [...rows].sort((a, b) => {
    if (order === "untimed") {
      const priority = (row: WowDungeonProgress) => row.count ? row.count.timed === 0 ? 0 : 1 : 2;
      return priority(a) - priority(b);
    }
    const score = (row: WowDungeonProgress) => row.best?.score ?? (row.count?.total === 0 ? 0 : Infinity);
    return score(a) - score(b);
  });
}
