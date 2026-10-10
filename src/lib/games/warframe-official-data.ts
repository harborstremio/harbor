import { parseWarframeState, type WarframeState } from "./warframe-data";

export const WARFRAME_OFFICIAL_URL = "https://api.warframe.com/cdn/worldState.php";
export const WARFRAME_MAPPING_ROOT = "https://raw.githubusercontent.com/WFCD/warframe-worldstate-data/master/data/";
export const WARFRAME_MAPPING_FILES = ["solNodes", "missionTypes", "sortieData", "languages"] as const;
type Dict = Record<string, unknown>;
export type WarframeMappings = Record<typeof WARFRAME_MAPPING_FILES[number], Dict>;
function record(value: unknown): Dict { if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid official worldstate record"); return value as Dict; }
function array(value: unknown, max = 500): unknown[] { if (!Array.isArray(value) || value.length > max) throw Error("Invalid official worldstate list"); return value; }
function key(value: unknown) { if (typeof value !== "string" || !value || value.length > 300) throw Error("Invalid worldstate key"); return value; }
function lookup(data: Dict, value: unknown) { const name = key(value); if (!Object.hasOwn(data, name)) throw Error("Unknown worldstate reference"); return data[name]; }
function name(value: unknown, max = 300) { if (typeof value !== "string") throw Error("Invalid worldstate label"); const text = value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max); if (!text) throw Error("Empty worldstate label"); return text; }
function date(value: unknown) {
  const milliseconds = record(record(value).$date).$numberLong;
  if (typeof milliseconds !== "string" || !/^\d{13}$/.test(milliseconds)) throw Error("Invalid official worldstate date");
  return Number(milliseconds);
}
const iso = (value: number) => new Date(value).toISOString();
function period(data: Dict) { return { activation: iso(date(data.Activation)), expiry: iso(date(data.Expiry)) }; }
function identity(data: Dict) { return key(record(data._id).$oid); }
function optional<T>(fn: () => T): T | undefined { try { return fn(); } catch { return undefined; } }
export function parseWarframeMapping(value: unknown): Dict { const data = record(value), length = Object.keys(data).length; if (!length || length > 50_000) throw Error("Invalid worldstate mapping"); return data; }

// Cycle rules verified against WFCD/warframe-worldstate-parser 5.5.7 models on
// 2026-10-01. Evaluate once at the official snapshot's Time, never at a later
// client clock. New cycles require another source observation, including outages.
function cycles(data: Dict, timestamp: number) {
  const syndicates = optional(() => array(data.SyndicateMissions)) ?? [];
  const expiry = (tag: string) => date(record(syndicates.find(value => record(value).Tag === tag)).Expiry);
  const cycle = (state: string, activation: number, end: number) => {
    if (!(activation <= timestamp && timestamp < end)) throw Error("Cycle outside source snapshot");
    return { state, activation: iso(activation), expiry: iso(end) };
  };
  const cetus = optional(() => {
    const end = Math.floor(expiry("CetusSyndicate") / 60_000) * 60_000, night = end - 50 * 60_000;
    return timestamp < night ? cycle("day", end - 150 * 60_000, night) : cycle("night", night, end);
  });
  const zariman = optional(() => {
    const anchor = expiry("ZarimanSyndicate");
    if (anchor <= timestamp) throw Error("Expired Zariman bounty");
    const end = anchor - 5_000;
    const elapsed = ((end - 1655182800000) % 18_000_000 + 18_000_000) % 18_000_000;
    const rounded = Math.round(end / 60_000) * 60_000;
    return cycle(elapsed < 9_000_000 ? "corpus" : "grineer", rounded - 9_000_000, rounded);
  });
  const earthStart = Math.floor(timestamp / 14_400_000) * 14_400_000;
  const vallisStart = Date.UTC(2026, 1, 4, 19, 46, 48), vallisElapsed = ((timestamp - vallisStart) % 1_600_000 + 1_600_000) % 1_600_000;
  const duviriPosition = ((Math.floor(timestamp / 1000) - 52) % 36000 + 36000) % 36000;
  const duviriEnd = Math.floor((timestamp + (7200 - duviriPosition % 7200) * 1000) / 60_000) * 60_000;
  return {
    cetusCycle: cetus,
    cambionCycle: cetus && { ...cetus, state: cetus.state === "day" ? "fass" : "vome" },
    zarimanCycle: zariman,
    earthCycle: cycle(earthStart % 28_800_000 === 0 ? "day" : "night", earthStart, earthStart + 14_400_000),
    vallisCycle: vallisElapsed < 400_000 ? cycle("warm", timestamp - vallisElapsed, timestamp - vallisElapsed + 400_000) : cycle("cold", timestamp - vallisElapsed + 400_000, timestamp - vallisElapsed + 1_600_000),
    duviriCycle: optional(() => cycle(["sorrow", "fear", "joy", "anger", "envy"][Math.floor(duviriPosition / 7200)], duviriEnd - 7_200_000, duviriEnd)),
  };
}

