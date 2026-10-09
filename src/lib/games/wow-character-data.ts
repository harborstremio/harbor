import { WOW_REGIONS, wowImage, type WowRegion } from "./wow-data";
import { parseWowEquipment, type WowEquipment } from "./wow-equipment";
import { parseWowDungeonCounts, type WowDungeonCount } from "./wow-season-progress";
import { parseWowTalents, type WowTalents } from "./wow-talents";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
const normalize = (value: string) => value.normalize("NFC").toLowerCase();
const realmKey = (value: string) => normalize(value).replace(/['’]/g, "").replace(/\s+/g, "-");
export type WowCharacterTarget = { region: WowRegion; realm: string; name: string };
export function wowCharacterTarget(value: unknown): WowCharacterTarget | null {
  const item = row(value), region = item.region as WowRegion;
  if (!WOW_REGIONS.includes(region) || typeof item.realm !== "string" || typeof item.name !== "string") return null;
  const realm = item.realm.trim().normalize("NFC"), name = item.name.trim().normalize("NFC");
  if (!realm || realm.length > 80 || !/^[\p{L}\p{M}\p{N} '\-’]+$/u.test(realm) || !name || name.length > 24 || !/^[\p{L}\p{M}]+$/u.test(name)) return null;
  return { region, realm, name };
}
export function wowCharacterKey(target: WowCharacterTarget): string { return `${target.region}:${realmKey(target.realm)}:${normalize(target.name)}`; }
export function wowCharacterUrl(target: WowCharacterTarget, season?: string | null): string {
  if (!wowCharacterTarget(target) || season && !/^season-[a-z0-9-]{1,90}$/.test(season)) throw Error("Invalid character query");
  const query = new URLSearchParams({ region: target.region, realm: target.realm, name: target.name,
    fields: `gear,guild,talents:categorized,mythic_plus_scores_by_season:${season || "current"},mythic_plus_recent_runs,mythic_plus_best_runs:all,mythic_plus_weekly_highest_level_runs,mythic_plus_previous_weekly_highest_level_runs,mythic_plus_dungeon_run_counts${season ? `:${season}` : ""},raid_progression:current-tier` });
  return `https://raider.io/api/v1/characters/profile?${query}`;
}
function sourceUrl(value: unknown): URL | null {
  try { const url = new URL(String(value)); return url.protocol === "https:" && url.hostname === "raider.io" && !url.username && !url.password && !url.port && !url.search && !url.hash ? url : null; } catch { return null; }
}
export function wowCharacterPortrait(value: unknown): string {
  try { const url = new URL(String(value)); return url.protocol === "https:" && url.hostname === "render.worldofwarcraft.com" && !url.username && !url.password && !url.port && /^\/(?:us|eu|kr|tw|cn)\/character\/.+\.(?:jpg|png)$/.test(url.pathname) ? url.href : ""; } catch { return ""; }
}
export type WowCharacterRun = { id: number; zoneId: number | null; dungeon: string; level: number; time: number; timed: boolean; completedAt: number; score: number | null; image: string; url: string };
function runs(value: unknown, season: string | null): WowCharacterRun[] | null {
  if (!Array.isArray(value) || value.length > 50 || !season) return null;
  const seen = new Set<number>();
  const parsed = value.flatMap(value => {
    const item = row(value), id = number(item.keystone_run_id, Number.MAX_SAFE_INTEGER), level = number(item.mythic_level, 100), time = number(item.clear_time_ms, 24 * 3600_000), par = number(item.par_time_ms, 24 * 3600_000), completedAt = date(item.completed_at), url = sourceUrl(item.url), dungeon = text(item.dungeon);
    if (!id || !Number.isSafeInteger(id) || !level || !Number.isInteger(level) || !time || !par || !completedAt || !dungeon || !url || !url.pathname.startsWith(`/mythic-plus-runs/${season}/${id}-`) || seen.has(id)) return [];
    const zoneId = number(item.zone_id, Number.MAX_SAFE_INTEGER);
    seen.add(id); return [{ id, zoneId: zoneId && Number.isSafeInteger(zoneId) ? zoneId : null, dungeon, level, time, timed: time <= par, completedAt, score: number(item.score, 10_000), image: wowImage(item.icon_url), url: url.href }];
  }).sort((a,b) => b.completedAt - a.completedAt);
  return value.length && !parsed.length ? null : parsed;
}
export type WowCharacterRaid = { slug: string; total: number; normal: number | null; heroic: number | null; mythic: number | null };
export type WowWeeklyRuns = { runs: WowCharacterRun[]; partial: boolean };
function weeklyRuns(value: unknown, season: string | null): WowWeeklyRuns | null {
  // These fields contain at most ten runs, not a weekly completion total.
  if (!Array.isArray(value) || value.length > 10) return null;
  const parsed = runs(value, season);
  return parsed ? { runs: parsed, partial: parsed.length !== value.length } : null;
}
export type WowCharacter = {
  target: WowCharacterTarget; key: string; realm: string; name: string; className: string; spec: string; guild: string; image: string; url: string;
  score: number | null; season: string | null; itemLevel: number | null; gearAt: number | null; crawledAt: number | null;
  equipment: WowEquipment | null;
  talents: WowTalents | null;
  dungeonCounts: WowDungeonCount[] | null;
  weekly: { current: WowWeeklyRuns | null; previous: WowWeeklyRuns | null };
  recent: WowCharacterRun[] | null; best: WowCharacterRun[] | null; raids: WowCharacterRaid[] | null;
};
export function parseWowCharacter(raw: unknown, target: WowCharacterTarget, expectedSeason?: string | null): WowCharacter {
  const item = row(raw), name = text(item.name, 24), realm = text(item.realm, 80), url = sourceUrl(item.profile_url);
  if (typeof item.name !== "string" || item.name.trim().length > 24 || typeof item.realm !== "string" || item.realm.trim().length > 80) throw Error("Invalid character identity");
  let parts: string[] = []; try { parts = url?.pathname.split("/").filter(Boolean).map(decodeURIComponent) ?? []; } catch {}
  if (item.region !== target.region || normalize(name) !== normalize(target.name) || parts.length !== 4 || parts[0] !== "characters" || parts[1] !== target.region || normalize(parts[3]!) !== normalize(target.name) || ![realmKey(realm), realmKey(parts[2]!)].includes(realmKey(target.realm))) throw Error("Character identity mismatch");
  const canonical = wowCharacterTarget({ region: target.region, realm: parts[2], name });
  if (!canonical || !url) throw Error("Invalid character identity");
  const scores = Array.isArray(item.mythic_plus_scores_by_season) ? item.mythic_plus_scores_by_season.filter(value => /^season-[a-z0-9-]{1,90}$/.test(String(row(value).season))) : [];
  const scoreRow = row(expectedSeason ? scores.find(value => row(value).season === expectedSeason) : scores.length === 1 ? scores[0] : null);
  const season = typeof scoreRow.season === "string" ? scoreRow.season : null;
  const gear = row(item.gear), progress = item.raid_progression;
  const raids = progress && typeof progress === "object" && !Array.isArray(progress) ? Object.entries(progress).slice(0, 50).flatMap(([slug, value]) => {
    const raid = row(value), total = number(raid.total_bosses, 100);
    if (!/^[a-z0-9-]{1,100}$/.test(slug) || !total || !Number.isInteger(total)) return [];
    const kills = (value: unknown) => { const result = number(value, total); return result !== null && Number.isInteger(result) ? result : null; };
    return [{ slug, total, normal: kills(raid.normal_bosses_killed), heroic: kills(raid.heroic_bosses_killed), mythic: kills(raid.mythic_bosses_killed) }];
  }) : null;
  const best = runs(item.mythic_plus_best_runs, season)?.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.level - a.level) ?? null;
  return { target: canonical, key: wowCharacterKey(target), name, realm, className: text(item.class), spec: text(item.active_spec_name), guild: text(row(item.guild).name), image: wowCharacterPortrait(item.thumbnail_url), url: url.href,
    score: number(row(scoreRow.scores).all, 100_000), season, itemLevel: number(gear.item_level_equipped, 10_000), gearAt: date(gear.updated_at), crawledAt: date(item.last_crawled_at),
    recent: runs(item.mythic_plus_recent_runs, season), best, raids, equipment: parseWowEquipment(gear.items), talents: parseWowTalents(item.talentLoadout), dungeonCounts: season ? parseWowDungeonCounts(item.mythic_plus_dungeon_run_counts) : null,
    weekly: { current: weeklyRuns(item.mythic_plus_weekly_highest_level_runs, season), previous: weeklyRuns(item.mythic_plus_previous_weekly_highest_level_runs, season) } };
}
export function rememberedWowCharacter(raw: string | null, region: WowRegion): WowCharacterTarget | null {
  if (!raw || raw.length > 1024) return null;
  try { const target = wowCharacterTarget(JSON.parse(raw)); return target?.region === region ? target : null; } catch { return null; }
}
