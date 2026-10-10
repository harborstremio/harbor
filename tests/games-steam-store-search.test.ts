import assert from 'node:assert/strict';
import test from 'node:test';
import { steamStoreQuery, steamStoreParameters, steamStoreUrl, parseSteamStoreCountry, parseSteamStoreOffer, parseSteamStoreSearch, decodeSteamStoreSearch, readSteamStorePreferences, writeSteamStorePreferences, steamStorePreferencesKey, type SteamStorePage } from '../src/lib/games/steam-store-search.ts';
import { GameMetadataCache } from '../src/lib/games/metadata-cache.ts';
import { decodeGameMetadata, markSavedMetadata } from '../src/lib/games/metadata-records.ts';

const item=(appid=620)=>({appid,success:1,type:0,item_type:0,name:'Portal 2',visible:true,assets:{main_capsule:'header.jpg',asset_url_format:`steam/apps/${appid}/`+'${FILENAME}'},platforms:{windows:true},release:{steam_release_date:1303186800},best_purchase_option:{formatted_final_price:'1,95€',formatted_original_price:'9,75€',discount_pct:80,final_price_in_cents:'195'}});
const page=():SteamStorePage=>parseSteamStoreSearch({response:{store_items:[item()]}},[620],'DE',1,0);
test('automatic region comes from the storefront configuration, never guessed from language or price',()=>{
  assert.equal(parseSteamStoreCountry('<div id="application_config" data-config="{&quot;LANGUAGE&quot;:&quot;english&quot;,&quot;COUNTRY&quot;:&quot;JP&quot;}"></div>'),'JP');
  assert.equal(parseSteamStoreCountry("<div data-config='{\"COUNTRY\":\"DE\"}' id='application_config'></div>"),'DE');
  assert.equal(parseSteamStoreCountry('<div id="application_config" data-config="{&#34;COUNTRY&#34;:&#x22;US&#x22;}">'),'US');
  for(const value of ['',null,'COUNTRY=US','<div data-config="{&quot;COUNTRY&quot;:&quot;US&quot;}">',...['ZZ','auto','en','US&cc=RU'].map(country=>`<div id="application_config" data-config='{\"COUNTRY\":\"${country}\"}'>`)])assert.throws(()=>parseSteamStoreCountry(value),/steam_store_country/);
});
const key=(country='DE')=>'steam-store-search:v1:'+steamStoreParameters('Portal',country);

