import type { GameSummary } from "./types";

export const EVE_COMPATIBILITY = "2026-08-18";
export const EVE_UNIVERSE = "/games/eve/universe-3569502.json";
export const EVE_PREFERENCES = ["Safer", "Shorter", "LessSecure"] as const;
export type EvePreference = typeof EVE_PREFERENCES[number];
export type EveNames = Record<string, string>;
export type EveSystem = { id: number; names: EveNames; security: number; constellation: number; region: number; wormholeClass: number };
export type EveUniverse = { build: number; released: number; systems: EveSystem[]; byId: Map<number, EveSystem>; constellations: Map<number, EveNames>; regions: Map<number, EveNames> };
export type EvePlan = { origin: number; destination: number; preference: EvePreference; avoid: number[] };
export type EveKills = { ships: number; pods: number; npcs: number };
export type EveIncursion = { constellation: number; faction: number; boss: boolean; systems: number[]; influence: number; staging: number; state: "mobilizing" | "established" | "withdrawing"; type: string };
export type EveStatus = { players: number; restricted: boolean };
export const isEve = (game: Pick<GameSummary, "steamId" | "igdbId">) => game.steamId === 8500 || (!game.steamId && game.igdbId === 2584);
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
export function eveSystemId(v: unknown): number { if (!integer(v, 30_000_000, 31_999_999)) throw Error("Invalid EVE system"); return v; }
export function eveName(names: EveNames | undefined, language: string) { return names?.[language.split("-")[0]!] ?? names?.en ?? ""; }
function names(raw: unknown): EveNames {
  const data = object(raw);
  if (!data.en || Object.keys(data).length > 12 || Object.entries(data).some(([key, value]) => !/^[a-z]{2}$/.test(key) || typeof value !== "string" || !value.trim() || value.length > 128)) throw Error("Invalid EVE names");
  return data as EveNames;
}
export function parseEveUniverse(raw: unknown): EveUniverse {
  const v = object(raw), released = typeof v.released === "string" ? Date.parse(v.released) : NaN;
  if (v.schema !== 1 || !integer(v.build, 1) || !Number.isFinite(released) || !Array.isArray(v.systems) || !v.systems.length || v.systems.length > 10_000) throw Error("Invalid EVE universe");
  const byId = new Map<number, EveSystem>();
  const systems = v.systems.map(value => {
    if (!Array.isArray(value) || value.length !== 6) throw Error("Invalid system record");
    const [id, label, security, constellation, region, wormholeClass] = value;
    if (byId.has(eveSystemId(id)) || typeof security !== "number" || !Number.isFinite(security) || security < -1 || security > 1 || !integer(constellation, 20_000_000, 29_999_999) || !integer(region, 10_000_000, 19_999_999) || !integer(wormholeClass, 0, 100)) throw Error("Invalid system record");
    const row = { id, names: names(label), security, constellation, region, wormholeClass };
    byId.set(id, row); return row;
  });
  const directory = (raw: unknown, min: number, max: number) => {
    if (!Array.isArray(raw) || raw.length > 2000) throw Error("Invalid universe directory");
    const result = new Map<number, EveNames>();
    for (const row of raw) { if (!Array.isArray(row) || !integer(row[0], min, max) || result.has(row[0])) throw Error("Invalid universe name"); result.set(row[0], names(row[1])); }
    return result;
  };
  const constellations = directory(v.constellations, 20_000_000, 29_999_999), regions = directory(v.regions, 10_000_000, 19_999_999);
  if (systems.some(row => !constellations.has(row.constellation) || !regions.has(row.region))) throw Error("Incomplete universe directory");
  return { build: v.build, released, systems, byId, constellations, regions };
}
export function eveSecurity(value: number) { return value > 0 && value < 0.05 ? 0.1 : Math.round(value * 10) / 10; }
export function eveSecurityClass(system: EveSystem) { return system.id >= 31_000_000 ? "wormhole" : eveSecurity(system.security) >= 0.5 ? "high" : system.security > 0 ? "low" : "null"; }
export function filterEveSystems(universe: EveUniverse, query: string, language: string): EveSystem[] {
  const term = query.trim().toLocaleLowerCase(language);
  if (!term) return [30000142, 30002187, 30002659, 30002510, 30002053].flatMap(id => universe.byId.get(id) ?? []);
  return universe.systems.filter(system => Object.values(system.names).some(name => name.toLocaleLowerCase(language).includes(term)))
    .sort((a, b) => Number(!Object.values(a.names).some(name => name.toLocaleLowerCase(language).startsWith(term))) - Number(!Object.values(b.names).some(name => name.toLocaleLowerCase(language).startsWith(term))) || eveName(a.names, language).localeCompare(eveName(b.names, language), language)).slice(0, 30);
}
export function evePlan(raw: unknown): EvePlan {
  const v = object(raw), origin = eveSystemId(v.origin), destination = eveSystemId(v.destination);
  if (!EVE_PREFERENCES.includes(v.preference as EvePreference) || !Array.isArray(v.avoid) || v.avoid.length > 1000) throw Error("Invalid route preference");
  const avoid = [...new Set(v.avoid.map(eveSystemId))].sort((a, b) => a - b);
  if (avoid.includes(origin) || avoid.includes(destination)) throw Error("Route endpoint excluded");
  return { origin, destination, preference: v.preference as EvePreference, avoid };
}
export const defaultEvePlan = (): EvePlan => ({ origin: 30000142, destination: 30002187, preference: "Safer", avoid: [] });
export const evePlanKey = (profile: string) => `harbor.games.eve.route:${profile}`;
export function readEvePlan(profile: string): EvePlan { try { const raw = localStorage.getItem(evePlanKey(profile)); return raw && raw.length < 16_000 ? evePlan(JSON.parse(raw)) : defaultEvePlan(); } catch { return defaultEvePlan(); } }
export function parseEveRoute(raw: unknown, plan: EvePlan): number[] {
  const route = object(raw).route;
  if (!Array.isArray(route) || !route.length || route.length > 2000) throw Error("Invalid route");
  const ids = route.map(eveSystemId);
  if (ids[0] !== plan.origin || ids.at(-1) !== plan.destination || new Set(ids).size !== ids.length || ids.some(id => plan.avoid.includes(id))) throw Error("Wrong route");
  return ids;
}
export function parseEveKills(raw: unknown): Map<number, EveKills> {
  if (!Array.isArray(raw) || raw.length > 10_000) throw Error("Invalid system activity");
  const result = new Map<number, EveKills>();
  for (const value of raw) { const v = object(value), id = eveSystemId(v.system_id); if (result.has(id) || !integer(v.ship_kills) || !integer(v.pod_kills) || !integer(v.npc_kills)) throw Error("Invalid system activity"); result.set(id, { ships: v.ship_kills, pods: v.pod_kills, npcs: v.npc_kills }); }
  return result;
}
export function parseEveIncursions(raw: unknown): EveIncursion[] {
  if (!Array.isArray(raw) || raw.length > 100) throw Error("Invalid incursions");
  const seen = new Set<number>();
  return raw.map(value => {
    const v = object(value);
    if (!integer(v.constellation_id, 20_000_000, 29_999_999) || seen.has(v.constellation_id) || !integer(v.faction_id, 500000, 599999) || typeof v.has_boss !== "boolean" || !Array.isArray(v.infested_solar_systems) || !v.infested_solar_systems.length || v.infested_solar_systems.length > 100 || typeof v.influence !== "number" || !Number.isFinite(v.influence) || v.influence < 0 || v.influence > 1 || !["mobilizing", "established", "withdrawing"].includes(String(v.state)) || typeof v.type !== "string" || v.type.length > 100) throw Error("Invalid incursion");
    seen.add(v.constellation_id); const systems = v.infested_solar_systems.map(eveSystemId), staging = eveSystemId(v.staging_solar_system_id);
    if (new Set(systems).size !== systems.length || !systems.includes(staging)) throw Error("Invalid incursion systems");
    return { constellation: v.constellation_id, faction: v.faction_id, boss: v.has_boss, systems, influence: v.influence, staging, state: v.state as EveIncursion["state"], type: v.type };
  });
}
export function parseEveStatus(raw: unknown): EveStatus { const v = object(raw); if (!integer(v.players, 0, 1_000_000) || typeof v.vip !== "boolean") throw Error("Invalid Tranquility status"); return { players: v.players, restricted: v.vip }; }