export function parseOfficialWarframeState(value: unknown, maps: WarframeMappings, now = Date.now()): WarframeState {
  const raw = record(value);
  if (!Number.isSafeInteger(raw.Time) || Number(raw.Time) < 1577836800 || Number(raw.Time) > 4102444800) throw Error("Invalid official worldstate clock");
  const timestamp = Number(raw.Time) * 1000;
  const node = (key: unknown) => record(lookup(maps.solNodes, key));
  const nodeName = (value: unknown) => { const text = name(node(value).value); if (text === value) throw Error("Unmapped node"); return text; };
  const mission = (value: unknown) => name(record(lookup(maps.missionTypes, value)).value);
  const bosses = record(maps.sortieData.bosses), modifiers = record(maps.sortieData.modifierTypes), descriptions = record(maps.sortieData.modifierDescriptions);
  const operation = (value: unknown, archon: boolean) => {
    const items = array(value, 10); if (!items.length) return null;
    // A single current chain must be identified; an ambiguous feed is unavailable.
    const current = items.map(record).filter(row => date(row.Activation) <= timestamp && timestamp < date(row.Expiry));
    if (!current.length) return null;
    if (current.length !== 1) throw Error("Ambiguous operation");
    const row = current[0];
    const stages = array(archon ? row.Missions : row.Variants, 10).map(value => {
      const entry = record(value), type = mission(entry.missionType);
      return archon ? { node: nodeName(entry.node), type } : { node: nodeName(entry.node), missionType: type, modifier: name(lookup(modifiers, entry.modifierType)), modifierDescription: name(lookup(descriptions, entry.modifierType), 800) };
    });
    return { id: identity(row), ...period(row), boss: name(record(lookup(bosses, row.Boss)).name), [archon ? "missions" : "variants"]: stages };
  };
  const fissures = (value: unknown, storm: boolean) => optional(() => array(value).map(value => optional(() => {
    const row = record(value), reference = node(row.Node), modifier = key(storm ? row.ActiveMissionTier : row.Modifier);
    if (!/^VoidT[1-6]$/.test(modifier) || row.Hard !== undefined && typeof row.Hard !== "boolean") throw Error("Unknown fissure variant");
    return { id: identity(row), ...period(row), node: nodeName(row.Node), missionType: row.MissionType ? mission(row.MissionType) : name(reference.type), enemy: name(reference.enemy), tierNum: Number(modifier.slice(5)), isHard: row.Hard === true, isStorm: storm };
  }))) ?? [undefined];
  const trader = optional(() => {
    const candidates = array(raw.VoidTraders, 10).map(record).filter(row => ["Baro'Ki Teel", "Baro Ki'Teer"].includes(String(row.Character)) && date(row.Expiry) > timestamp).sort((a,b) => date(a.Activation) - date(b.Activation));
    if (!candidates.length) return null;
    const row = candidates[0];
    if (candidates.length > 1 && date(candidates[1].Activation) < date(row.Expiry)) throw Error("Ambiguous trader visit");
    return { id: identity(row), ...period(row), location: nodeName(row.Node), inventory: array(row.Manifest ?? []).map(value => {
      const item = record(value);
      return { item: name(record(lookup(maps.languages, item.ItemType)).value), ducats: item.PrimePrice, credits: item.RegularPrice };
    }) };
  });
  return { ...parseWarframeState({ timestamp: iso(timestamp), ...cycles(raw, timestamp), sortie: optional(() => operation(raw.Sorties, false)), archonHunt: optional(() => operation(raw.LiteSorties, true)), fissures: [...fissures(raw.ActiveMissions, false), ...fissures(raw.VoidStorms, true)], voidTrader: trader }, now), source: "official" };
}
