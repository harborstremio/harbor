import assert from "node:assert/strict";
import test from "node:test";
import { WARHAMMER_CONNECTIONS, WARHAMMER_CONNECTION_QUERY, parseWarhammerConnections, warhammerFactionGames, isKnownWarhammerMisclassification, isWarhammerCrossover } from "../src/lib/games/warhammer-data.ts";

const fixture = () => WARHAMMER_CONNECTIONS.map(game => ({ id: game.id, name: `Game ${game.id}`, franchises: [{ id:6, name:"Warhammer 40,000" }], external_games: [{ external_game_source:1, uid:String(game.steamId) }], cover:{image_id:"co1234"} }));

test("Faction connections use exact catalog, Steam and universe identities, never names or first external record", () => {
  const rows=fixture(); rows[0].external_games.unshift({external_game_source:1,uid:"999"});
  const data=parseWarhammerConnections(rows); assert.equal(data.partial,false); assert.equal(data.games.length,WARHAMMER_CONNECTIONS.length); assert.equal(data.games[0].game.id,"steam:2183900");
  for (const entry of data.games) assert.equal(entry.source,`https://store.steampowered.com/app/${entry.game.steamId}/`);
  assert.match(WARHAMMER_CONNECTION_QUERY,/franchises.name/);
});
test("Wrong source/ID pairs, other universes, duplicate records and missing games cannot inherit lore connections", () => {
  const rows=fixture(); rows[0].external_games=[{external_game_source:2,uid:"2183900"},{external_game_source:1,uid:"999"}]; rows[1].franchises=[{id:509,name:"Warhammer"}]; rows.push(structuredClone(rows[2]));
  const data=parseWarhammerConnections(rows); assert.equal(data.partial,true); assert.equal(data.games.length,WARHAMMER_CONNECTIONS.length-3);
  assert.ok(!data.games.some(entry=>[185252,203258,143424].includes(entry.game.igdbId)));
  assert.throws(()=>parseWarhammerConnections([])); assert.throws(()=>parseWarhammerConnections(Array.from({length:21},()=>({}))));
});
test("Playable factions and opposing forces stay distinct; paid faction packs do not grant base-game roles", () => {
  const data=parseWarhammerConnections(fixture());
  assert.deepEqual(warhammerFactionGames(data,"necrons","play").map(entry=>entry.game.igdbId),[302176,76410,83844,467]);
  assert.deepEqual(warhammerFactionGames(data,"necrons","face").map(entry=>entry.game.igdbId),[88461]);
  assert.deepEqual(warhammerFactionGames(data,"tyranids","play").map(entry=>entry.game.igdbId),[143424,83844,86269,466]);
  assert.deepEqual(warhammerFactionGames(data,"tyranids","face").map(entry=>entry.game.igdbId),[185252]);
  assert.deepEqual(warhammerFactionGames(data,"orks").map(entry=>entry.game.igdbId),[250904,76410,83844,18980,26705,159703,466]);
  assert.equal(data.games.find(entry=>entry.game.igdbId===143424)?.factions.necrons,undefined);
  assert.equal(data.games.find(entry=>entry.game.igdbId===76410)?.factions.tyranids,undefined); // Paid Gladius faction pack.
  assert.equal(data.games.find(entry=>entry.game.igdbId===466)?.factions.chaos,undefined); // Chaos Rising is a separate expansion.
});
test("Verified provider correction and actual crossovers do not become broad title exclusions", () => {
  assert.equal(isKnownWarhammerMisclassification(7241),true); assert.equal(isKnownWarhammerMisclassification(185252),false);
  for (const id of [6058,5649,6059]) assert.equal(isKnownWarhammerMisclassification(id),true);
  assert.equal(isKnownWarhammerMisclassification(302204),false); // Licensed World of Tanks/40K crossover.
  assert.equal(isWarhammerCrossover(376145),true); assert.equal(isWarhammerCrossover(135998),false);
});
