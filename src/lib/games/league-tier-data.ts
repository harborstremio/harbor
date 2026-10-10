import { LEAGUE_ROLES, leaguePatch, row, type LeagueRole } from "./league-data";

export const LEAGUE_STATS = "https://lol-api-champion.op.gg/api";
export type LeagueTierRow = { id: number; role: LeagueRole; tier: number; rank: number; games: number; winRate: number; pickRate: number; banRate: number };
export type LeagueTierSnapshot = { patch: string; at: number; matches: number; rows: LeagueTierRow[] };
export function parseLeagueVersions(raw: unknown): string[] {
  const data = row(raw).data;
  const versions = Array.isArray(data) && data.length < 200 ? [...new Set(data.map(leaguePatch).filter(Boolean))] : [];
  if (!versions.length) throw Error("League versions unavailable");
  return versions;
}
export function parseLeagueTiers(raw: unknown, requestedPatch: string): LeagueTierSnapshot {
  const root = row(raw), meta = row(root.meta), patch = leaguePatch(meta.version), at = Date.parse(String(meta.analyzed_at));
  if (patch !== requestedPatch || !leaguePatch(requestedPatch) || !Array.isArray(root.data) || root.data.length > 300 || !Number.isFinite(at)) throw Error("League tier scope mismatch");
  const rows: LeagueTierRow[] = [], seen = new Set<string>();
  const nonnegative = (n: unknown, max: number) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
  for (const v of root.data) {
    const champion = row(v), id = champion.id;
    if (!Number.isSafeInteger(id) || Number(id) <= 0 || !Array.isArray(champion.positions) || champion.positions.length > 5 || champion.is_rip) continue;
    for (const p of champion.positions) {
      const position = row(p), role = String(position.name).toLowerCase() as LeagueRole, stats = row(position.stats), tier = row(stats.tier_data);
      if (!LEAGUE_ROLES.includes(role) || seen.has(`${id}:${role}`) || !Number.isSafeInteger(stats.play) || Number(stats.play) <= 0 || !nonnegative(stats.win_rate, 1) || !nonnegative(stats.pick_rate, 1) || !nonnegative(stats.ban_rate, 1) || !Number.isInteger(tier.tier) || !nonnegative(tier.tier, 5) || !Number.isSafeInteger(tier.rank) || Number(tier.rank) <= 0) continue;
      seen.add(`${id}:${role}`); rows.push({ id: Number(id), role, tier: Number(tier.tier), rank: Number(tier.rank), games: Number(stats.play), winRate: Number(stats.win_rate), pickRate: Number(stats.pick_rate), banRate: Number(stats.ban_rate) });
    }
  }
  if (!rows.length) throw Error("League tier data unavailable");
  return { patch, at, matches: nonnegative(meta.match_count, 1_000_000_000) ? Number(meta.match_count) : 0, rows };
}
