import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { decodeTftTeam, encodeTftTeam, isTft, parseTftCatalog, parseTftPlans, tftAsset, tftCounts, tftLocale, tftPlanKey, tftThresholds, tftTraitReference, tftVersion } from "../src/lib/games/tft-data.ts";
const raw = JSON.parse(readFileSync(new URL("./fixtures/games/tft-planner.json", import.meta.url), "utf8"));
const catalog = parseTftCatalog(raw.sets, raw.champions, raw.traits, "16.19", "default"), set = catalog.sets[0];
test("TFT identity is exact and reference version is pinned", () => {
  assert.ok(isTft({ igdbId: 120176 })); assert.equal(isTft({ igdbId: 336307 }), false); assert.equal(isTft({ igdbId: 120176, steamId: 1 }), false);
  assert.equal(tftVersion(["16.19.1", "16.18.1"]), "16.19"); assert.throws(() => tftVersion(["latest"])); assert.throws(() => tftVersion([]));
  assert.equal(tftLocale("de-DE"), "de_de"); assert.equal(tftLocale("hi"), "default");
});
test("current-set selection and every champion/trait join are validated", () => {
  assert.equal(catalog.defaultSet, "TFTSet18"); assert.equal(set.champions.length, 2);
  assert.throws(() => parseTftCatalog(raw.sets, {}, raw.traits, "16.19", "default"));
  assert.throws(() => parseTftCatalog(raw.sets, raw.champions, [], "16.19", "default"));
  const duplicate = structuredClone(raw.champions); duplicate.TFTSet18[1].team_planner_code = 1026;
  assert.throws(() => parseTftCatalog(raw.sets, duplicate, raw.traits, "16.19", "default"));
  const withNpc = structuredClone(raw.champions); withNpc.TFTSet18.push({ character_id: "TFT17_Enemy_Aatrox", team_planner_code: 0, traits: [] });
  assert.equal(parseTftCatalog(raw.sets, withNpc, raw.traits, "16.19", "default").sets[0].champions.length, 2);
});
test("Elder Dragon contributes twice to Riftbeast; repeated unit IDs never inflate counts", () => {
  const counts = tftCounts(set, ["DA_Gromp18_AP", "DA_18_ElderDragon", "DA_18_ElderDragon"]);
  assert.equal(counts.get("DA_Riftbeast18"), 3); assert.equal(counts.get("DA_18_ApexPredator"), 1);
  assert.deepEqual(tftThresholds(set.traits.find(t => t.id === "DA_Riftbeast18")!), [3, 5, 7, 10]);
});
test("V2 codes use exact 12-bit source IDs, ten slots and explicit set identity", () => {
  const known = "024023fc000000000000000000000000TFTSet18";
  const units = ["DA_Gromp18_AP", "DA_18_ElderDragon"];
  assert.equal(encodeTftTeam(set, units), known); assert.deepEqual(decodeTftTeam(known, catalog).units, units);
  for (const invalid of [known.replace("Set18", "Set17"), known.replace("402", "fff"), known.replace("3fc", "402"), known.slice(1), "02" + "0".repeat(30) + "TFTSet18"]) assert.throws(() => decodeTftTeam(invalid, catalog));
  assert.throws(() => encodeTftTeam(set, [])); assert.throws(() => encodeTftTeam(set, [...units, units[0]])); assert.throws(() => encodeTftTeam(set, ["absent"]));
});
test("reference expressions resolve from published constants without evaluating executable or runtime tokens", () => {
  const adaptor = set.traits.find(t => t.id === "DA_18_Adaptor")!;
  const result = tftTraitReference(adaptor, 2, k => k); assert.ok(result.levels[0].text.includes("25%")); assert.equal(result.unresolved, false);
  const sample = { ...adaptor, text: "<b>@ADAPGain*100@</b> @window.alert(1)@ <script>unsafe</script> %i:scaleAD%", levels: [{ min: 2, values: { adapgain: .25 } }] };
  const parsed = tftTraitReference(sample, 2, () => "Attack damage"); assert.equal(parsed.intro, "25 — unsafe Attack damage"); assert.equal(parsed.unresolved, true); assert.ok(!parsed.intro.includes("<"));
});
test("publisher assets cannot escape their pinned origin or path", () => {
  assert.ok(tftAsset("/lol-game-data/assets/ASSETS/test.png", "16.19").endsWith("/assets/test.png"));
  for (const bad of ["https://example.com/a.png", "/lol-game-data/assets/../a.png", "/lol-game-data/assets/a.png?x=1", "/lol-game-data/assets/%2e%2e/a.png"]) assert.equal(tftAsset(bad, "16.19"), "");
  assert.equal(tftAsset("/lol-game-data/assets/a.png", "../latest"), "");
});
test("saved plans are bounded and isolated by profile and set; stale IDs remain reviewable", () => {
  const data = parseTftPlans({ draft: ["old_champion"], teams: [{ id: "team_1", name: "<b>Forest</b>", units: ["old_champion"] }, { id: "team_1", name: "Duplicate", units: [] }] });
  assert.deepEqual(data.draft, ["old_champion"]); assert.equal(data.teams.length, 1); assert.equal(data.teams[0].name, "Forest");
  assert.notEqual(tftPlanKey("a", "TFTSet18"), tftPlanKey("b", "TFTSet18")); assert.notEqual(tftPlanKey("a", "TFTSet18"), tftPlanKey("a", "TFTSet17"));
  assert.equal(tftPlanKey("profile:other", "TFTSet18"), "harbor.games.tft.teams:profile%3Aother:TFTSet18");
  assert.deepEqual(parseTftPlans({ draft: Array(11).fill("unit") }).draft, []);
});
