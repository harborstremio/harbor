import { WOW_REGIONS, type WowDungeon, type WowRegion } from "./wow-data";
import { parseWowEquipment, wowEquipmentIcon, type WowEquipment } from "./wow-equipment";

export type WowRunQuery = { season: string; region: WowRegion; dungeon: Pick<WowDungeon, "id" | "slug">; affixes: "all" | "current"; page: number };
export type WowRunMember = { id: number; name: string; realm: string; className: string; classId: number; spec: string; specId: number; role: "tank" | "healer" | "dps" | null; url: string; loadout: string | null };
export type WowDungeonRun = { id: number; rank: number; score: number | null; level: number; time: number; timer: number; completedAt: number; url: string; members: WowRunMember[]; affixes: { id: number; name: string; image: string }[]; partial: boolean };
export type WowRunPage = { runs: WowDungeonRun[]; partial: boolean; next: number | null };
export type WowRunEquipment = { id: number; equipment: WowEquipment | null; at: number | null; level: number | null };
const row = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 120) => typeof value === "string" && value.trim().length <= max ? value.trim() : "";
const number = (value: unknown, max: number): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const stamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
export function wowRunQueryValid(query: WowRunQuery) {
  return /^season-[a-z0-9-]{1,90}$/.test(query.season) && WOW_REGIONS.includes(query.region) && id(query.dungeon.id) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(query.dungeon.slug) && query.dungeon.slug.length < 100 && ["all", "current"].includes(query.affixes) && Number.isInteger(query.page) && query.page >= 0 && query.page < 100;
}
export function wowRunQueryUrl(query: WowRunQuery) {
  if (!wowRunQueryValid(query)) throw Error("Invalid dungeon query");
  return `https://raider.io/api/v1/mythic-plus/runs?${new URLSearchParams({ season: query.season, region: query.region, dungeon: query.dungeon.slug, affixes: query.affixes, page: String(query.page) })}`;
}
export function wowTalentCode(value: unknown): string | null { return typeof value === "string" && /^[A-Za-z0-9+/]{20,2000}={0,2}$/.test(value) ? value : null; }
function member(value: unknown, region: WowRegion): WowRunMember | null {
  const item = row(value), character = row(item.character), cls = row(character.class), spec = row(character.spec), realm = row(character.realm);
  const name = text(character.name, 24), realmName = text(realm.name, 80), realmSlug = text(realm.slug, 80);
  const path = typeof character.path === "string" ? character.path : "";
  let parts: string[] = []; try { parts = path.split("/").map(decodeURIComponent); } catch {}
  if (!id(character.id) || !name || !realmName || !realmSlug || row(character.region).slug !== region || parts.length !== 5 || parts[0] !== "" || parts[1] !== "characters" || parts[2] !== region || parts[3] !== realmSlug || parts[4].normalize("NFC").toLowerCase() !== name.normalize("NFC").toLowerCase()) return null;
  const className = text(cls.name), specName = text(spec.name);
  if (!className || !specName || !id(cls.id) || !id(spec.id)) return null;
  return { id: character.id, name, realm: realmName, className, classId: cls.id, spec: specName, specId: spec.id,
    role: item.role === "tank" || item.role === "healer" || item.role === "dps" ? item.role : null,
    url: `https://raider.io/characters/${region}/${encodeURIComponent(realmSlug)}/${encodeURIComponent(name)}`, loadout: wowTalentCode(item.loadout) };
}
export function parseWowDungeonRuns(raw: unknown, query: WowRunQuery): WowRunPage {
  const data = row(raw), params = row(data.params);
  if (!wowRunQueryValid(query) || params.season !== query.season || params.region !== query.region || params.dungeon !== query.dungeon.slug || params.affixes !== query.affixes || params.page !== query.page || !Array.isArray(data.rankings) || data.rankings.length > 100) throw Error("Dungeon result identity mismatch");
  let partial = false; const seen = new Set<number>();
  const runs = data.rankings.flatMap(value => {
    const entry = row(value), run = row(entry.run), dungeon = row(run.dungeon), completedAt = stamp(run.completed_at);
    const time = number(run.clear_time_ms, 24 * 3600_000), timer = number(run.keystone_time_ms, 24 * 3600_000), level = number(run.mythic_level, 100);
    if (!id(run.keystone_run_id) || seen.has(run.keystone_run_id) || run.season !== query.season || dungeon.id !== query.dungeon.id || dungeon.slug !== query.dungeon.slug || run.status !== "finished" || run.deleted_at || !id(entry.rank) || !time || !timer || !level || !Number.isInteger(level) || completedAt === null) { partial = true; return []; }
    seen.add(run.keystone_run_id);
    const members: WowRunMember[] = [], memberIds = new Set<number>();
    if (Array.isArray(run.roster) && run.roster.length <= 5) for (const value of run.roster) {
      const parsed = member(value, query.region);
      if (parsed && !memberIds.has(parsed.id)) { memberIds.add(parsed.id); members.push(parsed); }
    }
    const affixes = Array.isArray(run.weekly_modifiers) && run.weekly_modifiers.length <= 20 ? run.weekly_modifiers.flatMap(value => {
      const affix = row(value), name = text(affix.name);
      return id(affix.id) && name ? [{ id: affix.id, name, image: wowEquipmentIcon(affix.icon) }] : [];
    }) : [];
    const incomplete = members.length !== 5 || !affixes.length;
    partial ||= incomplete;
    return [{ id: run.keystone_run_id, rank: entry.rank, score: number(entry.score, 10_000), level, time, timer, completedAt, members, affixes, partial: incomplete,
      url: `https://raider.io/mythic-plus-runs/${query.season}/${run.keystone_run_id}` }];
  });
  if (data.rankings.length && !runs.length) throw Error("No usable dungeon runs");
  return { runs, partial, next: data.rankings.length === 20 && query.page < 99 ? query.page + 1 : null };
}
export function parseWowRunEquipment(raw: unknown, query: WowRunQuery, run: WowDungeonRun): WowRunEquipment[] {
  const value = row(raw);
  if (!wowRunQueryValid(query) || value.season !== query.season || value.keystone_run_id !== run.id || row(value.dungeon).id !== query.dungeon.id || row(value.dungeon).slug !== query.dungeon.slug || !Array.isArray(value.roster) || value.roster.length > 5) throw Error("Run equipment identity mismatch");
  const seen = new Set<number>();
  return value.roster.flatMap(value => {
    const parsed = member(value, query.region), items = row(row(value).items);
    if (!parsed || seen.has(parsed.id) || !run.members.some(item => item.id === parsed.id && item.classId === parsed.classId && item.specId === parsed.specId)) return [];
    seen.add(parsed.id);
    return [{ id: parsed.id, equipment: parseWowEquipment(items.items), at: stamp(items.updated_at), level: number(items.item_level_equipped, 10000) }];
  });
}
