import { useEffect, useRef, useState } from "react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import { loadGameDetail } from "@/lib/games/catalog";
import type { GameDetail, GameSummary } from "@/lib/games/types";

/* ANIMATION STORYBOARD
 *   0ms  New identity: reserve the summary and all three screenshot slots.
 * 120ms  Hover intent settles; request only this game's detail.
 * ready  Metadata fades in. Each decoded image fades over its own skeleton.
 *        Reduced motion removes fades and skeleton motion, never the slots.
 */
const HOVER_INTENT_MS=120;
function ChartScreenshot({src,pending,index}:{src?:string;pending:boolean;index:number}) {
  const ref=useRef<HTMLImageElement>(null),[phase,setPhase]=useState<"loading"|"ready"|"failed">("loading");
  useEffect(()=>{
    if(!src)return;
    const timer=setTimeout(()=>setPhase(value=>value==="loading"?"failed":value),12000);
    return()=>clearTimeout(timer);
  },[src]);
  const reveal=async()=>{const img=ref.current;if(!img)return;try{await img.decode();}catch{/* A completed image may not need another decode. */}if(ref.current===img&&img.naturalWidth>0)setPhase("ready");};
  return <div className="games-chart-frame" data-phase={phase} data-pending={pending||!!src&&phase==="loading"}>
    {(pending||!!src)&&<span className="games-chart-image-skeleton games-skeleton" aria-hidden="true"/>}
    {src&&phase!=="failed"&&<img ref={ref} src={src} alt="" decoding="async" loading={index===0?"eager":"lazy"} onLoad={()=>void reveal()} onError={()=>setPhase("failed")}/>}
  </div>;
}

export function GameChartPreview({game,active,open}:{game:GameSummary;active:boolean;open:(game:GameSummary)=>void}) {
  const t=useT(),[state,setState]=useState<{phase:"loading"|"ready"|"failed";detail?:GameDetail}>({phase:"loading"}),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!active)return;
    let current=true;setState({phase:"loading"});
    if(!game.steamId){setState({phase:"ready"});return;}
    const timer=setTimeout(()=>void loadGameDetail(game.steamId!).then(detail=>{if(current)setState({phase:"ready",detail});},()=>{if(current)setState({phase:"failed"});}),HOVER_INTENT_MS);
    return()=>{current=false;clearTimeout(timer);};
  },[game.steamId,active,attempt]);
  const {detail,phase}=state,pending=phase==="loading",screens=detail?.screenshots.slice(0,3)??[];
  return <aside className="games-chart-preview" aria-label={game.name} aria-busy={pending}>
    <div className="games-chart-summary" data-phase={phase}>
      <h3>{game.name}</h3><span>{detail?.developers.join(" · ")||game.platforms.join(" · ")}</span>
      {pending?<div className="games-chart-text-skeleton" aria-hidden="true"><i className="games-skeleton"/><i className="games-skeleton"/><i className="games-skeleton"/></div>:<p>{detail?.description}</p>}
      <div className="games-chart-genres">{pending?<><i className="games-skeleton"/><i className="games-skeleton"/></>:detail?.genres.slice(0,4).map(genre=><span key={genre}>{genre}</span>)}</div>
      <button className="games-text-action" onClick={()=>open(game)}><Play size={14}/>{t("games.discovery.viewGame")}</button>
    </div>
    <div className="games-chart-screens">{[0,1,2].map(index=>{const src=screens[index],image=src?(detail?.screenshotThumbnails?.[src]??src):!pending&&index===0?game.capsule:undefined;return <ChartScreenshot key={`${index}:${image??"pending"}`} src={image} index={index} pending={pending}/>;})}</div>
    {phase==="failed"&&<div className="games-inline-status" role="alert"><span>{t("games.charts.error")}</span><button onClick={()=>setAttempt(n=>n+1)}>{t("common.retry")}</button></div>}
  </aside>;
}
