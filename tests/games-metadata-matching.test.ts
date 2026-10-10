import assert from "node:assert/strict";
import test from "node:test";
import { decodeIgdbRows } from "../src/lib/games/igdb-records.ts";
import { mergeMetadataMatches, metadataMatchPage, metadataMatchQuery, metadataMatchType, metadataMatchYear } from "../src/lib/games/metadata-matching.ts";

const record = (id: number, extra = {}) => ({ id, name: `Edition ${id}`, platforms: [{ id: 6, name: "Windows" }], external_games: [{ external_game_source: 1, uid: "42" }], ...extra });
test("metadata search keeps editions, ports, mods and artless records eligible", () => {
  const query = metadataMatchQuery("Garden", 6)!;
  assert.match(query, /search "Garden"/); assert.match(query, /platforms = \(6\)/);
  assert.doesNotMatch(query, /version_parent|cover !=|game_type =|total_rating/);
  const rows = decodeIgdbRows([record(10), record(11, {version_parent:10,game_type:{id:11,type:"Port"}}),record(12,{game_type:{id:5,type:"Mod"}})])!;
  assert.deepEqual(metadataMatchPage(rows,"Garden").games.map(game => game.igdbId),[10,11,12]);
  assert.equal(metadataMatchPage(rows,"Garden").games[0].capsule,"");
  assert.doesNotMatch(metadataMatchQuery("Garden")!,/where/);
});
test("numeric and prefixed IDs select the exact record without a platform exclusion", () => {
  for (const term of ["1942","igdb:1942","IGDB:1942"]) {
    assert.match(metadataMatchQuery(term,24)!,/where id = 1942; limit 1;/);
    assert.doesNotMatch(metadataMatchQuery(term,24)!,/platforms =/);
    const page = metadataMatchPage([record(1942),record(1943)],term);
    assert.deepEqual(page.games.map(game=>game.igdbId),[1942]); assert.equal(page.nextOffset,null);
    assert.equal(metadataMatchQuery(term,24,24),null);
  }
  for (const term of ["0","9007199254740992","igdb:0"]) assert.throws(()=>metadataMatchQuery(term),/Invalid metadata ID/);
});
test("empty input does not request a discovery page and query syntax stays bounded", () => {
  assert.equal(metadataMatchQuery("  "),null); assert.equal(metadataMatchQuery('"\\\n'),null);
  const query = metadataMatchQuery('Garden"; where id > 0; \\ hello\nnext')!;
  assert.equal((query.match(/"/g)??[]).length,2); assert.doesNotMatch(query,/\\|\n/);
  assert.match(metadataMatchQuery("a".repeat(200))!,new RegExp('search "a{160}";'));
  for (const platform of [0,-1,NaN,6.5]) assert.throws(()=>metadataMatchQuery("Garden",platform));
  for (const offset of [-1,1,24.5,10008,Infinity]) assert.throws(()=>metadataMatchQuery("Garden",6,offset));
});
test("pagination and merging retain separate editions sharing one Steam association", () => {
  const first = metadataMatchPage(Array.from({length:24},(_,i)=>record(i+1)),"Garden");
  assert.equal(first.nextOffset,24);
  const second = metadataMatchPage([record(24),record(25)],"Garden",24);
  assert.equal(second.nextOffset,null);
  assert.equal(mergeMetadataMatches(first.games,second.games).length,25);
  assert.equal(new Set(first.games.map(game=>game.id)).size,1);
});
test("review context uses named game types, UTC year, platforms and original developers", () => {
  const rows=decodeIgdbRows([record(9,{first_release_date:Date.UTC(1998,11,31)/1000,game_type:{id:101,type:"Standalone Expansion"},involved_companies:[
    {company:{id:1,name:"Original Studio"},developer:true},
    {company:{id:2,name:"Porting Studio"},developer:true,porting:true},
    {company:{id:3,name:"Support Studio"},developer:true,supporting:true},
    {company:{id:4,name:"Publisher"},publisher:true}
  ]})])!;
  const game=metadataMatchPage(rows,"Garden").games[0];
  assert.equal(metadataMatchType(game,key=>key),"games.metadata.type.standaloneexpansion");
  assert.equal(metadataMatchYear(game),1998); assert.deepEqual(game.platforms,["Windows"]);
  assert.deepEqual(game.developers.map(company=>company.name),["Original Studio"]);
  assert.equal(metadataMatchType({...game,gameTypeName:"Future classification"},key=>key),"Future classification");
  assert.equal(metadataMatchType({...game,gameTypeName:undefined},key=>key),undefined);
  assert.equal(metadataMatchYear({...game,release:undefined}),undefined);
  const main=metadataMatchPage(decodeIgdbRows([record(42,{game_type:{id:0,type:"Main Game"}})])!,"Garden").games[0];
  assert.equal(main.gameType,0);assert.equal(metadataMatchType(main,key=>key),"games.metadata.type.maingame");
  assert.equal(metadataMatchType({...game,gameTypeName:"DLC"},key=>key),"games.metadata.type.dlcaddon");
});
