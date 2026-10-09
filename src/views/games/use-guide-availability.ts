import { useEffect, useState } from "react";
import type { GuideAvailability } from "@/lib/games/guide-availability";

const cache=new Map<string,{at:number;value:GuideAvailability}>();
/** Check only settled detail visits; reuse public results when returning from the catalog. */
export function useGuideAvailability(name:string,steamId:number|undefined,active:boolean,writtenOnly=false) {
  const key=JSON.stringify([steamId??null,name,writtenOnly]);
  const [,render]=useState(0);
  const held=cache.get(key),fresh=!!held&&Date.now()-held.at<600_000;
  useEffect(()=>{
    if(!active || fresh)return;
    const request=new AbortController();
    const timer=setTimeout(()=>{
      void (async()=>{
        const [{checkGuideAvailability},{loadSteamGuides,loadPokemonGuides,loadGuideVideos,loadGuideArticle},{proConfigGame},{pokemonEdition}]=await Promise.all([
          import("@/lib/games/guide-availability"),import("@/lib/games/guides-fetch"),import("@/lib/games/pro-configs"),import("@/lib/games/pokemon-games"),
        ]);
        request.signal.throwIfAborted();
        const value=!writtenOnly&&proConfigGame(name,steamId)?"available":await checkGuideAvailability({
          written:steamId?()=>loadSteamGuides(steamId,"",1,{sort:"rated",days:7,categories:[],language:""},request.signal):pokemonEdition(name)&&!pokemonEdition(name)?.hack?()=>loadPokemonGuides(name,"",request.signal):undefined,
          videos:writtenOnly?undefined:()=>loadGuideVideos(name,"",false,request.signal,undefined,"relevance","all"),
          technical:writtenOnly?undefined:()=>loadGuideArticle({id:name,source:"pcwiki",title:name,author:"",image:"",description:"",url:""},steamId,request.signal),
        },request.signal);
        request.signal.throwIfAborted();
        // Unknown is not evidence of a guide. Do not cache transient failures as absence.
        if(value!=="unknown"){
          cache.delete(key);cache.set(key,{at:Date.now(),value});
          while(cache.size>128)cache.delete(cache.keys().next().value!);
        }
        render(value=>value+1);
      })().catch(()=>{});
    },600);
    return()=>{clearTimeout(timer);request.abort();};
  },[key,name,steamId,active,fresh,writtenOnly]);
  return held?.value === "available";
}
