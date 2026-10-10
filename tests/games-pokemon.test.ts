import { groupPokemonEncounters } from "../src/lib/games/pokemon-data.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { pokemonEdition } from "../src/lib/games/pokemon-games.ts";
import { pokeEvolutionConditions, parsePokeEncounters, parsePokeMoves, parsePokeTypes, parsePokedex } from "../src/lib/games/pokemon-data.ts";
test("Pokémon editions never merge originals, remakes, sequels or ROM hacks", () => {
  for (const [title, version] of [["Pokémon Emerald", "emerald"], ["Pokemon FireRed Version", "firered"], ["Pokémon Black Version 2", "black-2"], ["Pokémon: Let's Go, Pikachu!", "lets-go-pikachu"], ["Pokémon XD: Gale of Darkness", "xd"]]) assert.equal(pokemonEdition(title)?.version, version);
  for (const name of ["Pokémon Emerald Seaglass", "Pokémon Unbound", "Pokémon Mystery Dungeon: Explorers of Sky"]) assert.equal(pokemonEdition(name)?.version, undefined);
  assert.equal(pokemonEdition("Digimon World"), null);
});
test("Encounter filtering retains exact edition, method, conditions and real zero probabilities", () => {
  const detail = (name: string, chance: number) => ({ version: { name }, encounter_details: [{ chance, min_level: 3, max_level: 5, method: { name: "walk" }, condition_values: [{ name: "time-night" }] }] });
  const raw = [{ location_area: { name: "hoenn-route-102-area" }, version_details: [detail("ruby", 30), detail("emerald", 4)] }];
  assert.deepEqual(parsePokeEncounters(raw, "emerald"), [{ area: "hoenn-route-102-area", chance: 4, min: 3, max: 5, method: "walk", conditions: ["time-night"] }]);
  assert.deepEqual(parsePokeEncounters(raw, "sapphire"), []);
});
test("Learnsets require exact version group; later Fairy typing does not leak into GBA", () => {
  const raw = { moves: [{ move: { name: "moonblast", url: "https://pokeapi.co/api/v2/move/585/" }, version_group_details: [{ version_group: { name: "x-y" }, level_learned_at: 40, move_learn_method: { name: "level-up" } }] }], types: [{ type: { name: "fairy" } }], past_types: [{ generation: { name: "generation-v" }, types: [{ type: { name: "normal" } }] }] };
  assert.deepEqual(parsePokeMoves(raw, "emerald"), []); assert.equal(parsePokeMoves(raw, "x-y")[0]?.level, 40);
  assert.deepEqual(parsePokeTypes(raw, 3), ["normal"]); assert.deepEqual(parsePokeTypes(raw, 6), ["fairy"]);
});
test("National species identity is separate from regional dex position", () => {
  assert.deepEqual(parsePokedex({ pokemon_entries: [{ entry_number: 29, pokemon_species: { name: "ralts", url: "https://pokeapi.co/api/v2/pokemon-species/280/" } }] }), [{ id: 280, number: 29, name: "Ralts" }]);
});

test("Verified spin-off guides retain their own identity and do not inherit retail encounters",()=>{
  assert.equal(pokemonEdition("New Pokémon Snap")?.guideTitle,"Walkthrough:New Pokémon Snap");
  assert.equal(pokemonEdition("PokéPark Wii: Pikachu's Adventure")?.guideTitle,"Walkthrough:PokéPark Wii: Pikachu's Adventure");
  assert.equal(pokemonEdition("Pokémon Mystery Dungeon: Blue Rescue Team")?.guide,"Mystery Dungeon: Red Rescue Team and Blue Rescue Team");
  assert.equal(pokemonEdition("Detective Pikachu")?.version,undefined);
  assert.equal(pokemonEdition("Pokémon Crystal")?.maps,"Gold, Silver, and Crystal maps");
});
test("Evolution details retain zero comparisons and conditional requirements",()=>{
  assert.deepEqual(pokeEvolutionConditions({trigger:{name:"level-up"},min_level:20,relative_physical_stats:0,needs_overworld_rain:true,turn_upside_down:false}),[{field:"trigger",value:"Level Up"},{field:"min_level",value:20},{field:"relative_physical_stats",value:0},{field:"needs_overworld_rain",value:"✓"}]);
});

test("encounter slots combine level ranges without mixing methods or time conditions", () => {
 const row={area:"route-1",method:"walk",conditions:["time-day"],chance:20,min:2,max:3};
 const source=[row,{...row,chance:30,min:4,max:5},{...row,conditions:["time-night"]},{...row,method:"surf"}];
 const grouped=groupPokemonEncounters(source);
 assert.equal(grouped.length,3);assert.deepEqual(grouped[0],{...row,chance:50,min:2,max:5});
 assert.equal(row.chance,20);assert.equal(grouped[1].chance,20);
});


test("Only registered official editions expose the companion, never Pokemon-branded hacks", () => {
  for (const name of ["Pokemon Unbound", "Pokemon Emerald Seaglass", "Pokemon Radical Red", "Pokemon Gaia", "Pokemon Crystal Clear", "Pokemon FireRed: Rocket Edition", "Pokemon Unknown Fan Game", "PokeMMO"]) {
    assert.equal(pokemonEdition(name), null, name);
  }
  assert.equal(pokemonEdition("Pokemon FireRed Version", 5), null);
  assert.equal(pokemonEdition("Pokemon FireRed Version", 0)?.version, "firered");
});
