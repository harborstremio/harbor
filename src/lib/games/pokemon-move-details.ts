import { pokeArray, pokeLocalized, pokeObject, pokeRef, pokeText } from "./pokemon-data";

export type PokemonMoveDetail = { name: string; type: string; category: string; power: number | null; accuracy: number | null; pp: number | null; description: string };
export function parsePokemonMoveDetail(raw: unknown, group: string, order: number, generation: number, language: string, orders: Record<string, number>): PokemonMoveDetail {
  const move = pokeObject(raw), values = { ...move };
  // Each past value describes the period BEFORE its version group. Roll changes
  // back newest first; null fields mean that statistic did not change.
  const past = pokeArray(move.past_values).map(pokeObject).filter(row => (orders[pokeRef(row.version_group).name] ?? 0) > order)
    .sort((a, b) => orders[pokeRef(b.version_group).name] - orders[pokeRef(a.version_group).name]);
  for (const row of past) for (const key of ["power", "accuracy", "pp", "type"]) if (row[key] != null) values[key] = row[key];
  const type = pokeRef(values.type).name;
  let category = pokeRef(move.damage_class).name;
  if (generation < 4 && category !== "status") category = ["fire", "water", "grass", "electric", "ice", "psychic", "dragon", "dark"].includes(type) ? "special" : "physical";
  const flavors = pokeArray(move.flavor_text_entries).map(pokeObject).filter(row => pokeRef(row.version_group).name === group);
  const flavor = flavors.find(row => pokeRef(row.language).name === language) ?? flavors.find(row => pokeRef(row.language).name === "en");
  const numeric = (key: string) => typeof values[key] === "number" && Number.isFinite(values[key]) ? values[key] as number : null;
  return { name: pokeLocalized(move.names, language, pokeText(move.name)), type, category, power: numeric("power"), accuracy: numeric("accuracy"), pp: numeric("pp"), description: pokeText(flavor?.flavor_text).replace(/[\n\f]/g, " ") };
}
