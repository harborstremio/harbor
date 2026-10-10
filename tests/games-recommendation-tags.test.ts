import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeRecommendationTagProfile, parseRecommendationTagProfile, decodeRecommendationTagNames, parseRecommendationTagNames, recommendationTagPair, recommendationTagLanguage } from '../src/lib/games/recommendation-tags.ts';
import { combineRecommendationPools } from '../src/lib/games/recommendation-pool.ts';
import { rankRecommendations, recommendationsForPlatform } from '../src/lib/games/recommendations.ts';
import { GameMetadataCache, METADATA_FRESH_MS } from '../src/lib/games/metadata-cache.ts';
import { decodeGameMetadata } from '../src/lib/games/metadata-records.ts';
import { settleRecommendationSources } from '../src/lib/games/recommendation-load.ts';
import type { MetadataEntry } from '../src/lib/games/metadata-store.ts';
const game=(steamId:number,extra={})=>({id:`steam:${steamId}`,steamId,name:`Game ${steamId}`,platforms:['Windows'],capsule:'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',portrait:'https://cdn.akamai.steamstatic.com/steam/apps/620/library_600x900.jpg',...extra});
const ok=<T>(value:T)=>({status:'fulfilled' as const,value});
const failed={status:'rejected' as const,reason:Error('controlled outage')};
const names=[{id:1666,name:'Card Game'},{id:1716,name:'Roguelike'},{id:9,name:'Strategy'}];

