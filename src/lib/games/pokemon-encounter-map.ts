import type { PokemonEdition } from "./pokemon-games";
import type { PokemonMap } from "./pokemon";

const codes: Record<string, string[]> = {
  "red-blue": ["RGB", "RBY", "RB"], yellow: ["Y", "RBY"], "gold-silver": ["GS", "GSC"], crystal: ["C", "GSC"],
  "ruby-sapphire": ["RS", "RSE"], emerald: ["E", "RSE"], "firered-leafgreen": ["FRLG"],
  "diamond-pearl": ["DP", "DPPt"], platinum: ["Pt", "DPPt"], "heartgold-soulsilver": ["HGSS"],
  "black-white": ["BW"], "black-2-white-2": ["B2W2"], "x-y": ["XY"], "omega-ruby-alpha-sapphire": ["ORAS"],
  "sun-moon": ["SM"], "ultra-sun-ultra-moon": ["USUM"], "sword-shield": ["SwSh"],
};
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Only provider-labelled maps of this edition and location; no guessed coordinates. */
export function matchPokemonEncounterMap(area: string, edition: PokemonEdition, maps: PokemonMap[]): PokemonMap | undefined {
  const allowed = codes[edition.group ?? ""] ?? [], location = normalize(area);
  const candidates = maps.flatMap(map => {
    const title = map.title.replace(/\.(png|jpe?g|gif|webp)$/i, "");
    const code = allowed.find(code => title.endsWith(` ${code}`));
    if (!code) return [];
    const place = normalize(title.slice(0, -code.length).trim());
    return place.length > 3 && (location === place || location.startsWith(`${place}-`)) ? [{ map, length: place.length, rank: allowed.indexOf(code) }] : [];
  });
  return candidates.sort((a, b) => b.length - a.length || a.rank - b.rank)[0]?.map;
}
