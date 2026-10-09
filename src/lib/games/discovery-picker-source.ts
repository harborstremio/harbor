import { parseDiscoveryMetadata, atlasDiscoveryTags } from "./discovery-picker-data";
import { safeFetch } from "@/lib/safe-fetch";
import { loadGameCatalog, loadRecommendationTagNames } from "./catalog";
import { queryIgdb } from "./atlas";
import { GameRequestPool } from "./request-pool";
import { discoveryQueryStages, rankDiscovery, type DiscoveryCandidate, type DiscoveryOptions, type DiscoverySignal, type DiscoveryTaste } from "./discovery-picker";
import type { CatalogFilters } from "./catalog-filters";
import type { GameSummary } from "./types";
import { savedMetadataAt } from "./metadata-records";
import { igdbSteamIds } from "./igdb-data";

const pool=new GameRequestPool(2);
const MAX_SESSION_CANDIDATES=480;
const cache=new Map<number,{at:number;value:DiscoveryCandidate}>();
const row=(value:unknown):Record<string,any>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:{};

export async function loadDiscoveryMetadata(ids: number[], signal:AbortSignal):Promise<DiscoveryCandidate[]> {
  signal.throwIfAborted();
  const unique=[...new Set(ids)].filter(id=>Number.isSafeInteger(id)&&id>0).slice(0,120),result:DiscoveryCandidate[]=[];
  const missing=unique.filter(id=>{const held=cache.get(id);if(held&&Date.now()-held.at<900_000){result.push(held.value);return false;}return true;});
  const batches=Array.from({length:Math.ceil(missing.length/24)},(_,i)=>missing.slice(i*24,i*24+24));
  const responses=await Promise.allSettled(batches.map(batch=>pool.run(async()=>{
    const controller=new AbortController(),abort=()=>controller.abort(signal.reason);
    signal.addEventListener("abort",abort,{once:true});const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      signal.throwIfAborted();
      const input=encodeURIComponent(JSON.stringify({ids:batch.map(appid=>({appid})),context:{language:"english",country_code:"US"},data_request:{include_assets:true,include_basic_info:true,include_release:true,include_platforms:true,include_reviews:true,include_tag_count:20,include_categories:true}}));
      const response=await safeFetch(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${input}`,{signal:controller.signal});
      if(!response.ok)throw Error(`Steam discovery ${response.status}`);
      const data=parseDiscoveryMetadata(await response.json(),batch);
      for(const item of data){cache.delete(item.game.steamId!);cache.set(item.game.steamId!,{at:Date.now(),value:item});}
      while(cache.size>400)cache.delete(cache.keys().next().value!);
      return data;
    }finally{clearTimeout(timeout);signal.removeEventListener("abort",abort);}
  },signal)));
  signal.throwIfAborted();
  for(const response of responses)if(response.status==="fulfilled")result.push(...response.value);
  if(!result.length&&responses.some(response=>response.status==="rejected"))throw Error("Discovery metadata unavailable");
  return result;
}

export type DiscoveryLane={filters:CatalogFilters;offset:number|null;stage:number};
export type DiscoveryFeed={candidates:DiscoveryCandidate[];taste:DiscoveryTaste[];lanes:DiscoveryLane[];stage:number;hasMore:boolean;libraryOffset:number;partial:boolean;cachedAt?:number};

export async function loadDiscoveryFeed(options:DiscoveryOptions,signals:DiscoverySignal[],library:GameSummary[],signal:AbortSignal,previous?:DiscoveryFeed):Promise<DiscoveryFeed> {
  signal.throwIfAborted();let partial=previous?.partial??false,cachedAt=previous?.cachedAt;
  const seedMetadata=previous?[]:await loadDiscoveryMetadata(signals.flatMap(s=>s.game.steamId?[s.game.steamId]:[]),signal).catch(()=>{signal.throwIfAborted();partial=true;return [] as DiscoveryCandidate[];});
  let taste=previous?.taste??signals.flatMap(s=>{const meta=seedMetadata.find(item=>item.game.steamId===s.game.steamId);return meta?[{signal:{...s,game:{...s.game,...meta.game}},tags:meta.tags}]:[];});
  if(!previous){
    const nonSteam=signals.filter(s=>!s.game.steamId&&s.game.igdbId);
    if(nonSteam.length){
      const results=await Promise.allSettled([queryIgdb(`fields name,genres.name,themes.name,game_modes.name,keywords.name,external_games.uid,external_games.external_game_source; where id = (${nonSteam.map(s=>s.game.igdbId).join(",")}); limit 13;`,signal),loadRecommendationTagNames("en")]);
      signal.throwIfAborted();
      if(results[0].status==="fulfilled"&&results[1].status==="fulfilled"){
        const rows=results[0].value,names=results[1].value;
        taste=[...taste,...nonSteam.flatMap(s=>{
          const source=rows.find(item=>row(item).id===s.game.igdbId),tags=atlasDiscoveryTags(source,names);
          const aliases=igdbSteamIds(source);
          // Exclude a favorite's exact Steam counterpart too; never join games by title.
          const signal=aliases.length===1?{...s,game:{...s.game,steamId:aliases[0]}}:s;
          return tags.length?[{signal,tags}]:[];
        })];
      }else partial=true;
    }
  }
  if(signals.length>taste.length)partial=true;
  const stages=discoveryQueryStages(options,taste);
  const owned=[...new Map(library.filter(game=>game.steamId).map(game=>[game.steamId,game])).values()];
  let stage=previous?.stage??0,lanes=previous?.lanes??stages[0].map(filters=>({filters,offset:0,stage:0}));
  let candidates=previous?.candidates??[],libraryOffset=previous?.libraryOffset??0,unavailable=false;
  const available=()=>rankDiscovery(candidates,taste,options,library).length;
  const target=Math.min(120,(previous?available():0)+12);
  const advance=()=>{
    if(options.scope==="library"||stage>=stages.length-1)return false;
    stage++;lanes=[...lanes,...stages[stage].map(filters=>({filters,offset:0,stage}))];return true;
  };
  const hasMore=()=>options.scope==="library"?libraryOffset<owned.length:stage<stages.length-1||lanes.some(lane=>lane.offset!==null);
  // Fill the first screen automatically, including when metadata/ownership removes a catalog page.
  // Keep continuations for every queried lane; six bounded rounds prevent an endless empty scan.
  for(let round=0;round<6;round++){
    signal.throwIfAborted();let games:GameSummary[]=[];
    if(options.scope==="library"){
      games=owned.slice(libraryOffset,libraryOffset+90);libraryOffset+=games.length;
    }else{
      let active=lanes.filter(lane=>lane.stage===stage&&lane.offset!==null);
      if(!active.length&&advance())active=lanes.filter(lane=>lane.stage===stage&&lane.offset!==null);
      if(!active.length)active=lanes.filter(lane=>lane.offset!==null).slice(0,4);
      if(!active.length)break;
      const responses=await Promise.allSettled(active.map(lane=>loadGameCatalog("",lane.filters,lane.offset!,signal)));
      signal.throwIfAborted();
      if(responses.every(response=>response.status==="rejected")){
        if(!available())throw Error("Discovery catalog unavailable");
        partial=true;break;
      }
      lanes=lanes.map(lane=>{
        const index=active.indexOf(lane);if(index<0)return lane;
        const response=responses[index];if(response.status==="rejected"){partial=true;unavailable=true;return lane;}
        games.push(...response.value.games);const at=savedMetadataAt(response.value);if(at)cachedAt=Math.min(cachedAt??at,at);
        return {...lane,offset:response.value.nextOffset};
      });
    }
    const ids=[...new Set(games.flatMap(game=>game.steamId?[game.steamId]:[]))];
    const metadata=await loadDiscoveryMetadata(ids,signal).catch(()=>{
      signal.throwIfAborted();partial=true;unavailable=true;return [] as DiscoveryCandidate[];
    });
    signal.throwIfAborted();if(metadata.length<ids.length)partial=true;
    candidates=[...new Map([...candidates,...metadata].map(item=>[item.game.id,item])).values()].slice(0,MAX_SESSION_CANDIDATES);
    // A modal shortlist has a finite ranking budget; another set of choices starts a fresh search.
    if(candidates.length>=MAX_SESSION_CANDIDATES){lanes=lanes.map(lane=>({...lane,offset:null}));libraryOffset=owned.length;stage=stages.length-1;break;}
    if(available()>=target||!hasMore())break;
    // Try fewer mood tags before requiring the user to edit choices or click Find more.
    if(!advance()&&unavailable)break;
  }
  if(unavailable&&!available())throw Error("Discovery metadata unavailable");
  return {candidates,taste,lanes,stage,hasMore:hasMore(),libraryOffset,partial,cachedAt};
}
