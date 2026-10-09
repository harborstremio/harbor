import assert from "node:assert/strict";
import test from "node:test";
import { AAA_FAVORITE_IDS, DEFAULT_FAVORITE_REVIEWS, favoriteCatalogFilters, matchesFavoriteReviews, rankAAAFavorites } from "../src/lib/games/favorites-data.ts";
import { collectFavoriteMatches } from "../src/lib/games/favorites-pages.ts";
import { catalogParameters } from "../src/lib/games/catalog-filters.ts";
import type { GameHighlight } from "../src/lib/games/catalog.ts";

const game = (id: number, positive = 95, count = 1000): GameHighlight => ({ id: `steam:${id}`, steamId: id, name: String(id), capsule: "", platforms: ["Windows"], reviews: { positive, count } });

test("AAA selection excludes unknown, unreleased and unscored games and keeps review evidence in deterministic order", () => {
  const [a,b,c,d] = AAA_FAVORITE_IDS;
  const ranked = rankAAAFavorites([game(a!,94,100000),game(b!,98,1000),game(c!,98,10000),game(c!,98,10000),game(99999999,100,999999),{...game(d!),comingSoon:true},{...game(d!),reviews:undefined}]);
  assert.deepEqual(ranked.map(x=>x.steamId),[c,b,a]);
  assert.equal(new Set(AAA_FAVORITE_IDS).size,AAA_FAVORITE_IDS.length);
  assert.ok(AAA_FAVORITE_IDS.length>60);
});

test("live catalog categories retain Steam review ranking and do not contaminate each other or browse pagination", () => {
  const indie=catalogParameters("",favoriteCatalogFilters("indie"),30);
  const free=catalogParameters("",favoriteCatalogFilters("free"),60);
  const all=catalogParameters("",favoriteCatalogFilters("all"),0);
  assert.equal(indie.get("tags"),"492");assert.equal(indie.get("start"),"30");assert.equal(indie.get("maxprice"),null);
  assert.equal(free.get("maxprice"),"free");assert.equal(free.get("tags"),null);assert.equal(free.get("start"),"60");
  assert.equal(all.get("tags"),null);assert.equal(all.get("maxprice"),null);
  for(const params of [all,indie,free])assert.equal(params.get("sort_by"),"Reviews_DESC");
});

test("review thresholds use total count and positive percentage independently, including exact boundaries", () => {
  const filters = {minCount:10000,minPositive:90};
  assert.equal(matchesFavoriteReviews(game(1,90,10000),filters),true);
  assert.equal(matchesFavoriteReviews(game(1,100,9999),filters),false);
  assert.equal(matchesFavoriteReviews(game(1,89,1000000),filters),false);
  assert.equal(matchesFavoriteReviews({...game(1),reviews:undefined},filters),false);
  assert.equal(matchesFavoriteReviews({...game(1),reviews:undefined},DEFAULT_FAVORITE_REVIEWS),true);
  assert.equal(matchesFavoriteReviews(game(1,20,10000),{minCount:10000,minPositive:0}),true);
});

test("sparse results retain provider cursors, deduplicate matches and retain the oldest cached evidence", async () => {
  const calls:number[]=[];
  const page=await collectFavoriteMatches(async offset=>{
    calls.push(offset);
    return {games:offset===0?[game(1,95,3)]:[game(2,95,15000),game(2,95,15000)],nextOffset:offset+30,cachedAt:300-offset};
  },0,{minCount:10000,minPositive:90},new AbortController().signal);
  assert.deepEqual(calls,[0,30,60]);assert.deepEqual(page.games.map(x=>x.steamId),[2]);
  assert.equal(page.nextOffset,90);assert.equal(page.cachedAt,240);
});

test("filtered empty pages do not become a false end of catalog or unbounded background scan", async () => {
  let calls=0;
  const load=async(offset:number)=>{calls++;return {games:[game(offset+1,99,1)],nextOffset:offset+30};};
  const filters={minCount:100000,minPositive:95},signal=new AbortController().signal;
  const first=await collectFavoriteMatches(load,0,filters,signal);
  assert.equal(calls,3);assert.equal(first.games.length,0);assert.equal(first.nextOffset,90);
  const next=await collectFavoriteMatches(load,first.nextOffset!,filters,signal);
  assert.equal(calls,4);assert.equal(next.nextOffset,120);
});

test("paging stops at true exhaustion, sufficient matches or cancellation and rejects repeated cursors", async () => {
  const filters={minCount:10000,minPositive:90},signal=new AbortController().signal;
  const end=await collectFavoriteMatches(async()=>({games:[game(1,95,2)],nextOffset:null}),0,filters,signal);
  assert.deepEqual(end.games,[]);assert.equal(end.nextOffset,null);
  let calls=0;
  const enough=await collectFavoriteMatches(async()=>{calls++;return {games:Array.from({length:15},(_,i)=>game(i+1,95,20000)),nextOffset:30};},0,filters,signal);
  assert.equal(calls,1);assert.equal(enough.games.length,15);
  await assert.rejects(collectFavoriteMatches(async()=>({games:[],nextOffset:0}),0,filters,signal),/did not advance/);
  const controller=new AbortController();
  await assert.rejects(collectFavoriteMatches(async()=>{controller.abort();return {games:[],nextOffset:30};},0,filters,controller.signal),{name:'AbortError'});
});

test("a later provider failure retains found matches and its retry cursor",async()=>{
  const page=await collectFavoriteMatches(async offset=>{if(offset)throw Error('temporary');return {games:[game(1,96,120000)],nextOffset:30,cachedAt:123};},0,{minCount:100000,minPositive:90},new AbortController().signal);
  assert.equal(page.games.length,1);assert.equal(page.nextOffset,30);assert.equal(page.cachedAt,123);
  await assert.rejects(collectFavoriteMatches(async()=>{throw Error('offline');},0,DEFAULT_FAVORITE_REVIEWS,new AbortController().signal),/offline/);
});