test('Steam tag observations require the exact requested app and successful app item',()=>{
 const raw={response:{store_items:[{appid:42,item_type:0,success:1,tags:[{tagid:1666,weight:10},{tagid:1716,weight:20}]}]}};
 assert.deepEqual(parseRecommendationTagProfile(raw,42),{appid:42,tags:[{id:1716,weight:20},{id:1666,weight:10}]});
 assert.throws(()=>parseRecommendationTagProfile(raw,43));
 for(const overrides of [{item_type:1},{success:0},{tags:undefined},{tags:[{tagid:1666,weight:NaN}]}])assert.throws(()=>parseRecommendationTagProfile({response:{store_items:[{...raw.response.store_items[0],...overrides}]}},42));
 assert.deepEqual(decodeRecommendationTagProfile({appid:42,tags:[]}),{appid:42,tags:[]});
});
test('two highest-weight tags are explicit; missing names do not invent a replacement',()=>{
 const profile=decodeRecommendationTagProfile({appid:42,tags:[{id:9,weight:2},{id:1666,weight:8},{id:1716,weight:5},{id:1666,weight:8}]})!;
 assert.deepEqual(recommendationTagPair(profile,names),names.slice(0,2));
 assert.deepEqual(recommendationTagPair(profile,names.slice(1)),[]);
 assert.deepEqual(recommendationTagPair({appid:42,tags:[{id:9,weight:1}]},names),[]);
 assert.equal(decodeRecommendationTagProfile({appid:42,tags:Array.from({length:21},()=>({id:9,weight:1}))}),null);
});
test('tag dictionary validates data and maps supported provider locales',()=>{
 assert.deepEqual(parseRecommendationTagNames({response:{tags:[{tagid:1666,name:' Kartenspiel '}]}}),[{id:1666,name:'Kartenspiel'}]);
 for(const raw of [[],[{id:0,name:'x'}],[{id:1,name:'x\nunsafe'}],[{id:1,name:'x'.repeat(121)}]]) assert.equal(decodeRecommendationTagNames(raw),null);
 assert.equal(recommendationTagLanguage('de'),'german');assert.equal(recommendationTagLanguage('zh'),'schinese');assert.equal(recommendationTagLanguage('ar'),'english');
});
test('tag sources are persisted and an expired saved record remains an honest fallback',async()=>{
 const records=new Map<string,MetadataEntry>();
 const store={read:async(key:string)=>records.get(key)??null,write:async(key:string,value:MetadataEntry)=>{records.set(key,value);}};
 const profile={appid:42,tags:[{id:1666,weight:8},{id:1716,weight:5}]};
 const key='recommendation-tags:42',cache=new GameMetadataCache(store,()=>100000);
 await cache.load(key,async()=>profile);await cache.load('recommendation-tag-names:english',async()=>names);
 const fresh=await new GameMetadataCache(store,()=>100001).load(key,async()=>{throw Error('no fresh fetch');});assert.deepEqual(fresh,profile);
 const stale=await new GameMetadataCache(store,()=>100001+METADATA_FRESH_MS).load<typeof profile & {cachedAt:number}>(key,async()=>{throw Error('offline');});assert.equal(stale.cachedAt,100000);
 assert.equal(decodeGameMetadata('recommendation-tags:43',profile),null);
 assert.deepEqual(decodeGameMetadata('recommendation-tag-names:english',names),names);
});
test('two tag matches alternate with provider connections without crowding out other seeds',()=>{
 const pool=combineRecommendationPools(ok({games:[game(10),game(11),game(12),game(13)],tags:['Card Game','Roguelike']}),ok([game(20),game(21)]));
 assert.deepEqual(pool.games.map(game=>game.steamId),[10,11,20,12,13,21]);
 const seed={game:game(1),reason:'saved' as const},second={game:game(2),reason:'played' as const};
 const picks=rankRecommendations([{...pool,seed},{games:[game(30),game(31)],seed:second}],[],[],Infinity);
 assert.deepEqual(picks.slice(0,4).map(pick=>pick.game.steamId),[10,30,11,31]);
 assert.deepEqual(picks[0].tags,['Card Game','Roguelike']);assert.equal(picks.find(pick=>pick.game.steamId===20)?.tags,undefined);
});
test('exact Steam aliases retain console metadata and hidden identities; equal names never join',()=>{
 const peer=game(10,{id:'igdb:100',igdbId:100,platforms:['Nintendo Switch']}),sameName=game(20,{name:'Game 10'});
 const pool=combineRecommendationPools(ok({games:[game(10)],tags:['Card Game','Roguelike']}),ok([peer,sameName]));
 assert.equal(pool.games.length,2);assert.equal(pool.games[0].igdbId,100);assert.deepEqual(pool.games[0].platforms,['Windows','Nintendo Switch']);
 const groups=[{...pool,seed:{game:game(1),reason:'saved' as const}}];
 assert.equal(recommendationsForPlatform(rankRecommendations(groups,[],[]),'Nintendo Switch').length,1);
 assert.deepEqual(rankRecommendations(groups,[],['igdb:100']).map(pick=>pick.game.steamId),[20]);
 assert.equal(pool.games[1].igdbId,undefined);
});
test('a verified connection found by both sources precedes single-source matches',()=>{
 const pool=combineRecommendationPools(ok({games:[game(10),game(11),game(12)],tags:['Card Game','Roguelike']}),ok([game(12,{igdbId:112})]));
 assert.deepEqual(pool.games.map(game=>game.steamId),[12,10,11]);
 assert.equal(pool.games[0].igdbId,112);
});
test('one failed provider keeps useful results and retry state; both failing is not an empty success',()=>{
 const atlas=combineRecommendationPools(failed,ok([game(20)]));assert.equal(atlas.partial,true);assert.equal(atlas.games.length,1);assert.deepEqual(atlas.matches,{});
 const steam=combineRecommendationPools(ok({games:[game(10)],tags:['Card Game','Roguelike']}),failed);assert.equal(steam.partial,true);assert.equal(steam.games.length,1);
 assert.throws(()=>combineRecommendationPools(failed,failed));
 assert.equal(combineRecommendationPools(ok({games:[],tags:[]}),ok([])).partial,false);
});
test('cross-seed alias evidence applies before hidden/library filtering and platform selection',()=>{
 const first={seed:{game:game(1),reason:'saved' as const},games:[game(10)]};
 const second={seed:{game:game(2),reason:'saved' as const},games:[game(10,{id:'igdb:100',igdbId:100,platforms:['Nintendo Switch']})]};
 assert.deepEqual(rankRecommendations([first,second],[],['igdb:100']),[]);
 assert.deepEqual(rankRecommendations([first,second],[game(10,{id:'igdb:100',steamId:undefined,igdbId:100})],[]),[]);
 const picks=rankRecommendations([first,second],[],[]);assert.equal(picks.length,1);assert.equal(picks[0].game.igdbId,100);
 assert.equal(recommendationsForPlatform(picks,'Nintendo Switch').length,1);
});
test('saved seed-tag and related-game observations remain dated even after fresh identity merges',()=>{
 const seedTags=combineRecommendationPools(ok({games:[game(10)],tags:['Card Game','Roguelike'],cachedAt:100}),ok([]));
 assert.equal(seedTags.cachedAt,100);assert.equal(seedTags.partial,true);
 const related=combineRecommendationPools(ok({games:[game(10)],tags:['Card Game','Roguelike']}),ok([game(10,{igdbId:100,cachedAt:50})]));
 assert.equal(related.cachedAt,50);assert.equal(related.partial,true);
});
test('empty saved evidence retains its date and retry while fresh empty sources remain normal',()=>{
 const pool=combineRecommendationPools(ok({games:[],tags:[],cachedAt:100}),ok(Object.assign([],{cachedAt:50})));
 assert.equal(pool.games.length,0);assert.equal(pool.cachedAt,50);assert.equal(pool.partial,true);
 const atlasOnly=combineRecommendationPools(ok({games:[],tags:[]}),ok(Object.assign([],{cachedAt:50})));
 assert.equal(atlasOnly.cachedAt,50);assert.equal(atlasOnly.partial,true);
 assert.deepEqual(combineRecommendationPools(ok({games:[],tags:[]}),ok([])),{games:[],matches:{},partial:false});
});
test('bounded source settlement retains healthy Steam results and aborts a stalled queued source',async()=>{
 let aborted=false,release:((games:ReturnType<typeof game>[])=>void)|undefined;
 const [steam,atlas]=await settleRecommendationSources(async()=>({games:[game(10)],tags:['Card Game','Roguelike']}),signal=>new Promise(resolve=>{
  signal.addEventListener('abort',()=>{aborted=true;});release=resolve;
 }),undefined,15);
 assert.equal(steam.status,'fulfilled');assert.equal(atlas.status,'rejected');assert.equal(aborted,true);
 const pool=combineRecommendationPools(steam,atlas);assert.equal(pool.partial,true);assert.deepEqual(pool.games.map(game=>game.steamId),[10]);
 release?.([game(20)]);await Promise.resolve();assert.deepEqual(pool.games.map(game=>game.steamId),[10]);
});
test('parent cancellation suppresses results instead of publishing them as partial success',async()=>{
 const controller=new AbortController();
 const result=settleRecommendationSources(async()=>({games:[game(10)],tags:[]}),()=>new Promise(()=>{}),controller.signal,1000);
 controller.abort(new Error('left page'));
 await assert.rejects(result,/left page/);
});
