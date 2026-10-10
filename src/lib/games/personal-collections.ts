import { sourceOrigin } from './source-origin';
import {parseCollectionRules,type CollectionRules} from "./collection-rules";
import type { GameSummary } from "./types";
import { gameImage } from "./steam-data";
import { isIgdbImage } from "./igdb-data";
import { isLauncherGameId, launcherCatalogGame, launcherCatalogSteamId, launcherProductImage } from "./launchers";
import { EMULATION_SYSTEMS } from "./emulation";
import { romPreferenceId } from "./library-preferences";
import { sourceListingGame } from "./source-listing";

export type CollectionLocalReference = {kind:"custom";id:string} | {kind:"rom";system:number;path:string};
export type PersonalCollectionGame = GameSummary & {local?:CollectionLocalReference};
export type PersonalGameCollection={id:string;name:string;description:string;pinned:boolean;createdAt:number;updatedAt:number;gameIds:string[];rules?:CollectionRules};
export type PersonalGameCollections={version:1;collections:PersonalGameCollection[];games:Record<string,PersonalCollectionGame>};
export const emptyPersonalCollections=():PersonalGameCollections=>({version:1,collections:[],games:{}});
export const personalCollectionsKey=(profile:string)=>`harbor.games.collections.v1:${encodeURIComponent(profile)}`;
const MAX_BYTES=4*1024*1024,MAX_COLLECTIONS=200,MAX_GAMES=5000;
const positive=(value:unknown):value is number=>typeof value==="number"&&Number.isSafeInteger(value)&&value>0;
const image=(value:unknown)=>isIgdbImage(value)?value:gameImage(value);
export function collectionGame(value:unknown):PersonalCollectionGame|null{
  if(!value||typeof value!=="object")return null;const v=value as Record<string,unknown>;
  if(typeof v.id === "string" && v.id.startsWith("source:"))return sourceListingGame(value);
  if(typeof v.name!=="string"||!v.name.trim())return null;
  const display={name:v.name.trim().slice(0,500),capsule:image(v.capsule),portrait:image(v.portrait)||undefined,platforms:Array.isArray(v.platforms)?v.platforms.filter((p):p is string=>typeof p==="string").slice(0,30).map(p=>p.slice(0,100)):[]};
  if(v.local!==undefined){
    if(!v.local||typeof v.local!=="object")return null;
    const ref=v.local as Record<string,unknown>;
    let local:CollectionLocalReference,id:string;
    if(ref.kind==="custom"&&typeof ref.id==="string"&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(ref.id)){
      local={kind:"custom",id:ref.id};id=`custom:${ref.id}`;
    }else if(ref.kind==="rom"&&typeof ref.system==="number"&&EMULATION_SYSTEMS.some(s=>s.id===ref.system)&&typeof ref.path==="string"&&ref.path.length<4096&&/^(?:[a-z]:[\\/]|[\\/])/i.test(ref.path)&&!ref.path.includes("\0")){
      local={kind:"rom",system:ref.system,path:ref.path};id=romPreferenceId(ref.system,ref.path);
    }else return null;
    // Only an identity and display snapshot belong here. Launch configuration stays in the local library.
    return v.id===id?{id,...display,local}:null;
  }
  const launcherId = isLauncherGameId(v.id) ? v.id : undefined;
  const igdbId=positive(v.igdbId)?v.igdbId:undefined,steamId=!launcherId&&v.id!==`igdb:${igdbId}`&&positive(v.steamId)?v.steamId:undefined;
  if((!steamId&&!igdbId&&!launcherId)||typeof v.name!=="string"||!v.name.trim())return null;
  return launcherCatalogGame({... (sourceOrigin(v.sourceOrigin) ? {sourceOrigin:sourceOrigin(v.sourceOrigin)} : {}),id:launcherId??(steamId?`steam:${steamId}`:`igdb:${igdbId}`),steamId,igdbId,catalogSteamId:launcherCatalogSteamId(launcherId,v.catalogSteamId),name:v.name.trim().slice(0,500),capsule:image(v.capsule)||launcherProductImage(launcherId,v.capsule)||(steamId?`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamId}/header.jpg`:""),portrait:image(v.portrait)||undefined,platforms:Array.isArray(v.platforms)?v.platforms.filter((p):p is string=>typeof p==="string").slice(0,30).map(p=>p.slice(0,100)):[]});
}
export function parsePersonalCollections(raw:string|null):PersonalGameCollections{
  if(raw===null)return emptyPersonalCollections();if(raw.length>MAX_BYTES)throw Error("collections_limit");
  let value:unknown;try{value=JSON.parse(raw);}catch{throw Error("collections_read");}
  const v=value as PersonalGameCollections;if(!v||v.version!==1||!Array.isArray(v.collections)||!v.games||typeof v.games!=="object"||Array.isArray(v.games))throw Error("collections_read");
  if(v.collections.length>MAX_COLLECTIONS||Object.keys(v.games).length>MAX_GAMES)throw Error("collections_limit");
  const games:Record<string,PersonalCollectionGame>={};for(const[key,entry]of Object.entries(v.games)){const game=collectionGame(entry);if(!game||game.id!==key)throw Error("collections_read");games[key]=game;}
  const ids=new Set<string>(),names=new Set<string>();
  const collections=v.collections.map(c=>{
    if(!c||typeof c.id!=="string"||!/^[-a-zA-Z0-9_]{1,64}$/.test(c.id)||ids.has(c.id)||typeof c.name!=="string"||!c.name.trim()||c.name.length>80||names.has(c.name.toLocaleLowerCase())||typeof c.description!=="string"||c.description.length>240||typeof c.pinned!=="boolean"||!Number.isFinite(c.createdAt)||!Number.isFinite(c.updatedAt)||!Array.isArray(c.gameIds)||c.gameIds.length>MAX_GAMES||c.gameIds.some(id=>typeof id!=="string"||!games[id]))throw Error("collections_read");
    const rules=c.rules===undefined?undefined:parseCollectionRules(c.rules);
    if(rules&&c.gameIds.length)throw Error("collections_rules");
    ids.add(c.id);names.add(c.name.toLocaleLowerCase());return{...c,gameIds:[...new Set(c.gameIds)],...(rules?{rules}:{})};
  });return{version:1,collections,games};
}
function cleanName(name:string,list:PersonalGameCollection[],except?:string){const result=name.trim();if(!result||result.length>80)throw Error("collections_name");if(list.some(c=>c.id!==except&&c.name.toLocaleLowerCase()===result.toLocaleLowerCase()))throw Error("collections_duplicate");return result;}
export function createPersonalCollection(store:PersonalGameCollections,name:string,id:string,at=Date.now(),rules?:CollectionRules):PersonalGameCollections{
  if(store.collections.length>=MAX_COLLECTIONS)throw Error("collections_limit");
  return{...store,collections:[{id,name:cleanName(name,store.collections),description:"",pinned:false,createdAt:at,updatedAt:at,gameIds:[],...(rules!==undefined?{rules:parseCollectionRules(rules)}:{})},...store.collections]};
}
export function updatePersonalCollection(store:PersonalGameCollections,id:string,change:Partial<Pick<PersonalGameCollection,"name"|"description"|"pinned"|"rules">>):PersonalGameCollections{
  if(!store.collections.some(c=>c.id===id))throw Error("collections_missing");
  if("rules" in change){if(!store.collections.find(c=>c.id===id)?.rules)throw Error("collections_rules");change={...change,rules:parseCollectionRules(change.rules)};}
  const name=change.name===undefined?undefined:cleanName(change.name,store.collections,id);
  if(change.description!==undefined&&change.description.trim().length>240)throw Error("collections_name");
  return{...store,collections:store.collections.map(c=>c.id===id?{...c,...change,name:name??c.name,description:change.description?.trim()??c.description,updatedAt:Date.now()}:c)};
}
function sameGame(a:PersonalCollectionGame,b:PersonalCollectionGame){if(a.local||b.local)return !!a.local&&!!b.local&&a.id===b.id;if([a.id,b.id].some(isLauncherGameId))return a.id===b.id;if(a.id.startsWith("igdb:")!==b.id.startsWith("igdb:"))return false;if(a.steamId&&b.steamId&&a.steamId!==b.steamId)return false;return a.id===b.id||!!(a.steamId&&a.steamId===b.steamId)||!!(a.igdbId&&a.igdbId===b.igdbId);}
export function collectionHasGame(store:PersonalGameCollections,collection:PersonalGameCollection,game:PersonalCollectionGame){return collection.gameIds.some(id=>{const saved=store.games[id];return saved&&sameGame(saved,game);});}
const prune=(store:PersonalGameCollections):PersonalGameCollections=>{const used=new Set(store.collections.flatMap(c=>c.gameIds));return{...store,games:Object.fromEntries(Object.entries(store.games).filter(([id])=>used.has(id)))};};
export function removePersonalCollection(store:PersonalGameCollections,id:string){return prune({...store,collections:store.collections.filter(c=>c.id!==id)});}
export function removeCollectionGame(store:PersonalGameCollections,id:string,gameId:string){if(store.collections.find(c=>c.id===id)?.rules)throw Error("collections_dynamic");return prune({...store,collections:store.collections.map(c=>c.id===id?{...c,gameIds:c.gameIds.filter(value=>value!==gameId),updatedAt:Date.now()}:c)});}
export function addCollectionGame(store:PersonalGameCollections,id:string,input:PersonalCollectionGame):PersonalGameCollections{
  if(!store.collections.some(c=>c.id===id))throw Error("collections_missing");
  if(store.collections.find(c=>c.id===id)?.rules)throw Error("collections_dynamic");
  const incoming=collectionGame(input);if(!incoming)throw Error("collections_game");
  let aliases=Object.values(store.games).filter(g=>sameGame(g,incoming));
  // Two Steam editions can share one IGDB record. An IGDB-only card cannot decide which edition it is.
  if(!incoming.steamId&&new Set(aliases.map(g=>g.steamId).filter(Boolean)).size>1)aliases=aliases.filter(g=>g.id===incoming.id);
  const prior=aliases.find(g=>g.steamId)??aliases[0];
  const game=collectionGame({...prior,...incoming,steamId:incoming.steamId??prior?.steamId,igdbId:incoming.igdbId??prior?.igdbId,portrait:incoming.portrait??prior?.portrait})!;
  const aliasIds=new Set(aliases.map(g=>g.id));const games={...store.games};for(const alias of aliasIds)delete games[alias];games[game.id]=game;
  if(Object.keys(games).length>MAX_GAMES)throw Error("collections_limit");
  return{...store,games,collections:store.collections.map(c=>{const gameIds=[...new Set(c.gameIds.map(key=>aliasIds.has(key)?game.id:key))];return{...c,gameIds:c.id===id&&!gameIds.includes(game.id)?[game.id,...gameIds]:gameIds,updatedAt:c.id===id?Date.now():c.updatedAt};})};
}
export function readPersonalCollections(profile:string){return parsePersonalCollections(localStorage.getItem(personalCollectionsKey(profile)));}
export function addCollectionGames(store: PersonalGameCollections, id: string, games: PersonalCollectionGame[]) {
  if (!games.length || games.length > MAX_GAMES) throw Error("collections_limit");
  // One serialized commit makes invalid members or storage failure an all-or-nothing operation.
  return games.reduce((next, game) => addCollectionGame(next, id, game), store);
}
const writes=new Map<string,Promise<unknown>>();
export function changePersonalCollections(profile:string,change:(store:PersonalGameCollections)=>PersonalGameCollections):Promise<PersonalGameCollections>{
  const key=personalCollectionsKey(profile);
  const commit=()=>{const next=change(readPersonalCollections(profile)),raw=JSON.stringify(next);if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error("collections_limit");const checked=parsePersonalCollections(raw);localStorage.setItem(key,raw);return checked;};
  const pending=(writes.get(key)??Promise.resolve()).catch(()=>{}).then(()=>typeof navigator!=="undefined"&&navigator.locks?navigator.locks.request(key,commit):commit());
  writes.set(key,pending);void pending.finally(()=>{if(writes.get(key)===pending)writes.delete(key);}).catch(()=>{});return pending;
}
