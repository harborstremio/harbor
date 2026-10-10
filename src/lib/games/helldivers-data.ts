export const HELLDIVERS_STEAM_ID = 553850;
export const HELLDIVERS_API = "https://api.helldivers2.dev/api/v1";
export const HELLDIVERS_SOURCE = "https://github.com/helldivers-2/api";
export const HELLDIVERS_TTL = 60_000;
export const HELLDIVERS_STALE = 5 * 60_000;
const FACTION_ART = "https://raw.githubusercontent.com/helldivers-2/companion/4f3b5e8c9f135d90700a6d169cb1499a1b5bd081/public/factions";
export type HelldiversFaction = "Humans" | "Terminids" | "Automaton" | "Illuminate" | "unknown";
export const HELLDIVERS_FACTIONS: HelldiversFaction[] = ["Terminids", "Automaton", "Illuminate", "Humans"];
export function helldiversFactionArt(faction: HelldiversFaction): string {
  const file = { Humans: "Super_Earth", Terminids: "Terminids", Automaton: "Automatons", Illuminate: "Illuminate", unknown: "" }[faction];
  return file ? `${FACTION_ART}/${file}.webp` : "";
}
export type HelldiversRegionSize = "Settlement" | "Town" | "City" | "MegaCity";
export type HelldiversRegion = { id: number; name: string; size: HelldiversRegionSize | null; available: boolean | null; players: number | null; liberated: number | null };
export type HelldiversMapPlanet = { index: number; name: string; sector: string; owner: HelldiversFaction; position: { x: number; y: number }; waypoints: number[] };
export type HelldiversGalaxy = { planets: HelldiversMapPlanet[]; partial: boolean };
export function helldiversRegionArt(size: HelldiversRegionSize | null): string {
  return size ? `/games/helldivers/${size.toLowerCase()}.png` : "";
}
export type HelldiversCampaign = {
  id: number; planet: number; name: string; sector: string; faction: HelldiversFaction; owner: HelldiversFaction;
  position: { x: number; y: number } | null; disabled: boolean; players: number | null; liberated: number | null;
  recovery: number | null; biome: { name: string; description: string } | null; hazards: { name: string; description: string }[];
  regions: HelldiversRegion[]; event: { remaining: number | null; start: number | null; end: number | null } | null;
};
export type HelldiversCampaigns = { campaigns: HelldiversCampaign[]; partial: boolean };
export type HelldiversOrder = { id: number; title: string; briefing: string; description: string; end: number | null };
export type HelldiversOrders = { orders: HelldiversOrder[]; partial: boolean };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const count = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
function text(value: unknown, length = 200): string {
  return typeof value === "string" && value.toLowerCase() !== "null" ? value.slice(0, length).replace(/<[^>]*>/g, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim() : "";
}
function date(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const stamp = Date.parse(value);
  return Number.isFinite(stamp) && stamp >= Date.UTC(2024, 0, 1) && stamp < Date.UTC(2100, 0, 1) ? stamp : null;
}
function faction(value: unknown): HelldiversFaction { return HELLDIVERS_FACTIONS.includes(value as HelldiversFaction) ? value as HelldiversFaction : "unknown"; }
/** Territory taken. Missing or inconsistent health never becomes a fabricated zero. */
export function helldiversLiberated(health: unknown, maxHealth: unknown): number | null {
  const current = finite(health), max = finite(maxHealth);
  return current !== null && max !== null && max > 0 && current >= 0 && current <= max ? (1 - current / max) * 100 : null;
}
function condition(value: unknown) {
  const raw = record(value), name = text(raw.name);
  return name ? { name, description: text(raw.description, 3000) } : null;
}
function position(value: unknown) {
  const point = record(value), x = finite(point.x), y = finite(point.y);
  return x !== null && y !== null && Math.abs(x) <= 1.5 && Math.abs(y) <= 1.5 ? { x, y } : null;
}
export function parseHelldiversGalaxy(raw: unknown): HelldiversGalaxy {
  if (!Array.isArray(raw) || raw.length > 1000) throw Error("Invalid galaxy response");
  const planets: HelldiversMapPlanet[] = [], ids = new Set<number>(); let partial = false;
  for (const value of raw) {
    const row = record(value), index = count(row.index), name = text(row.name), point = position(row.position);
    if (index === null || !name || !point) { partial = true; continue; }
    if (ids.has(index)) throw Error("Duplicate map planet identity");
    ids.add(index);
    planets.push({ index, name, sector: text(row.sector), owner: faction(row.currentOwner), position: point,
      waypoints: Array.isArray(row.waypoints) ? [...new Set(row.waypoints.filter((id): id is number => count(id) !== null && id !== index))].slice(0, 100) : [] });
  }
  if (raw.length && !planets.length) throw Error("No readable galaxy planets");
  return { planets, partial };
}
/** The sector artwork spans the game's [-1, 1] axes, with a 7% outer margin. */
export function helldiversMapPoint(point: { x: number; y: number }) { return { x: 250 + point.x * 215, y: 250 - point.y * 215 }; }
export function helldiversMapLinks(planets: HelldiversMapPlanet[]) {
  const byId = new Map(planets.map(planet => [planet.index, planet])), seen = new Set<string>();
  return planets.flatMap(from => from.waypoints.flatMap(id => {
    const to = byId.get(id), key = [from.index, id].sort((a, b) => a - b).join(":");
    if (!to || seen.has(key)) return [];
    seen.add(key); return [{ key, from, to }];
  }));
}
/** Event and regional progress are separate objectives, never planet liberation. */
export function helldiversProgress(planet: HelldiversCampaign): { value: number | null; kind: "eventProgress" | "regionProgress" | "liberated"; region?: string } {
  if (planet.event) return { value: planet.event.remaining === null ? null : 100 - planet.event.remaining, kind: "eventProgress" };
  if (planet.owner === "Humans") return { value: 100, kind: "liberated" };
  if (planet.liberated === 0) {
    const leading = [...planet.regions].filter(region => region.liberated !== null && region.liberated > 0).sort((a, b) => b.liberated! - a.liberated!)[0];
    if (leading) return { value: leading.liberated, kind: "regionProgress", region: leading.name };
  }
  return { value: planet.liberated, kind: "liberated" };
}
export function parseHelldiversCampaigns(raw: unknown): HelldiversCampaigns {
  if (!Array.isArray(raw) || raw.length > 500) throw Error("Invalid campaign response");
  const campaigns: HelldiversCampaign[] = [], ids = new Set<number>(), planets = new Set<number>(); let partial = false;
  for (const item of raw) {
    const row = record(item), planet = record(row.planet), id = count(row.id), index = count(planet.index), name = text(planet.name);
    if (id === null || index === null || !name) { partial = true; continue; }
    if (ids.has(id) || planets.has(index)) throw Error("Duplicate campaign identity");
    ids.add(id); planets.add(index);
    const event = record(planet.event);
    const regions: HelldiversRegion[] = [], regionIds = new Set<number>();
    if (planet.regions !== undefined && (!Array.isArray(planet.regions) || planet.regions.length > 100)) partial = true;
    for (const value of Array.isArray(planet.regions) ? planet.regions.slice(0, 100) : []) {
      const region = record(value), regionId = count(region.id), regionName = text(region.name);
      if (regionId === null || !regionName || regionIds.has(regionId)) { partial = true; continue; }
      regionIds.add(regionId);
      const size = ["Settlement", "Town", "City", "MegaCity"].includes(String(region.size)) ? region.size as HelldiversRegionSize : null;
      regions.push({ id: regionId, name: regionName, size, available: typeof region.isAvailable === "boolean" ? region.isAvailable : null, players: count(region.players), liberated: helldiversLiberated(region.health, region.maxHealth) });
    }
    const hazards = Array.isArray(planet.hazards) ? planet.hazards.slice(0, 30).map(condition).filter((value): value is NonNullable<typeof value> => value !== null) : [];
    const owner = faction(planet.currentOwner), eventFaction = faction(event.faction), max = finite(planet.maxHealth), regen = finite(planet.regenPerSecond);
    if (owner === "unknown" || count(record(planet.statistics).playerCount) === null) partial = true;
    campaigns.push({
      id, planet: index, name, sector: text(planet.sector), owner, faction: eventFaction !== "unknown" ? eventFaction : owner,
      position: position(planet.position),
      disabled: planet.disabled === true, players: count(record(planet.statistics).playerCount),
      liberated: helldiversLiberated(planet.health, planet.maxHealth), recovery: max !== null && max > 0 && regen !== null ? regen * 3600 / max * 100 : null,
      biome: condition(planet.biome), hazards, regions,
      event: planet.event !== null && planet.event !== undefined ? { remaining: helldiversLiberated(event.health, event.maxHealth) === null ? null : 100 - helldiversLiberated(event.health, event.maxHealth)!, start: date(event.startTime), end: date(event.endTime) } : null,
    });
  }
  if (raw.length && !campaigns.length) throw Error("No readable campaigns");
  return { campaigns, partial };
}
export function parseHelldiversOrders(raw: unknown): HelldiversOrders {
  if (!Array.isArray(raw) || raw.length > 100) throw Error("Invalid assignments response");
  const orders: HelldiversOrder[] = [], ids = new Set<number>(); let partial = false;
  for (const value of raw) {
    const row = record(value), id = count(row.id), title = text(row.title, 400), briefing = text(row.briefing, 6000), description = text(row.description, 6000);
    if (id === null || (!title && !briefing && !description)) { partial = true; continue; }
    if (ids.has(id)) throw Error("Duplicate assignment identity");
    ids.add(id); orders.push({ id, title, briefing, description, end: date(row.expiration) });
  }
  if (raw.length && !orders.length) throw Error("No readable assignments");
  return { orders, partial };
}
export function helldiversCampaigns(data: HelldiversCampaign[], filter: string, query: string, sort: string): HelldiversCampaign[] {
  const search = query.trim().toLocaleLowerCase();
  return data.filter(planet => (filter === "all" || planet.faction === filter) && (!search || `${planet.name} ${planet.sector} ${planet.biome?.name ?? ""}`.toLocaleLowerCase().includes(search)))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : (sort === "progress" ? (helldiversProgress(b).value ?? -1) - (helldiversProgress(a).value ?? -1) : (b.players ?? -1) - (a.players ?? -1)) || a.name.localeCompare(b.name));
}