test('Steam prefix is explicit, case-insensitive and never captures ordinary titles',()=>{
  for(const input of ['st Portal','ST Portal','st: Portal','st '])assert.equal(steamStoreQuery(input,false),null,'disabled shortcuts use normal search');
  for(const input of ['star wars','stalker','steam games','best st game','st'])assert.equal(steamStoreQuery(input),null,input);
  assert.equal(steamStoreQuery('ST Portal 2'),'Portal 2');assert.equal(steamStoreQuery('st: Doom'),'Doom');assert.equal(steamStoreQuery('st '),'');assert.equal(steamStoreQuery('st '+ 'a'.repeat(200))?.length,180);
});
test('region/page parameters distinguish automatic and explicit stores and validate numeric offsets',()=>{
  assert.equal(steamStoreParameters(' Portal & 2 ','auto').has('cc'),false);
  assert.equal(steamStoreParameters(' Portal & 2 ','DE',30).get('term'),'Portal & 2');assert.equal(steamStoreParameters('Portal','DE',30).get('cc'),'DE');
  for(const country of ['ZZ','de','US&cc=RU','',null])assert.throws(()=>steamStoreParameters('',country as string));
  for(const offset of [-1,.5,NaN,1_000_001])assert.throws(()=>steamStoreParameters('','DE',offset));
});
test('store actions construct exact app-only web/client URLs without launch or installation commands',()=>{
  assert.equal(steamStoreUrl(620,'DE'),'https://store.steampowered.com/app/620/?cc=DE');assert.equal(steamStoreUrl(620,'auto',true),'steam://openurl/https://store.steampowered.com/app/620/');
  for(const id of [0,-1,1.5,NaN,4294967296,'620/../../run/1'])assert.throws(()=>steamStoreUrl(id as number,'US'));
});
test('regional provider text and original prices are retained without currency guesses or reverse discount arithmetic',()=>{
  assert.deepEqual(parseSteamStoreOffer(item()),{kind:'paid',final:'1,95€',original:'9,75€',discount:80});
  assert.deepEqual(parseSteamStoreOffer({best_purchase_option:{formatted_final_price:'¥ 0',formatted_original_price:'¥ 980',discount_pct:100}}),{kind:'paid',final:'¥ 0',original:'¥ 980',discount:100});
  assert.deepEqual(parseSteamStoreOffer({best_purchase_option:{formatted_final_price:'ARS$ 1.999,00',discount_pct:20}}),{kind:'paid',final:'ARS$ 1.999,00',discount:20});
});
test('free and unavailable are explicit; malformed display values and hidden discounts never become a sale',()=>{
  assert.deepEqual(parseSteamStoreOffer({is_free:true}),{kind:'free'});assert.deepEqual(parseSteamStoreOffer({}),{kind:'unavailable'});
  for(const price of ['',123,'<b>Free</b>','\u0000$10','x'.repeat(81)])assert.deepEqual(parseSteamStoreOffer({best_purchase_option:{formatted_final_price:price}}),{kind:'unavailable'});
  for(const flag of ['hide_discount_pct_for_compliance','price_cannot_be_displayed_as_discount'])assert.deepEqual(parseSteamStoreOffer({...item(),best_purchase_option:{...item().best_purchase_option,[flag]:true}}),{kind:'paid',final:'1,95€'});
});
test('ordered exact game results omit package/DLC items and remove the legacy USD summary price',()=>{
  const result=parseSteamStoreSearch({response:{store_items:[item(730),{...item(999),type:1},item(620)]}},[620,999,730],'DE',40,0);
  assert.deepEqual(result.games.map(game=>game.steamId),[620,730]);assert.equal(result.games[0].price,undefined);assert.deepEqual(result.games[0].offer,{kind:'paid',final:'1,95€',original:'9,75€',discount:80});assert.equal(result.nextOffset,30);
  assert.deepEqual(parseSteamStoreSearch({},[],'auto',0,0),{games:[],country:'auto',total:0,nextOffset:null});
});
test('stored pages reject wrong regions, duplicate identities, bad paging and invalid price fields',()=>{
  const value=page();assert.equal(value.games.length,1);assert.deepEqual(decodeSteamStoreSearch(key(),value),value);assert.deepEqual(decodeGameMetadata(key(),value),value);
  for(const invalid of [{...value,country:'US'},{...value,games:[...value.games,...value.games]},{...value,nextOffset:999},{...value,total:-1},{...value,games:[{...value.games[0],id:'steam:999'}]},{...value,games:[{...value.games[0],offer:{kind:'paid',final:'<script>x</script>'}}]}])assert.equal(decodeSteamStoreSearch(key(),invalid),null);
});
test('upcoming games remain upcoming even without price; saved results keep prices explicitly dated',()=>{
  const result=parseSteamStoreSearch({response:{store_items:[{...item(),release:{is_coming_soon:true},best_purchase_option:null}]}},[620],'DE',1,0);
  assert.equal(result.games[0].comingSoon,true);assert.deepEqual(result.games[0].offer,{kind:'unavailable'});
  const snapshot=markSavedMetadata(page(),123);assert.equal(snapshot.cachedAt,123);assert.equal(snapshot.games[0].cachedAt,123);assert.equal(snapshot.games[0].offer.kind,'paid');
});
test('cache separates regional identities and survives an offline reopen with dated price evidence',async()=>{
  const records=new Map(),store={read:async(k:string)=>records.get(k)??null,write:async(k:string,value:unknown)=>{records.set(k,structuredClone(value));}};
  const cache=new GameMetadataCache(store,()=>1000);let calls=0;
  await cache.load(key(),async()=>{calls++;return page()});await cache.load(key(),async()=>{throw Error('fresh cache missed')});
  await cache.load(key('US'),async()=>{calls++;return {...page(),country:'US'}});assert.equal(calls,2);assert.equal(records.size,2);
  const reopened=new GameMetadataCache(store,()=>2000,()=>false);const offline=await reopened.load<SteamStorePage>(key(),async()=>{throw Error('offline request')});assert.equal(offline.cachedAt,1000);assert.equal(offline.games[0].offer.kind,'paid');
});
test('preference writes isolate profiles, preserve other fields and leave corrupt/quota-failed values untouched',()=>{
  const values=new Map<string,string>();let fail=false;
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('quota');values.set(key,value)}};
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});Object.defineProperty(globalThis,'window',{value:{dispatchEvent:()=>true},configurable:true});
  assert.deepEqual(readSteamStorePreferences('a'),{country:'auto',showLibrary:true});writeSteamStorePreferences('a',{country:'DE'});writeSteamStorePreferences('a',{showLibrary:false});assert.deepEqual(readSteamStorePreferences('a'),{country:'DE',showLibrary:false});assert.equal(readSteamStorePreferences('b').country,'auto');
  fail=true;assert.throws(()=>writeSteamStorePreferences('a',{country:'JP'}),/quota/);assert.equal(readSteamStorePreferences('a').country,'DE');fail=false;
  values.set(steamStorePreferencesKey('a'),'{broken');assert.throws(()=>writeSteamStorePreferences('a',{country:'JP'}));assert.equal(values.get(steamStorePreferencesKey('a')),'{broken');
});
