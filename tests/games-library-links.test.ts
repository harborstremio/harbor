import assert from 'node:assert/strict';
import test from 'node:test';
import {gameLinks,knownGameLinks,orderedLibraryLinks,reviewLibraryLinks,sortLibraryLinks,validGameLinkUrl,validLibraryLinkOrder,websiteGameLinks} from '../src/lib/games/library-links.ts';
import {changeLibraryLinkOrders,changeLibraryPreferences,defaultLibraryPreference,emptyLibraryPreferences,libraryPreferenceKey,parseLibraryPreferences,patchLibraryLinkOrders,patchLibraryPreferences,readLibraryPreferences} from '../src/lib/games/library-preferences.ts';
import {parseSteamDetail} from '../src/lib/games/steam-data.ts';
import {parseAtlasGame} from '../src/lib/games/igdb-data.ts';
import {decodeIgdbRows} from '../src/lib/games/igdb-records.ts';
import {decodeGameMetadata} from '../src/lib/games/metadata-records.ts';

const links=[{name:'Wiki',url:'https://z.example/game?edition=2#guide'},{name:'Official',url:'https://a.example/Game'},{name:'Forums',url:'https://m.example/game'}];
const game={id:'steam:620',steamId:620,name:'Portal 2',capsule:'',platforms:[],links};
test('sorts complete URLs and retains names, exact destinations and object identity',()=>{
 const result=sortLibraryLinks(links);assert.deepEqual(result,[links[1],links[2],links[0]]);assert.equal(result[0],links[1]);assert.equal(links[0].name,'Wiki');
 const numbered=[{name:'2',url:'https://a.example/2'},{name:'10',url:'https://a.example/10'}];assert.equal(sortLibraryLinks(numbered)[0].name,'10');
});
test('exact URL ties retain names and deterministic case ordering survives saving',()=>{
 const tied=[{name:'a1',url:'https://x.example/a'},{name:'A',url:'https://x.example/A'},{name:'a2',url:'https://x.example/a'}];
 const [row]=reviewLibraryLinks([{id:game.id,name:game.name,links:tied}],{},'en');assert.deepEqual(orderedLibraryLinks(tied,row.order),row.next);assert.deepEqual(row.next.filter(x=>x.url.endsWith('/a')).map(x=>x.name),['a1','a2']);
});
test('saved orders append new URLs without resurrecting removed destinations',()=>{
 const order=sortLibraryLinks(links).map(x=>x.url),newLink={name:'News',url:'https://news.example/'};
 assert.deepEqual(orderedLibraryLinks([links[0],newLink,links[1]],order),[links[1],links[0],newLink]);
});
test('review deduplicates game identities, ignores empty link lists and counts actual order changes',()=>{
 const items=[{id:game.id,name:game.name,links},{id:'igdb:2',name:'Empty',links:[]},{id:game.id,name:game.name,links}];
 const rows=reviewLibraryLinks(items,{},'en');assert.equal(rows.length,2);assert.equal(rows.filter(x=>x.changed).length,1);
 const saved=patchLibraryLinkOrders(emptyLibraryPreferences(),rows.filter(x=>x.changed));assert.equal(reviewLibraryLinks(items,saved.entries,'en').filter(x=>x.changed).length,0);
 const restored=reviewLibraryLinks(items,saved.entries,'en',true);assert.deepEqual(restored[0].next,links);assert.deepEqual(restored[0].order,[]);
});
test('only valid public web destinations and meaningful names are accepted',()=>{
 for(const url of ['javascript:alert(1)','file:///game.exe','steam://run/620','https://user:password@site.test','https://site.test/\npath',' https://site.test/','https://site.test/a b','https://site.test/'+ 'x'.repeat(4096)])assert.equal(validGameLinkUrl(url),false,url);
 assert.equal(validGameLinkUrl('http://localhost/game'),true);assert.equal(validGameLinkUrl('https://例え.jp/path?x=%2F#part'),true);
 assert.deepEqual(gameLinks([{name:'Exact name',url:'https://site.test/?a=%2f'},{name:'',url:'https://site.test/'},{name:'Bad\nname',url:'https://site.test/'}]),[{name:'Exact name',url:'https://site.test/?a=%2f'}]);
 assert.deepEqual(websiteGameLinks([{url:'https://www.site.test/Game?x=%2f'}]),[{name:'site.test',url:'https://www.site.test/Game?x=%2f'}]);
 assert.equal(validLibraryLinkOrder([links[0].url,links[0].url]),false);assert.equal(validLibraryLinkOrder(Array.from({length:201},(_,i)=>`https://x.example/${i}`)),false);
});
test('known links combine verified game metadata without conflating same-URL names',()=>{
 const result=knownGameLinks(game.id,game,{...game,links:[...links,{name:'Alternate name',url:links[0].url}]});
 assert.deepEqual(result.slice(0,2).map(x=>x.name),['Steam','Steam Community']);assert.equal(result.length,6);assert.equal(result.filter(x=>x.name==='Wiki').length,1);
 assert.equal(knownGameLinks('custom:unknown',{...game,steamId:-1,links:[]}).length,0);
});
test('Steam and IGDB link metadata survives validated snapshots without URL rewriting',()=>{
 const url='http://example.com/Game?x=%2f#Part';const steam=parseSteamDetail({'620':{success:true,data:{steam_appid:620,type:'game',name:'Portal 2',header_image:'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',website:url}}},620);
 assert.deepEqual(steam.links,[{name:'example.com',url}]);
 const saved=decodeGameMetadata('game:620',steam) as typeof steam;assert.deepEqual(saved?.links,steam.links);
 const raw={id:72,name:'Example',slug:'example',websites:[{type:1,url},{url:'https://forum.example/Game'},{type:1,url:'javascript:bad'}]};
 const atlas=parseAtlasGame(raw),decoded=decodeIgdbRows([raw]);assert.ok(decoded);assert.deepEqual(parseAtlasGame(decoded[0]).links,atlas.links);assert.equal(atlas.links?.length,3);
});
test('preference validation retains links through unrelated edits and rejects malformed orders',()=>{
 const original=patchLibraryLinkOrders(emptyLibraryPreferences(),[{id:game.id,order:links.map(x=>x.url)}]);
 assert.deepEqual(patchLibraryPreferences(original,[game.id],{pinned:true}).entries[game.id].linkOrder,links.map(x=>x.url));
 assert.deepEqual(patchLibraryPreferences(original,[game.id],{pinned:false}).entries[game.id].linkOrder,links.map(x=>x.url));
 for(const order of ['',null,['javascript:bad'],[links[0].url,links[0].url]]){
  assert.throws(()=>patchLibraryPreferences(emptyLibraryPreferences(),[game.id],{linkOrder:order as string[]}),/library_prefs_read/);
  assert.throws(()=>parseLibraryPreferences(JSON.stringify({version:1,entries:{[game.id]:{...defaultLibraryPreference(),linkOrder:order}}})),/library_prefs_read/);
 }
});
test('bulk link changes are atomic, conflict aware and preserve other preferences',()=>{
 let store=patchLibraryPreferences(emptyLibraryPreferences(),[game.id],{pinned:true,cover:'W:/Art/portal.png',title:'My Portal',playStatus:'playing'});
 const unchanged=JSON.stringify(store),order=sortLibraryLinks(links).map(x=>x.url);
 assert.throws(()=>patchLibraryLinkOrders(store,[{id:game.id,order},{id:'steam:2',order,expectedOrder:['https://old.example/']}]),/library_links_conflict/);assert.equal(JSON.stringify(store),unchanged);
 store=patchLibraryLinkOrders(store,[{id:game.id,order}]);assert.equal(store.entries[game.id].title,'My Portal');assert.equal(store.entries[game.id].pinned,true);
 store=patchLibraryLinkOrders(store,[{id:game.id,order:[],expectedOrder:order}]);assert.equal(store.entries[game.id].linkOrder,undefined);assert.equal(store.entries[game.id].cover,'W:/Art/portal.png');
 const onlyLinks=patchLibraryLinkOrders(emptyLibraryPreferences(),[{id:'igdb:2',order}]);assert.deepEqual(patchLibraryLinkOrders(onlyLinks,[{id:'igdb:2',order:[],expectedOrder:order}]),emptyLibraryPreferences());
});
test('all existing identity kinds keep independent link preferences',()=>{
 const ids=['steam:620','igdb:72','source:sample:release','custom:11111111-1111-4111-8111-111111111111','rom:24:W:/Games/game.gba','gog:1207658680','epic:namespace:catalog:app','steam-shortcut:123:2147483648'];
 const order=links.map(x=>x.url);for(const id of ids){const saved=patchLibraryLinkOrders(emptyLibraryPreferences(),[{id,order}]);assert.deepEqual(saved.entries[id].linkOrder,order,id);}
});
test('profile writes serialize, no-op sorting does not write, failure keeps original bytes',async()=>{
 const values=new Map<string,string>();let writes=0,fail=false;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('quota');writes++;values.set(key,value);}}});
 const order=sortLibraryLinks(links).map(x=>x.url);
 await Promise.all([changeLibraryLinkOrders('links-a',[{id:game.id,order}]),changeLibraryPreferences('links-a',[game.id],{pinned:true})]);
 assert.equal(readLibraryPreferences('links-a').entries[game.id].pinned,true);assert.deepEqual(readLibraryPreferences('links-b'),emptyLibraryPreferences());
 const count=writes,raw=values.get(libraryPreferenceKey('links-a'));await changeLibraryLinkOrders('links-a',[]);assert.equal(writes,count);
 fail=true;await assert.rejects(changeLibraryLinkOrders('links-a',[{id:game.id,order:[],expectedOrder:order}]),/quota/);assert.equal(values.get(libraryPreferenceKey('links-a')),raw);
 fail=false;await changeLibraryLinkOrders('links-a',[{id:game.id,order:[],expectedOrder:order}]);assert.equal(readLibraryPreferences('links-a').entries[game.id].linkOrder,undefined);
});
test('large bulk orders respect the shared document bounds and reject the entire oversized update',()=>{
 const order=['https://example.com/'],changes=Array.from({length:5000},(_,index)=>({id:`steam:${index+1}`,order}));
 assert.equal(Object.keys(patchLibraryLinkOrders(emptyLibraryPreferences(),changes).entries).length,5000);
 assert.throws(()=>patchLibraryLinkOrders(emptyLibraryPreferences(),[...changes,{id:'steam:5001',order}]),/library_prefs_limit/);
 const longOrder=Array.from({length:200},(_,index)=>`https://example.com/${index}/`+'x'.repeat(3000));
 const original=emptyLibraryPreferences();assert.throws(()=>patchLibraryLinkOrders(original,Array.from({length:4},(_,index)=>({id:`steam:${index+1}`,order:longOrder}))),/library_prefs_limit/);assert.deepEqual(original,emptyLibraryPreferences());
});
