import test from "node:test";
import assert from "node:assert/strict";
import { parsePokemonMoveDetail } from "../src/lib/games/pokemon-move-details.ts";
import { matchPokemonEncounterMap } from "../src/lib/games/pokemon-encounter-map.ts";
const ref = (name: string) => ({ name, url: "" });
test("move changes roll back only before their version and retain unchanged PP", () => {
  const move = { name: "tackle", type: ref("normal"), damage_class: ref("physical"), power: 40, accuracy: 100, pp: 35,
    past_values: [{ version_group: ref("black-white"), power: 35, accuracy: 95, pp: null }, { version_group: ref("sun-moon"), power: 50, accuracy: null, pp: null }] };
  const orders = { "black-white": 11, "sun-moon": 17 };
  const old = parsePokemonMoveDetail(move, "firered-leafgreen", 7, 3, "en", orders);
  assert.deepEqual([old.power, old.accuracy, old.pp], [35, 95, 35]);
  assert.equal(parsePokemonMoveDetail(move, "black-white", 11, 5, "en", orders).power, 50);
  assert.equal(parsePokemonMoveDetail(move, "sun-moon", 17, 7, "en", orders).power, 40);
});
test("generation three uses type-based damage classes, status stays status", () => {
  const move = { name: "bite", type: ref("dark"), damage_class: ref("physical") };
  assert.equal(parsePokemonMoveDetail(move, "firered-leafgreen", 7, 3, "en", {}).category, "special");
  assert.equal(parsePokemonMoveDetail(move, "diamond-pearl", 8, 4, "en", {}).category, "physical");
  const status = parsePokemonMoveDetail({ ...move, damage_class: ref("status"), power: null }, "firered-leafgreen", 7, 3, "en", {});
  assert.equal(status.category, "status"); assert.equal(status.power, null);
});
test("encounter maps match exact edition and location boundaries", () => {
  const edition = { key: "firered", group: "firered-leafgreen", guide: "FireRed and LeafGreen", mascots: [] };
  const maps = ["Kanto Route 2 HGSS", "Kanto Route 24 FRLG", "Kanto Route 2 FRLG", "Viridian Forest FRLG"].map(title => ({ title, image: title, url: title, width: 1, height: 1 }));
  assert.equal(matchPokemonEncounterMap("kanto-route-2-south-towards-viridian-city", edition, maps)?.title, "Kanto Route 2 FRLG");
  assert.equal(matchPokemonEncounterMap("kanto-route-24-area", edition, maps)?.title, "Kanto Route 24 FRLG");
  assert.equal(matchPokemonEncounterMap("viridian-forest-area", edition, maps)?.title, "Viridian Forest FRLG");
  assert.equal(matchPokemonEncounterMap("kanto-route-20-area", edition, maps), undefined);
  assert.equal(matchPokemonEncounterMap("unknown-area", edition, maps), undefined);
});
