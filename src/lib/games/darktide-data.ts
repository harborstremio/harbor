export const DARKTIDE_STEAM_ID = 1361210;
export const DARKTIDE_SOURCE = "https://darktide-mission.otwako.dev/";
export const DARKTIDE_TTL = 120_000;
export const DARKTIDE_STALE = 5 * 60_000;

// Exact map identities and original scene filenames published by the feed owner.
// Unknown/new maps keep their identity; they never inherit another map's artwork.
const MAPS: Record<string, [string, string]> = {
  cm_archives: ["Archivum Sycorax", "Archivum_Sycorax.png"], dm_rise: ["Ascension Riser 31", "Ascension_Riser_31.png"],
  lm_rails: ["Chasm Logistratum", "Chasm_Logistratum.png"], km_station: ["Chasm Station HL-16-11", "Chasm_Station_HL-16-11.png"],
  core_research: ["Clandestium Gloriana", "Clandestium_Gloriana.png"], hm_complex: ["Comms-Plex 154/2f", "Comms-Plex_1542f.png"],
  fm_cargo: ["Consignment Yard HL-17-36", "Consignment_Yard_HL-17-36.png"], km_heresy: ["Dark Communion", "Dark_Communion.png"],
  fm_resurgence: ["Enclavum Baross", "Enclavum_Baross.png"], lm_scavenge: ["Excise Vault Spireside-13", "Excise_Vault_Spireside-13.png"],
  cm_habs: ["Hab Dreyko", "Hab_Dreyko.png"], km_enforcer: ["Magistrati Oubliette TM8-707", "Magistrati_Oubliette_TM8-707.png"],
  fm_armoury: ["Mercantile HL-70-04", "Mercantile_HL-70-04.png"], op_no_mans_land: ["No Man’s Land", "No_Man's_Land.png"],
  lm_cooling: ["Power Matrix HL-17-36", "Power_Matrix_HL-17-36.png"], hm_strain: ["Refinery Delta-17", "Refinery_Delta-17.png"],
  dm_propaganda: ["Relay Station TRS-150", "Relay_Station_TRS-150.png"], op_train: ["Rolling Steel", "Rolling_Steel.png"],
  dm_stockpile: ["Silo Cluster 18-66/a", "Silo_Cluster_18-66a.png"], dm_forge: ["Smelter Complex HL-17-36", "Smelter_Complex_HL-17-36.png"],
  km_enforcer_twins: ["The Orthus Offensive", "The_Orthus_Offensive.png"], hm_cartel: ["Vigil Station Oblivium", "Vigil_Station_Oblivium.png"],
  cm_raid: ["Warren 6-19", "Warren_6-19.png"],
  // Fatshark's September29 Spillway level-design article, ahead of feed art metadata.
  spillway: ["Spillway", "https://cdn.prod.website-files.com/65786ec854ee7451f4f72921/6ab27c02c579512044ad5c58_Artboard%201.jpg"],
};
export type DarktideMission = { id: string; map: string; name: string; image: string; category: string; challenge: number; resistance: number; difficulty: string; condition: string; sideMission: string; start: number; expiry: number; credits: number | null; xp: number | null; requiredLevel: number | null };
export type DarktideBoard = { missions: DarktideMission[]; partial: boolean };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const code = (value: unknown): string => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : "";
const integer = (value: unknown, max = 1_000_000): number | null => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max ? Number(value) : null;
function timestamp(value: unknown): number {
  const n = typeof value === "string" && /^\d{13}$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(n) && Number(n) >= 1_600_000_000_000 && Number(n) < 4_102_444_800_000 ? Number(n) : NaN;
}
function reward(value: unknown, extras: unknown, field: "credits" | "xp"): number | null {
  const base = integer(value); if (base === null) return null;
  let total = base;
  for (const extra of Object.values(record(extras))) { const amount = record(extra)[field]; if (amount === undefined) continue; const n = integer(amount); if (n === null) return null; total += n; }
  return integer(total, 10_000_000);
}
export function parseDarktideBoard(raw: unknown): DarktideBoard {
  const rows = record(raw).missions;
  if (!Array.isArray(rows) || rows.length > 3000) throw Error("Invalid mission board");
  const missions: DarktideMission[] = [], seen = new Map<string, string>(); let partial = false;
  for (const value of rows) {
    const row = record(value), id = typeof row.id === "string" ? row.id : "", map = code(row.map), category = code(row.category), start = timestamp(row.start), expiry = timestamp(row.expiry);
    const challenge = integer(row.challenge, 10), resistance = integer(row.resistance, 10);
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || !map || !category || !Number.isFinite(start) || !Number.isFinite(expiry) || expiry <= start || expiry - start > 24 * 3600_000 || challenge === null || resistance === null) { partial = true; continue; }
    const art = Object.hasOwn(MAPS, map) ? MAPS[map] : undefined;
    const difficulty = resistance === 5 && challenge === 5 ? "auric" : resistance === challenge && challenge >= 1 && challenge <= 4 ? String(challenge) : resistance === 4 && challenge === 5 ? "5" : "unknown";
    const mission = { id, map, name: art?.[0] ?? map, image: art ? art[1].startsWith("https://") ? art[1] : `${DARKTIDE_SOURCE}assets/maps/${encodeURIComponent(art[1])}` : "", category, challenge, resistance, difficulty, condition: code(row.circumstance), sideMission: code(row.sideMission), start, expiry,
      credits: reward(row.credits, row.extraRewards, "credits"), xp: reward(row.xp, row.extraRewards, "xp"), requiredLevel: integer(row.requiredLevel, 1000) };
    // Ignore repeated observations, but reject conflicting playable details.
    const identity = JSON.stringify(mission), previous = seen.get(id);
    if (previous) { if (previous !== identity) throw Error("Conflicting mission identity"); continue; }
    seen.set(id, identity); missions.push(mission);
  }
  if (rows.length && !missions.length) throw Error("No readable missions");
  return { missions, partial };
}
export function currentDarktideMissions(board: DarktideBoard, now: number, category: string, difficulty: string, query: string): DarktideMission[] {
  const needle = query.normalize("NFC").trim().toLocaleLowerCase();
  return board.missions.filter(mission => mission.start <= now && now < mission.expiry && (category === "all" || mission.category === category) && (difficulty === "all" || mission.difficulty === difficulty) && `${mission.name} ${mission.map}`.normalize("NFC").toLocaleLowerCase().includes(needle)).sort((a,b) => a.expiry-b.expiry || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
// Names only for verified circumstances; new provider codes remain inspectable.
export function darktideCondition(code: string): string[] {
  const known: Record<string, string[]> = { default: [], less_resistance_01:["low"], more_resistance_01:["high"], darkness_01:["darkness"], toxic_gas_01:["gas"], hunting_grounds_01:["hounds"], hunting_grounds_less_resistance_01:["low","hounds"], hunting_grounds_more_resistance_01:["high","hounds"], waves_of_specials_01:["shock"], waves_of_specials_less_resistance_01:["low","shock"], waves_of_specials_more_resistance_01:["high","shock"], ventilation_purge_01:["fog"], ventilation_purge_with_snipers_01:["fog","snipers"] };
  return Object.hasOwn(known, code) ? known[code] : code ? ["unknown"] : [];
}
