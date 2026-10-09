import assert from "node:assert/strict";
import test from "node:test";
import { antiCheatWithCategories, parseCommunityAntiCheat, parseSteamAntiCheat, publisherAntiCheat, UNKNOWN_ANTI_CHEAT } from "../src/lib/games/anti-cheat-data";

const page = (body: string) => `<link rel="canonical" href="https://store.steampowered.com/app/123/Game/">${body}`;
test("publisher kernel declaration includes the name, not uninstall instructions", () => {
  const info = parseSteamAntiCheat(page('<div class="anticheat_section DRM_notice"><div>Uses Kernel Level Anti-Cheat</div><div class="anticheat_name">BattlEye<span class="anticheat_uninstalls"> - Requires manual removal</span></div></div>'),123);
  assert.deepEqual(info.systems,["BattlEye"]); assert.equal(info.kernel,true); assert.equal(info.status,"reported");
});
test("Steam declarations without uninstall instructions retain their name", () => {
  const info = parseSteamAntiCheat(page('<div class="anticheat_section DRM_notice"><div>Uses Kernel Level Anti-Cheat</div><div class="anticheat_name">BattlEye</div></div>'),123);
  assert.deepEqual(info.systems,["BattlEye"]); assert.equal(info.kernel,true);
});

test("community reports match exact Steam IDs, not names, tournament clients or compatibility status", () => {
  const games = parseCommunityAntiCheat([
    { name: "PUBG: Battlegrounds", storeIds: { steam: "578080" }, anticheats: ["Zakynthos", "BattlEye", "UNCHEATER"], status: "Broken" },
    { name: "PUBG: Battlegrounds (ChallengerMode)", storeIds: {}, anticheats: ["Arkos"] },
    { name: "PUBG Lite", storeIds: { steam: "123" }, anticheats: ["Easy Anti-Cheat"], status: "Supported" },
  ]);
  assert.deepEqual(games.get(578080)?.systems,["Zakynthos", "BattlEye", "UNCHEATER"]);
  assert.equal(games.get(578080)?.kernel,null);
  assert.equal(games.get(578080)?.sourceName,"AreWeAntiCheatYet");
  assert.match(games.get(578080)?.sourceUrl ?? "",/^https:\/\/github.com\/AreWeAntiCheatYet\//);
  assert.equal(games.get(578081),undefined);
  assert.equal(games.get(123)?.kernel,null);
});

test("malformed and ambiguous directory identities never supply guessed systems", () => {
  const games = parseCommunityAntiCheat([
    { storeIds: { steam: "123" }, anticheats: ["BattlEye"] },
    { storeIds: { steam: "123" }, anticheats: ["Easy Anti-Cheat"] },
    { storeIds: { steam: "123" }, anticheats: ["VAC"] },
    { storeIds: { steam: "00123" }, anticheats: ["Wrong ID"] },
    { storeIds: { steam: "124" }, anticheats: [null,"","Unknown","None","<img src=x>"] },
    { storeIds: { steam: "125" }, anticheats: [" BattlEye ","battleye","VAC"] },
  ]);
  assert.equal(games.get(123),undefined); assert.equal(games.get(124),undefined);
  assert.deepEqual(games.get(125)?.systems,["BattlEye","VAC"]);
  assert.throws(() => parseCommunityAntiCheat({error:"unavailable"}));
  assert.throws(() => parseCommunityAntiCheat([]));
});
test("no declaration, single-player labels and missing data never mean unprotected", () => {
  for (const body of ["", "Single-player", "Easy Anti-Cheat in a review",'<a href="/app/456">BattlEye</a>']) {
    assert.equal(parseSteamAntiCheat(page(body),123).status,"unknown");
  }
  assert.equal(publisherAntiCheat("Valorant Tracker"),undefined);
});
test("identity and size limits reject unrelated pages and age gates", () => {
  assert.throws(()=>parseSteamAntiCheat(page(""),124)); assert.throws(()=>parseSteamAntiCheat("Please enter your age",123));
  assert.throws(()=>parseSteamAntiCheat(page("x".repeat(2*1024*1024)),123));
});
test("VAC is independently reported and does not imply kernel mode", () => {
  const info = antiCheatWithCategories(UNKNOWN_ANTI_CHEAT,[8]); assert.equal(info.kernel,null); assert.deepEqual(info.systems,["Valve Anti-Cheat (VAC)"]);
  assert.deepEqual(antiCheatWithCategories(info,[8]),info);
  assert.deepEqual(antiCheatWithCategories(UNKNOWN_ANTI_CHEAT,[2,22]),UNKNOWN_ANTI_CHEAT);
});
test("Riot titles have an explicit publisher source without relying on Steam", () => {
  assert.equal(publisherAntiCheat("VALORANT")?.systems[0],"Riot Vanguard");
  assert.match(publisherAntiCheat("League of Legends")?.sourceUrl ?? "",/^https:\/\/support\.riotgames\.com\//);
});
