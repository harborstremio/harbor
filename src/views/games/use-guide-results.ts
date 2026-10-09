import { useEffect, useRef, useState } from "react";
import type { GameGuide, GuideVideoCursor } from "@/lib/games/guides-data";
import { loadGuideVideos, loadKickGuides, loadPokemonGuides, loadSteamGuides } from "@/lib/games/guides-fetch";
import { pokemonEdition } from "@/lib/games/pokemon-games";
import { loadTwitchGuides } from "@/lib/games/guide-streams";
import { guideVideoAge, type GuideVideoSort, type GuideVideoDate } from "@/lib/games/guide-video-options";
import { GuideSourceRateLimit } from "@/lib/games/guide-source-status";
import type { GuideGame } from "./game-guides";
import { normalizeSteamGuideFilters, type SteamGuideFilters } from "@/lib/games/steam-guide-options";

export type GuideTab="written"|"videos"|"live"|"configs";
export type LiveProvider="all"|"youtube"|"kick"|"twitch";
type Result={total?:number;categories?:string[];twitchCursor?:string;twitchDone?:boolean;youtubeDone?:boolean;kickDone?:boolean;items:GameGuide[];page:number;cursor?:GuideVideoCursor;more:boolean;limit:number;at:number;partial:boolean};
const empty=():Result=>({items:[],page:0,more:true,limit:24,at:0,partial:false});
export function useGuideResults(game:GuideGame,active:boolean,tab:GuideTab,provider:LiveProvider,query:string,steamFilters:SteamGuideFilters,sort:GuideVideoSort="popular",date:GuideVideoDate="year") {
  const key=JSON.stringify([game.id,tab,tab==="live"?provider:"",query,tab==="written"?normalizeSteamGuideFilters(steamFilters):null,sort,tab==="videos"?date:""]);
  const cache=useRef(new Map<string,Result>()),[revision,render]=useState(0),[work,setWork]=useState({key:"",busy:false,error:false,retryAt:0});
  const wanted=useRef(24), refresh=useRef(false);
  const pokemon=pokemonEdition(game.name);
  const result=cache.current.get(key),requestable=tab!=="configs" && !(tab==="written"&&!game.steamId&&(!pokemon||pokemon.hack));
  useEffect(()=>{
    if(!active||!requestable)return;
    const held=cache.current.get(key);
    if(held && !refresh.current && held.limit>=wanted.current && (tab!=="live"||Date.now()-held.at<60_000))return;
    const controller=new AbortController(),reset=refresh.current||!!held&&tab==="live"&&Date.now()-held.at>=60_000;refresh.current=false;
    const target=held&&!reset?Math.max(24,wanted.current):24;wanted.current=24;
    setWork({key,busy:true,error:false,retryAt:0});
    void (async()=>{
      let next:Result=held&&!reset?{...held,items:[...held.items]}:empty();
      // Follow provider continuations to fill complete 24-card batches. A bounded
      // scan still exposes Load more if a search page contains few exact matches.
      for(let round=0;round<4 && next.more && next.items.length<target;round++){
        if(tab==="written"){
          const page=game.steamId?await loadSteamGuides(game.steamId,query,next.page+1,steamFilters,controller.signal):await loadPokemonGuides(game.name,query,controller.signal);
          next={...next,page:next.page+1,more:page.more,total:page.total??next.total,categories:page.categories.length?page.categories:next.categories,items:unique([...next.items,...page.items])};
        }else if(tab==="live"){
          const jobs: {source:"youtube"|"twitch"|"kick";request:Promise<{items:GameGuide[];cursor?:GuideVideoCursor|string}>}[]=[];
          if((provider==="all"||provider==="youtube")&&!next.youtubeDone)jobs.push({source:"youtube",request:loadGuideVideos(game.name,query,true,controller.signal,next.cursor,"popular","all")});
          if((provider==="all"||provider==="twitch")&&!next.twitchDone)jobs.push({source:"twitch",request:loadTwitchGuides(game.name,controller.signal,next.twitchCursor)});
          if((provider==="all"||provider==="kick")&&!next.kickDone)jobs.push({source:"kick",request:loadKickGuides(game.name,query,controller.signal).then(items=>({items}))});
          const responses=await Promise.allSettled(jobs.map(job=>job.request));
          if(responses.length&&responses.every(value=>value.status==="rejected"))throw (responses[0] as PromiseRejectedResult).reason;
          const additions:GameGuide[]=[];
          responses.forEach((response,index)=>{
            const source=jobs[index].source,page=response.status==="fulfilled"?response.value:undefined;
            if(!page)next.partial=true;
            if(source==="youtube"){next.cursor=page?.cursor as GuideVideoCursor|undefined;next.youtubeDone=!next.cursor;}
            if(source==="twitch"){next.twitchCursor=page?.cursor as string|undefined;next.twitchDone=!next.twitchCursor;}
            if(source==="kick")next.kickDone=true;
            additions.push(...(page?.items??[]).filter(item=>!query||`${item.title} ${item.author}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
          });
          const combined=unique([...next.items,...additions]);
          // Keep the already displayed cards in place as ranked provider pages arrive.
          const shown=held&&!reset?held.limit:0;
          next={...next,page:next.page+1,items:[...combined.slice(0,shown),...combined.slice(shown).sort((a,b)=>(b.viewers??-1)-(a.viewers??-1))],more:((provider==="all"||provider==="youtube")&&!next.youtubeDone)||((provider==="all"||provider==="twitch")&&!next.twitchDone)};
        }else{
          const page=await loadGuideVideos(game.name,query,false,controller.signal,next.cursor,sort,date);
          const combined=unique([...next.items,...page.items]),shown=held&&!reset?held.limit:0;
          const ranked=sort!=="relevance"?[...combined.slice(0,shown),...combined.slice(shown).sort((a,b)=>sort==="popular"?(b.views??-1)-(a.views??-1):guideVideoAge(a.published)-guideVideoAge(b.published))]:combined;
          next={...next,page:next.page+1,items:ranked,cursor:page.cursor,more:!!page.cursor};
        }
      }
      controller.signal.throwIfAborted();
      cache.current.set(key,{...next,limit:target,at:Date.now()});
      // Keep tab/search return state without an unbounded session cache.
      while(cache.current.size>12)cache.current.delete(cache.current.keys().next().value!);
      setWork({key,busy:false,error:false,retryAt:0});
    })().catch(error=>{if(!controller.signal.aborted)setWork({key,busy:false,error:true,retryAt:error instanceof GuideSourceRateLimit?error.retryAt:0});});
    return()=>{controller.abort();setWork(current=>current.key===key&&current.busy?{...current,busy:false}:current);};
  },[active,key,revision,requestable]);
  return {
    total:result?.total,categories:result?.categories,
    items:tab==="live"&&sort==="relevance"?[...(result?.items.slice(0,result.limit)??[])].sort((a,b)=>a.author.localeCompare(b.author)):result?.items.slice(0,result.limit)??[],busy:requestable&&(!result&&work.key!==key||work.key===key&&work.busy),
    error:work.key===key&&work.error,retryAt:work.key===key?work.retryAt:0,partial:result?.partial??false,
    more:!!result&&(result.more||result.items.length>result.limit),
    loadMore:()=>{wanted.current=(result?.limit??0)+24;render(n=>n+1);},
    retry:()=>{refresh.current=true;render(n=>n+1);},
  };
}
function unique(items:GameGuide[]) { const seen=new Set<string>();return items.filter(item=>{const key=`${item.source}:${item.id}`;if(seen.has(key))return false;seen.add(key);return true;}); }
