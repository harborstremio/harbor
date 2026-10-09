export type PokeRef = { name: string; url: string };
export type PokeEntry = { id: number; number: number; name: string };
export type PokeEncounter = { area: string; chance: number; min: number; max: number; method: string; conditions: string[] };
/** Encounter slots for the same method/conditions form one level range and chance. */
export function groupPokemonEncounters(rows: PokeEncounter[]): PokeEncounter[] {
  const groups = new Map<string, PokeEncounter>();
  for (const row of rows) {
    const key = JSON.stringify([row.area, row.method, [...row.conditions].sort()]);
    const held = groups.get(key);
    if (held) { held.min = Math.min(held.min, row.min); held.max = Math.max(held.max, row.max); held.chance = Math.min(100, held.chance + row.chance); }
    else groups.set(key, { ...row, conditions: [...row.conditions] });
  }
  return [...groups.values()];
}
export const pokeObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const pokeArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export const pokeText = (value: unknown) => typeof value === "string" ? value.slice(0, 3000) : "";
export const pokeNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
export const pokeId = (value: unknown) => Number(pokeText(value).match(/\/(\d+)\/?$/)?.[1] ?? 0);
export const pokeRef = (value: unknown): PokeRef => { const row = pokeObject(value); return { name: pokeText(row.name), url: pokeText(row.url) }; };
export const pokeLabel = (value: string) => value.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
export function pokeLocalized(raw: unknown, language: string, fallback: string) {
  const names = pokeArray(raw).map(pokeObject), lang = language === "zh" ? "zh-Hans" : language;
  return pokeText(names.find(n => pokeRef(n.language).name === lang)?.name ?? names.find(n => pokeRef(n.language).name === "en")?.name) || fallback;
}
export function parsePokedex(raw: unknown): PokeEntry[] {
  return pokeArray(pokeObject(raw).pokemon_entries).flatMap(value => { const row = pokeObject(value), ref = pokeRef(row.pokemon_species), id = pokeId(ref.url); return id > 0 && id < 10000 ? [{ id, number: pokeNumber(row.entry_number), name: pokeLabel(ref.name) }] : []; });
}
export function parsePokeEncounters(raw: unknown, version: string): PokeEncounter[] {
  return pokeArray(raw).flatMap(value => { const area = pokeObject(value); return pokeArray(area.version_details).flatMap(value => {
    const detail = pokeObject(value); if (pokeRef(detail.version).name !== version) return [];
    return pokeArray(detail.encounter_details).map(value => { const row = pokeObject(value); return { area: pokeRef(area.location_area).name, chance: pokeNumber(row.chance), min: pokeNumber(row.min_level), max: pokeNumber(row.max_level), method: pokeRef(row.method).name, conditions: pokeArray(row.condition_values).map(v => pokeRef(v).name) }; });
  }); });
}
export function parsePokeMoves(raw: unknown, group: string) {
  return pokeArray(pokeObject(raw).moves).flatMap(value => { const row = pokeObject(value), move = pokeRef(row.move); return pokeArray(row.version_group_details).flatMap(value => { const detail = pokeObject(value); return pokeRef(detail.version_group).name === group ? [{ name: move.name, id: pokeId(move.url), level: pokeNumber(detail.level_learned_at), method: pokeRef(detail.move_learn_method).name }] : []; }); }).sort((a, b) => a.method.localeCompare(b.method) || a.level - b.level || a.name.localeCompare(b.name));
}
/** Use the historical type table when this Pokémon changed typing after the selected generation. */
export function parsePokeTypes(raw: unknown, generation: number) {
  const row = pokeObject(raw), roman = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix"];
  const past = pokeArray(row.past_types).map(pokeObject).map(value => ({ value, generation: roman.indexOf(pokeRef(value.generation).name.replace("generation-", "")) })).filter(v => v.generation >= generation).sort((a, b) => a.generation - b.generation)[0];
  return pokeArray(past?.value.types ?? row.types).map(v => pokeRef(pokeObject(v).type).name);
}

/** API evolution conditions are current data, not an invented edition-specific ruleset. */
export function pokeEvolutionConditions(raw: unknown): { field: string; value: string | number }[] {
  const row=pokeObject(raw),result:{field:string;value:string|number}[]=[];
  for(const field of ["trigger","item","held_item","known_move","known_move_type","location","party_species","party_type","trade_species"]){const name=pokeRef(row[field]).name;if(name)result.push({field,value:pokeLabel(name)});}
  for(const field of ["min_level","min_happiness","min_beauty","min_affection","gender","relative_physical_stats"]){if(typeof row[field]==="number")result.push({field,value:row[field] as number});}
  if(pokeText(row.time_of_day))result.push({field:"time_of_day",value:pokeLabel(pokeText(row.time_of_day))});
  for(const field of ["needs_overworld_rain","turn_upside_down"]){if(row[field]===true)result.push({field,value:"✓"});}
  return result;
}
