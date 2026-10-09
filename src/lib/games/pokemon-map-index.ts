import type { PokemonMap } from "./pokemon";
export type PokemonMapKind = "routes" | "towns" | "dungeons" | "buildings" | "other";
export const POKEMON_MAP_KINDS: PokemonMapKind[] = ["routes", "towns", "dungeons", "buildings", "other"];
/** Group only recognizable archive suffixes; keep the original title on each image. */
export function pokemonMapLocation(title: string): string {
  return title.replaceAll("_", " ").replace(/\s+(?:FRLG|RBY|RGB|RB|RG|Y|GSC|GS|C|HGSS|RSE|RS|E|DPPt|DP|Pt|BW2?|B2W2|XY|ORAS|SM|USUM|SwSh|BDSP|SV)\b/gi, "")
    .replace(/\s+[([]?(?:B?\d+F|\d+(?:st|nd|rd|th) floor|basement|ground floor)[)\]]?(?=\s|$)/gi, "")
    .replace(/\s+/g, " ").trim() || title;
}
export function pokemonMapKind(title: string): PokemonMapKind {
  if (/\broute\s*\d+/i.test(title)) return "routes";
  if (/\b(?:cave|cavern|forest|woods|tunnel|mount|mt\.?|island|islands|ruins|victory road|seafoam|safari|power plant)\b/i.test(title)) return "dungeons";
  if (/\b(?:gym|room|house|center|centre|mart|tower|mansion|building|department|office|lab|laboratory|gate|school|hotel|museum|ship|ss anne|s\.s\. anne)\b/i.test(title)) return "buildings";
  if (/\b(?:city|town|village)\b/i.test(title)) return "towns";
  return "other";
}
export function groupPokemonMaps(maps: PokemonMap[], query: string, kind: PokemonMapKind | "all") {
  const groups = new Map<string, PokemonMap[]>();
  const needle = query.trim().toLocaleLowerCase();
  for (const map of maps) {
    const name = pokemonMapLocation(map.title);
    if (kind !== "all" && pokemonMapKind(name) !== kind) continue;
    if (needle && !map.title.replaceAll("_", " ").toLocaleLowerCase().includes(needle)) continue;
    const entries = groups.get(name) ?? []; entries.push(map); groups.set(name, entries);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, undefined, {numeric:true})).map(([name, maps]) => ({name,maps:maps.sort((a,b)=>a.title.localeCompare(b.title,undefined,{numeric:true}))}));
}
