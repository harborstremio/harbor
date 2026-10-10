export const WARFRAME_STEAM_ID = 230410;
export const WARFRAME_URL = "https://api.warframestat.us/pc";
export const WARFRAME_TTL = 120_000;
export const WARFRAME_STALE = 10 * 60_000;
export const WARFRAME_MAX_AGE = 2 * 3600_000;
export const WARFRAME_LOGO = "https://www-static.warframe.com/images/logoWhite.png";
export const WARFRAME_GUIDE = "https://www.warframe.com/en/news/open-worlds-guide";
export const WARFRAME_WORLDS = ["cetus", "vallis", "cambion", "duviri"] as const;
export type WarframeWorld = typeof WARFRAME_WORLDS[number] | "earth" | "zariman";
export type WarframePeriod = { activation: number; expiry: number };
export type WarframeCycle = WarframePeriod & { world: WarframeWorld; state: string };
export type WarframeMission = { node: string; type: string; modifier: string; description: string };
export type WarframeOperation = WarframePeriod & { id: string; boss: string; missions: WarframeMission[] };
export type WarframeFissure = WarframePeriod & { id: string; node: string; type: string; enemy: string; tier: number; hard: boolean; storm: boolean };
export type WarframeTrader = WarframePeriod & { id: string; location: string; inventory: { item: string; ducats: number; credits: number }[] };
export type WarframeState = { timestamp: number; cycles: WarframeCycle[]; trader: WarframeTrader | null; sortie: WarframeOperation | null; archon: WarframeOperation | null; fissures: WarframeFissure[]; partial: boolean; source?: "official" };

const states: Record<WarframeWorld, string[]> = {
  cetus: ["day", "night"], vallis: ["warm", "cold"], cambion: ["fass", "vome"],
  duviri: ["joy", "anger", "envy", "sorrow", "fear"], earth: ["day", "night"], zariman: ["corpus", "grineer"],
};
function record(raw: unknown): Record<string, unknown> { if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Invalid worldstate record"); return raw as Record<string, unknown>; }
const text = (raw: unknown, max = 160) => typeof raw === "string" ? raw.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
function date(raw: unknown) { const value = typeof raw === "string" ? Date.parse(raw) : NaN; if (!Number.isFinite(value) || value < Date.UTC(2020,0) || value > Date.UTC(2100,0)) throw Error("Invalid worldstate date"); return value; }
function id(raw: unknown) { if (typeof raw !== "string" || !/^[a-z\d_-]{1,160}$/i.test(raw)) throw Error("Invalid worldstate identity"); return raw; }
function integer(raw: unknown, max: number) { if (!Number.isSafeInteger(raw) || Number(raw) < 0 || Number(raw) > max) throw Error("Invalid worldstate quantity"); return Number(raw); }
function list(raw: unknown, max: number) { if (!Array.isArray(raw) || raw.length > max) throw Error("Invalid worldstate list"); return raw as unknown[]; }
function period(data: Record<string, unknown>, max = 40 * 86400_000): WarframePeriod {
  const activation = date(data.activation), expiry = date(data.expiry);
  if (expiry <= activation || expiry - activation > max) throw Error("Invalid worldstate period");
  return { activation, expiry };
}
function operation(raw: unknown, archon: boolean): WarframeOperation | null {
  if (raw === null) return null;
  const data = record(raw), boss = text(data.boss);
  const missions = list(archon ? data.missions : data.variants, 10).map(raw => {
    const row = record(raw), node = text(row.node), type = text(archon ? row.type : row.missionType);
    if (!node || !type) throw Error("Incomplete operation");
    return { node, type, modifier: text(row.modifier), description: text(row.modifierDescription, 800) };
  });
  if (!boss || !missions.length) throw Error("Incomplete operation");
  return { ...period(data), id: id(data.id), boss, missions };
}
function trader(raw: unknown): WarframeTrader | null {
  if (raw === null) return null;
  const data = record(raw), location = text(data.location), seen = new Set<string>();
  if (!location) throw Error("Missing trader location");
  const inventory = list(data.inventory, 500).map(raw => {
    const row = record(raw), item = text(row.item);
    if (!item || seen.has(item)) throw Error("Ambiguous trader inventory"); seen.add(item);
    return { item, ducats: integer(row.ducats, 1_000_000), credits: integer(row.credits, 1_000_000_000) };
  });
  return { ...period(data), id: id(data.id), location, inventory };
}
export function parseWarframeState(raw: unknown, now = Date.now()): WarframeState {
  const data = record(raw), timestamp = date(data.timestamp);
  if (timestamp > now + 5 * 60_000) throw Error("Future worldstate");
  let partial = false;
  const read = <T,>(parse: () => T, fallback: T): T => { try { return parse(); } catch { partial = true; return fallback; } };
  const cycles: WarframeCycle[] = [];
  for (const world of Object.keys(states) as WarframeWorld[]) {
    const cycle = read(() => { const row = record(data[`${world}Cycle`]), state = text(row.state).toLowerCase(); if (!states[world].includes(state)) throw Error("Unknown cycle"); return { ...period(row, 86400_000), world, state }; }, null);
    if (cycle) cycles.push(cycle);
  }
  const fissures: WarframeFissure[] = [], seen = new Set<string>();
  for (const raw of read(() => list(data.fissures, 500), [])) {
    const fissure = read(() => {
      const row = record(raw), key = id(row.id), tier = integer(row.tierNum, 6), node = text(row.node), type = text(row.missionType), enemy = text(row.enemy);
      if (!tier || !node || !type || !enemy || typeof row.isHard !== "boolean" || typeof row.isStorm !== "boolean" || seen.has(key)) throw Error("Invalid fissure");
      seen.add(key); return { ...period(row), id: key, node, type, enemy, tier, hard: row.isHard, storm: row.isStorm };
    }, null);
    if (fissure) fissures.push(fissure);
  }
  const result = { timestamp, cycles, fissures, trader: read(() => trader(data.voidTrader), null), sortie: read(() => operation(data.sortie, false), null), archon: read(() => operation(data.archonHunt, true), null), partial };
  if (!cycles.length && !fissures.length && !result.trader && !result.sortie && !result.archon && partial) throw Error("Worldstate unavailable");
  return result;
}
export function warframeActive(value: WarframePeriod | null | undefined, now: number) { return !!value && value.activation <= now && now < value.expiry; }
export function warframeUsable(value: WarframeState, now: number) { return now >= value.timestamp - 5 * 60_000 && now - value.timestamp < WARFRAME_MAX_AGE; }
export function warframeFissures(state: WarframeState, now: number, tier: string, mode: string, query: string) {
  if (!warframeUsable(state, now)) return [];
  const needle = query.trim().normalize("NFC").toLocaleLowerCase();
  return state.fissures.filter(row => warframeActive(row, now) && (tier === "all" || String(row.tier) === tier) &&
    (mode === "all" || mode === "steel" && row.hard || mode === "storm" && row.storm || mode === "normal" && !row.hard && !row.storm) &&
    `${row.node} ${row.type} ${row.enemy}`.normalize("NFC").toLocaleLowerCase().includes(needle)).sort((a,b) => a.expiry - b.expiry || a.id.localeCompare(b.id));
}
