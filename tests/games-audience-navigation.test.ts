import assert from "node:assert/strict";
import test from "node:test";
import sample from "./fixtures/games/xbox-audience.json" with { type: "json" };
import identities from "./fixtures/games/xbox-identities.json" with { type: "json" };
import { parseXboxAudience } from "../src/lib/games/xbox-audience.ts";
import { matchXboxGames, xboxIdentityQuery } from "../src/lib/games/xbox-audience-identity.ts";

test("current Xbox chart resolves to Harbor details by provider identity and exact title", () => {
  const games = matchXboxGames(parseXboxAudience(sample), identities);
  assert.equal(games.filter(game => game.openGame).length, 24);
  assert.equal(games[0].openGame?.id, "igdb:1905");
  assert.equal(games[2].openGame?.id, "igdb:135400"); // Bedrock, not Java.
  assert.equal(games[3].openGame?.id, "steam:1938090"); // Hub, not the 2003 game.
  assert.equal(games[15].openGame?.id, "igdb:353848"); // FC26, not FC27.
  assert.equal(games[19].openGame?.id, "igdb:408819");
  assert.equal(games[17].openGame, undefined); // Unmatched Battlefield hub stays in-app search.
  assert.equal(games[7].openGame?.steamId, undefined); // Console detail route retained.
  assert.deepEqual(games.map(game => game.chartRank), Array.from({length:25}, (_,i)=>i+1));
});

test("IDs are paired with their source and ambiguous names never pick an arbitrary edition", () => {
  const game = parseXboxAudience(sample)[0];
  const falsePair = {id:1,name:"Wrong game",external_games:[{uid:game.id.slice(5),external_game_source:1},{uid:"other",external_game_source:11}]};
  assert.equal(matchXboxGames([game],[falsePair])[0].openGame,undefined);
  const title = {id:2,name:"Fortnite",game_type:0,platforms:[{name:"Xbox One"}]};
  assert.equal(matchXboxGames([game],[title,{...title,id:3}])[0].openGame,undefined);
  const exact = {...falsePair,id:4,external_games:[{uid:game.id.slice(5),external_game_source:54}]};
  assert.equal(matchXboxGames([game],[title,exact])[0].openGame?.id,"igdb:4");
  assert.equal(matchXboxGames([game],[{...title,platforms:[{name:"PlayStation 5"}]}])[0].openGame,undefined);
});

test("identity query accepts only product IDs and escapes external titles", () => {
  assert.throws(()=>xboxIdentityQuery([]),/Missing/);
  const games=parseXboxAudience(sample);
  const query=xboxIdentityQuery([{...games[0],name:'bad"; limit 500; \\'}]);
  assert.ok(query.includes('external_games.uid = ("BT5P2X999VH2")'));
  assert.ok(!query.includes('bad";'));
  assert.ok(query.endsWith('limit 100;'));
});
