import { useEffect, useRef, useState } from "react";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useInViewport, observeWithin } from "@/lib/visibility";
import { loadExploreStories } from "@/lib/games/explore-stories-fetch";
import { adaptationWikipediaUrl } from "@/lib/games/explore-stories";
import { visibleGameMedia, type GameMediaTarget } from "@/lib/games/cross-media";
import { GameStoryCard } from "./game-story-card";
import { usePagedGameRow } from "./use-paged-game-row";
import "./game-cross-media.css";
import "./game-rails.css";

function StorySkeleton(){return <div className="games-world-placeholder" aria-hidden="true"><i/><b/><span/></div>;}
function StoryContinuation({active,busy,cursor,more}:{active:boolean;busy:boolean;cursor:number;more:()=>void}) {
  const root=useRef<HTMLDivElement>(null),visible=useInViewport(root);
  useEffect(()=>{if(active&&visible&&!busy)more();},[active,visible,busy,cursor,more]);
  return <div ref={root}><StorySkeleton/></div>;
}
export function GameStoryFeature({openMedia,active}:{openMedia?:(target:GameMediaTarget)=>void;active:boolean}) {
  const t=useT(),root=useRef<HTMLElement>(null),[seen,setSeen]=useState(false),[kind,setKind]=useState("all");
  const {settings}=useSettings(),hideAdult=settings.hideContent.adult;
  useEffect(()=>{const node=root.current;if(!node)return;return observeWithin(node, "350px", entry => { if (entry.isIntersecting) setSeen(true); });},[]);
  const row=usePagedGameRow({id:`explore:adaptations:${kind}:${hideAdult}`,active:active&&seen,load:async(offset,signal)=>{
    const page=await loadExploreStories(offset,signal);
    const visible=new Set(visibleGameMedia(page.games,hideAdult).map(item=>item.qid));
    return {...page,games:page.games.filter(item=>visible.has(item.qid)&&(kind==="all"||item.kind===kind))};
  }});
  const more=()=>{if(row.loaded&&!row.busy&&!row.failed&&row.nextOffset!==null)void row.more(row.games.length+12);};
  return <section className="games-section games-inset games-connected-shelf" ref={root}>
    <div className="games-section-heading"><div><h2>{t("games.editorial.connected")}</h2><p>{t("games.media.exploreNote")}</p></div><div className="games-media-filters" role="group" aria-label={t("games.media.filter")}>{["all","movie","series"].map(value=><button key={value} aria-pressed={kind===value} onClick={()=>setKind(value)}>{t(`games.media.${value}`)}</button>)}</div></div>
    <Row key={row.key} className="games-content-rail" min={144} shape="portrait" arrowsAlways scrollKey={row.key} onEndReached={more}>
      {row.games.map((item,index)=><GameStoryCard key={item.qid} item={item} index={index} active={active} open={openMedia} evidence={{url:adaptationWikipediaUrl(item.wikipediaTitle),label:"Wikipedia"}}/>)}
      {!row.loaded&&!row.failed&&Array.from({length:6},(_,index)=><StorySkeleton key={index}/>)}
      {row.loaded&&row.nextOffset!==null&&!row.failed&&<StoryContinuation active={active} busy={row.busy} cursor={row.nextOffset} more={more}/>}
    </Row>
    {row.failed&&<div className="games-inline-status" role="alert"><span>{t("games.media.error")}</span><button className="games-button" onClick={row.retry}>{t("common.retry")}</button></div>}
    {row.loaded&&!row.games.length&&row.nextOffset===null&&!row.failed&&<p className="games-inline-status">{t("games.noResults")}</p>}
  </section>;
}
