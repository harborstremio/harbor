import assert from "node:assert/strict";
import test from "node:test";
import { isValorant, parseValorantAgents, parseValorantMaps, parseValorantMeta, parseValorantWeapons, rankValorantAgents, valorantLocale, valorantMedia, valorantMetaUrl } from "../src/lib/games/valorant-data.ts";

const id = "e370fa57-4757-3604-3648-499e1f642d3f", second = "add6443a-41bd-e414-f6ad-e58d267f4e95";
const image = `https://media.valorant-api.com/agents/${id}/displayicon.png`;
const agent = (extra = {}) => ({ uuid: id, displayName: "Gekko", isPlayableCharacter: true, role: { uuid: "1b47567f-8f7b-444b-aae3-b0c634622d10", displayName: "Initiator" }, displayIcon: image, abilities: [], ...extra });
const envelope = (data: unknown[]) => ({ status: 200, data });
function metaPage({ tier = "", map = "", total = 1000, wins = 550, games = 1000, queue = "competitive" } = {}) {
  const tree = ["$", "div", null, { children: [["$", "filter", null, { tierOptions: [{ label: "All", value: "" }], mapOptions: [], queueId: queue, tier, mapName: map, version: "13.06" }], ["$", "data", null, { data: [{ characterId: id, gameCount: games, wins, kills: 900, deaths: 800 }], characters: [], totalGameCount: total }]] }];
  const flight = `abc:${JSON.stringify(tree)}\n`, mid = Math.floor(flight.length / 2);
  return [flight.slice(0, mid), flight.slice(mid)].map(part => `<script>self.__next_f.push(${JSON.stringify([1, part])})</script>`).join("");
}
test("VALORANT attaches only to exact live identities", () => {
  assert.equal(isValorant({ id: "riot:valorant:live" }), true);
  assert.equal(isValorant({ id: "igdb:126459", igdbId: 126459 }), true);
  for (const id of ["riot:valorant:pbe", "igdb:1", "custom:valorant", "riot:league_of_legends:live"]) assert.equal(isValorant({ id, igdbId: 126459 }), false);
});
test("Roster retains every role, local names and missing art without accepting duplicate or test entries", () => {
  const agents = parseValorantAgents(envelope([agent(), agent(), agent({ uuid: second, displayName: "Jett", role: { uuid: "dbe8757e-9e92-4ed4-b39f-9dfc589691d4", displayName: "Duelliste" }, displayIcon: null }), agent({ uuid: "bad" })]));
  assert.equal(agents.length, 2); assert.equal(agents[1].role, "Duelist"); assert.equal(agents[1].roleName, "Duelliste"); assert.equal(agents[1].icon, "");
  assert.throws(() => parseValorantAgents(envelope([agent({ isPlayableCharacter: false })])));
  assert.equal(valorantLocale("fr"), "fr-FR"); assert.equal(valorantLocale("hi"), "en-US");
});
test("Media is limited to original provider assets and Riot videos", () => {
  assert.equal(valorantMedia(image), image);
  for (const value of ["javascript:alert(1)", "https://media.valorant-api.com.evil.test/a.png", "http://media.valorant-api.com/a.png", "https://user@media.valorant-api.com/a.png", "https://media.valorant-api.com:8443/a.png"]) assert.equal(valorantMedia(value), "");
  assert.equal(valorantMedia("https://cmsassets.rgpub.io/sanity/files/a/demo.mp4", true), "https://cmsassets.rgpub.io/sanity/files/a/demo.mp4");
  assert.equal(valorantMedia("https://example.org/demo.mp4", true), "");
});
test("Public streamed JSON joins split frames and derives source-matching rates", () => {
  const meta = parseValorantMeta(metaPage(), { tier: "", map: "" });
  assert.equal(meta.patch, "13.06"); assert.equal(meta.rows[0].win, 55.00000000000001); assert.equal(meta.rows[0].pick, 100); assert.equal(meta.rows[0].kd, 1.125);
});
test("Wrong rank, map, mode or error HTML can never masquerade as filtered meta", () => {
  assert.throws(() => parseValorantMeta(metaPage(), { tier: "gold", map: "Ascent" }));
  assert.throws(() => parseValorantMeta(metaPage({ queue: "unrated" }), { tier: "", map: "" }));
  assert.throws(() => parseValorantMeta("<html>Temporarily unavailable</html>", { tier: "", map: "" }));
  assert.equal(parseValorantMeta(metaPage({ tier: "gold", map: "Ascent" }), { tier: "gold", map: "Ascent" }).map, "Ascent");
});
test("Impossible results fail, while genuinely empty samples stay empty", () => {
  assert.throws(() => parseValorantMeta(metaPage({ wins: 1200 }), { tier: "", map: "" }));
  assert.throws(() => parseValorantMeta(metaPage({ games: 1001 }), { tier: "", map: "" }));
  assert.deepEqual(parseValorantMeta(metaPage({ total: 0, games: 0, wins: 0 }), { tier: "", map: "" }).rows, []);
});
test("Small samples never displace established agents and role/search filters remain local", () => {
  const agents = parseValorantAgents(envelope([agent(), agent({ uuid: second, displayName: "Jett", role: { uuid: "dbe8757e-9e92-4ed4-b39f-9dfc589691d4", displayName: "Duelist" } })]));
  const meta = parseValorantMeta(metaPage(), { tier: "", map: "" }); meta.rows.push({ id: second, games: 1, win: 100, pick: .1 });
  assert.equal(rankValorantAgents(agents, meta, "", "", "win")[0].agent.name, "Gekko");
  assert.equal(rankValorantAgents(agents, meta, "Duelist", " Ｊｅｔｔ ", "pick")[0].agent.name, "Jett");
  assert.equal(rankValorantAgents(agents, null, "Sentinel", "", "win").length, 0);
});
test("Provider URL carries validated filter identities without arbitrary parameters", () => {
  const url = new URL(valorantMetaUrl({ tier: "gold", map: "Ascent" }));
  assert.equal(url.searchParams.get("tier"), "gold"); assert.equal(url.searchParams.get("map"), "Ascent");
  assert.equal(new URL(valorantMetaUrl({ tier: "gold&x=1", map: "../bad" })).searchParams.get("map"), null);
});
test("Map callouts use bounded world-to-minimap coordinates and omit non-map arenas", () => {
  const maps = parseValorantMaps(envelope([{ uuid: id, displayName: "Ascent", displayIcon: image, xMultiplier: .00007, yMultiplier: -.00007, xScalarToAdd: .813895, yScalarToAdd: .573242, callouts: [{ regionName: "Tree", superRegionName: "A", location: { x: 3980.9062, y: -5938.758 } }, { regionName: "bad", location: { x: Infinity, y: 0 } }] }, { uuid: second, displayName: "Range", displayIcon: null }]));
  assert.equal(maps.length, 1); assert.equal(maps[0].callouts.length, 1); assert.equal(maps[0].callouts[0].name, "A Tree");
  assert.ok(Math.abs(maps[0].callouts[0].x - .39818194) < 1e-8); assert.ok(Math.abs(maps[0].callouts[0].y - .294578566) < 1e-8);
});
test("Weapon reference retains zero-cost pistols and valid damage bands, not skin payloads", () => {
  const weapons = parseValorantWeapons(envelope([{ uuid: id, displayName: "Classic", displayIcon: image, shopData: { cost: 0 }, weaponStats: { magazineSize: 12, fireRate: 6.75, reloadTimeSeconds: 1.75, damageRanges: [{ rangeStartMeters: 0, rangeEndMeters: 30, headDamage: 78, bodyDamage: 26, legDamage: 22 }] }, skins: [{ arbitrary: "ignored" }] }, { uuid: second, displayName: "Melee", weaponStats: null }]));
  assert.equal(weapons.length, 1); assert.equal(weapons[0].cost, 0); assert.equal(weapons[0].damage[0].head, 78); assert.equal("skins" in weapons[0], false);
});
