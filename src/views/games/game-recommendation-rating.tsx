import { useEffect, useState } from "react";
import { loadGameHighlights } from "@/lib/games/catalog";
import { queryIgdb } from "@/lib/games/atlas";
import type { GameSummary } from "@/lib/games/types";
import type { SteamReviewSummary } from "@/lib/games/rating-data";
import { useT, useUiLanguage } from "@/lib/i18n";
import { HoverTooltip } from "@/components/hover-tooltip";
import { GameCatalogRating, RatingMark, scoreTone } from "./game-discovery-ratings";

type PosterRating = { steam?: SteamReviewSummary; score?: number; count: number };

/** Resolve added cards in batches of 24, with at most two requests in flight. */
export function useRecommendationRatings(games: GameSummary[], active: boolean, rememberUnrated = false) {
  const [ratings,setRatings]=useState<Record<string,PosterRating>>({});
  const identity=games.map(game=>`${game.id}:${game.steamId??""}:${game.igdbId??""}`).join(",");
  useEffect(()=>{
    if(!active||!games.length)return;
    const request=new AbortController(),timer=setTimeout(async()=>{
      const missing=games.filter(game=>!ratings[game.id]);
      for(let offset=0;offset<missing.length;offset+=24){
      if(request.signal.aborted)return;
      const batch=missing.slice(offset,offset+24);
      const steamIds=[...new Set(batch.flatMap(game=>game.steamId?[game.steamId]:[]))].slice(0,24);
      const atlasIds=[...new Set(batch.flatMap(game=>game.igdbId?[game.igdbId]:[]))].slice(0,24);
      const [steam,atlas]=await Promise.allSettled([
        loadGameHighlights(steamIds),
        atlasIds.length?queryIgdb(`fields name,total_rating,total_rating_count; where id = (${atlasIds.join(",")}); limit 24;`,request.signal):Promise.resolve([]),
      ]);
      if(request.signal.aborted)return;
      const next:Record<string,PosterRating>={};
      for(const game of batch){
        const reviews=steam.status==="fulfilled"?steam.value.find(item=>item.steamId===game.steamId)?.reviews:undefined;
        const row=atlas.status==="fulfilled"?atlas.value.find(item=>(item as {id?:number}).id===game.igdbId) as {total_rating?:number;total_rating_count?:number}|undefined:undefined;
        if(reviews)next[game.id]={steam:reviews,count:reviews.count};
        else if(row&&typeof row.total_rating==="number"&&Number.isFinite(row.total_rating)&&row.total_rating>=0&&row.total_rating<=100&&Number.isSafeInteger(row.total_rating_count)&&row.total_rating_count!>0)next[game.id]={score:row.total_rating,count:row.total_rating_count!};
        // Growing charts must not fetch every unrated upcoming game again on each append.
        else if(rememberUnrated&&steam.status==="fulfilled"&&atlas.status==="fulfilled")next[game.id]={count:0};
      }
      setRatings(previous=>({...previous,...next}));
      }
    },200);
    return()=>{clearTimeout(timer);request.abort();};
  },[identity,active,rememberUnrated]);
  return ratings;
}

export function RecommendationRating({rating,open}:{rating?:PosterRating;open:()=>void}) {
  const t=useT(),language=useUiLanguage();
  if(!rating)return null;
  if(!rating.steam)return <GameCatalogRating score={rating.score} count={rating.count} open={open}/>;
  const reviews=rating.steam,label=t("games.editorial.scoreNote",{score:reviews.positive,count:reviews.count.toLocaleString(language)});
  return <HoverTooltip className="games-studio-rating-tab" label={t("games.discovery.rating.steam")} sublabel={label} mark={<RatingMark source="steam"/>} arrow side="top"><button data-score-tone={scoreTone(reviews.positive)} aria-label={label} onClick={open}><strong>{reviews.positive}<small>%</small></strong></button></HoverTooltip>;
}

export function ForYouMark() {
  return <svg className="games-for-you-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M12 16.5 7.9 12.6a2.8 2.8 0 0 1 4.1-3.8 2.8 2.8 0 0 1 4.1 3.8Z"/></svg>;
}
