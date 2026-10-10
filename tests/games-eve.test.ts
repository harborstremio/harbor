import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { defaultEvePlan, eveName, evePlan, evePlanKey, eveSecurity, eveSecurityClass, filterEveSystems, isEve, parseEveIncursions, parseEveKills, parseEveRoute, parseEveStatus, parseEveUniverse, readEvePlan } from "../src/lib/games/eve-data.ts";

const raw = JSON.parse(readFileSync(new URL("../public/games/eve/universe-3569502.json", import.meta.url), "utf8"));
const universe = parseEveUniverse(raw);
const plan = defaultEvePlan();
test("EVE exact identity excludes conflicting Steam editions", () => {
  assert.ok(isEve({ steamId: 8500 })); assert.ok(isEve({ igdbId: 2584 })); assert.equal(isEve({ steamId: 1, igdbId: 2584 }), false); assert.equal(isEve({ igdbId: 1 }), false);
});
test("bundled official directory validates all system joins and localized search", () => {
  assert.equal(universe.systems.length, 8089); assert.equal(universe.byId.get(30000142)?.names.en, "Jita");
  assert.equal(filterEveSystems(universe, "jItA", "en")[0].id, 30000142); assert.equal(filterEveSystems(universe, "", "en").length, 5);
  assert.ok(filterEveSystems(universe, "a", "en").length <= 30); assert.equal(eveName({ en: "Jita", ja: "ジタ" }, "ja-JP"), "ジタ"); assert.equal(eveName({ en: "Jita" }, "ar"), "Jita");
  assert.throws(() => parseEveUniverse({ ...raw, systems: [raw.systems[0], raw.systems[0]] })); assert.throws(() => parseEveUniverse({ ...raw, constellations: [] }));
});
test("security rounding retains EVE's positive minimum and wormhole distinction", () => {
  assert.equal(eveSecurity(.001), .1); assert.equal(eveSecurity(.46), .5); assert.equal(eveSecurity(-.98), -1);
  const system = universe.byId.get(30000142)!;
  assert.equal(eveSecurityClass({ ...system, security: .46 }), "high"); assert.equal(eveSecurityClass({ ...system, security: .001 }), "low"); assert.equal(eveSecurityClass({ ...system, security: 0 }), "null"); assert.equal(eveSecurityClass({ ...system, id: 31000001, security: -1 }), "wormhole");
});
test("routes preserve endpoints and reject invalid, repeated or avoided systems", () => {
  const p = evePlan({ ...plan, avoid: [30000144, 30000144] }); assert.deepEqual(p.avoid, [30000144]);
  assert.throws(() => evePlan({ ...plan, avoid: [plan.origin] })); assert.throws(() => evePlan({ ...plan, preference: "safe" })); assert.throws(() => evePlan({ ...plan, origin: "30000142" })); assert.throws(() => evePlan({ ...plan, avoid: Array(1001).fill(30000144) }));
  assert.deepEqual(parseEveRoute({ route: [plan.origin, plan.destination] }, p), [plan.origin, plan.destination]);
  for (const route of [[], [plan.destination, plan.origin], [plan.origin, 30000144, plan.destination], [plan.origin, 30000139, 30000139, plan.destination]]) assert.throws(() => parseEveRoute({ route }, p));
  assert.deepEqual(parseEveRoute({ route: [plan.origin] }, { ...plan, destination: plan.origin }), [plan.origin]);
});
test("complete activity snapshots reject partial malformed rows rather than inventing zero", () => {
  const row = { system_id: plan.origin, ship_kills: 3, pod_kills: 0, npc_kills: 300 };
  assert.deepEqual(parseEveKills([row]).get(plan.origin), { ships: 3, pods: 0, npcs: 300 }); assert.equal(parseEveKills([]).size, 0);
  assert.throws(() => parseEveKills([row, row])); assert.throws(() => parseEveKills([{ ...row, ship_kills: -1 }])); assert.throws(() => parseEveKills([{ ...row, pod_kills: undefined }]));
});
test("incursions preserve measured phase and reject invalid staging or influence", () => {
  const row = { constellation_id: 20000001, faction_id: 500019, has_boss: true, infested_solar_systems: [plan.origin], influence: .32, staging_solar_system_id: plan.origin, state: "established", type: "Incursion" };
  assert.equal(parseEveIncursions([row])[0].influence, .32); assert.deepEqual(parseEveIncursions([]), []);
  for (const invalid of [{ ...row, influence: 32 }, { ...row, staging_solar_system_id: plan.destination }, { ...row, state: "unknown" }]) assert.throws(() => parseEveIncursions([invalid]));
  assert.throws(() => parseEveIncursions([row, row]));
});
test("server state does not confuse missing, restricted and zero pilots", () => {
  assert.deepEqual(parseEveStatus({ players: 0, vip: true }), { players: 0, restricted: true }); assert.throws(() => parseEveStatus({ players: 20 })); assert.throws(() => parseEveStatus({ players: -1, vip: false }));
});
test("route preferences stay profile-local and corrupted storage recovers", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage"); const stored = new Map([[evePlanKey("one"), JSON.stringify({ ...plan, preference: "Shorter" })], [evePlanKey("two"), "broken"]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => stored.get(key) ?? null } });
  try { assert.equal(readEvePlan("one").preference, "Shorter"); assert.deepEqual(readEvePlan("two"), plan); assert.deepEqual(readEvePlan("three"), plan); } finally { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else Reflect.deleteProperty(globalThis, "localStorage"); }
});
