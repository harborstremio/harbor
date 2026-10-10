import { parseSteamArtwork, parseSteamStoreItems } from "./steam-data";
import { decodeRecommendationTagProfile } from "./recommendation-tags";
import { parseSteamReviewSummary } from "./rating-data";
import type { DiscoveryCandidate } from "./discovery-picker";
const row=(value:unknown):Record<string,any>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:{};

/** Explicit taxonomy translation, never a claim that Steam and IGDB numeric IDs are interchangeable. */
export function atlasDiscoveryTags(value:unknown,names:{id:number;name:string}[]) {
  const source=row(value),known=new Map(names.map(tag=>[tag.name.toLowerCase(),tag.id]));
  const aliases:Record<string,string>={"role-playing (rpg)":"rpg","simulator":"simulation","co-operative":"co-op","split screen":"local multiplayer"};
  const labels=[...Array.isArray(source.genres)?source.genres:[],...Array.isArray(source.themes)?source.themes:[],...Array.isArray(source.game_modes)?source.game_modes:[],...Array.isArray(source.keywords)?source.keywords:[]];
  return [...new Set(labels.flatMap(item=>{const label=String(row(item).name??"").toLowerCase();const id=known.get(aliases[label]??label);return id?[id]:[];}))].map(id=>({id,weight:1}));
}

export function parseDiscoveryMetadata(value:unknown, ids:number[]):DiscoveryCandidate[] {
  const raw=row(row(value).response).store_items;
  if(!Array.isArray(raw))throw Error("Discovery metadata unavailable");
  return parseSteamStoreItems(value,ids).flatMap(game=>{
    const source=raw.map(row).find(item=>item.appid===game.steamId&&item.success===1);
    const tags=decodeRecommendationTagProfile({appid:game.steamId,tags:(Array.isArray(source?.tags)?source.tags:[]).slice(0,20).map((tag:unknown)=>({id:row(tag).tagid,weight:row(tag).weight}))});
    // No unverified tag matches. Missing metadata remains unavailable, not a negative preference.
    if(!source||!tags)return [];
    return [{game,tags:tags.tags,reviews:parseSteamReviewSummary(row(source.reviews).summary_filtered),hero:parseSteamArtwork(value,game.steamId!).libraryHero,description:typeof row(source.basic_info).short_description==="string"?row(source.basic_info).short_description.slice(0,800):undefined,controller:Array.isArray(row(source.categories).controller_categoryids)&&row(source.categories).controller_categoryids.includes(28)}];
  });
}

