import { GameAvailabilityCover } from "./game-availability";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Pause } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { loadGameFranchise, loadGameWorlds, type GameFranchise } from "@/lib/games/franchises";
import { prepareGameWorld, type PreparedWorld } from "@/lib/games/prepare-world";
import { uniqueGameWorlds } from "@/lib/games/franchise-data";
import { useInViewport, usePageVisible, observeWithin } from "@/lib/visibility";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import type { AtlasRoute } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GamePosterSave } from "./game-poster-save";
import { GameArt } from "./game-art";
import { GameCatalogRating } from "./game-discovery-ratings";
import { GameDataStatus } from "./game-data-status";
import { usePagedGameRow } from "./use-paged-game-row";
import "./game-franchise-worlds.css";
import "./game-rails.css";

function WorldMark({name}:{name:string}) {
  return <span className="games-world-wordmark">{name}</span>;
}
function WorldMemberSkeleton(){return <div className="games-world-placeholder" aria-hidden="true"><i/><b/><span/><small/></div>;}
function WorldPickerSkeleton(){return <div className="games-world-picker-placeholder games-skeleton" aria-hidden="true"/>;}
function WorldContinuation({active,busy,failed,cursor,more}:{active:boolean;busy:boolean;failed:boolean;cursor:number;more:()=>void}) {
  const ref=useRef<HTMLDivElement>(null),visible=useInViewport(ref);
  // Recheck when a duplicate-only page advances without changing the rail's size.
  useEffect(()=>{if(active&&visible&&!busy&&!failed)more();},[active,visible,busy,failed,cursor,more]);
  return <div ref={ref}><WorldPickerSkeleton/></div>;
}
function rememberWorld(cache:Map<string,PreparedWorld>,value:PreparedWorld) {
  cache.delete(value.world.id);cache.set(value.world.id,value);
  if(cache.size>12)cache.delete(cache.keys().next().value!);
}

export function GameFranchiseWorlds({active,open,browse}:{active:boolean;open:(game:GameSummary)=>void;browse:(route:AtlasRoute)=>void}) {
  const t=useT(),root=useRef<HTMLElement>(null);
  const [near,setNear]=useState(false),[selected,setSelected]=useState<string>();
  const [displayed,setDisplayed]=useState<PreparedWorld & {previous?:GameFranchise}>(),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[paused,setPaused]=useState(false);
  const prepared=useRef(new Map<string,PreparedWorld>()),[prepareFailed,setPrepareFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const visible=useInViewport(root),pageVisible=usePageVisible(),reduced=useReducedMotion();
  useEffect(()=>{const node=root.current;if(!node)return;return observeWithin(node,"500px",entry=>{if(entry.isIntersecting)setNear(true);});},[]);
  const worlds=usePagedGameRow({id:"franchise-worlds",active:active&&near,load:loadGameWorlds});
  const choices=useMemo(()=>uniqueGameWorlds(worlds.games),[worlds.games]);
  useEffect(()=>{
    // Extend the fast editorial snapshot once the section is actually on screen.
    if(active&&visible&&worlds.loaded&&!worlds.busy&&!worlds.failed&&worlds.nextOffset===1)void worlds.more(worlds.games.length+10);
  },[active,visible,worlds.loaded,worlds.busy,worlds.failed,worlds.nextOffset]);
  const target=choices.find(item=>item.id===selected)??choices[0],world=displayed?.world;
  const slots=()=>Math.max(1,Math.floor(((root.current?.clientWidth??1280)+20)/164));
  useEffect(()=>{
    if(!active||!target)return;
    const request=new AbortController();setPrepareFailed(false);
    const held=prepared.current.get(target.id);
    void (held?Promise.resolve(held):prepareGameWorld(target,slots(),request.signal)).then(next=>{
      if(request.signal.aborted)return;
      rememberWorld(prepared.current,next);
      setDisplayed(previous=>({...next,previous:previous?.world.id!==target.id?previous?.world:undefined}));
    },()=>{if(!request.signal.aborted)setPrepareFailed(true);});
    return()=>request.abort();
  },[active,target?.id,target?.hero,attempt]);
  useEffect(()=>{
    if(!active||!visible||!pageVisible||!world||world.id!==target?.id)return;
    const next=choices[(choices.findIndex(item=>item.id===world.id)+1)%choices.length];
    const request=new AbortController();
    const timer=setTimeout(()=>{if(next&&next.id!==world.id&&!prepared.current.has(next.id))void prepareGameWorld(next,slots(),request.signal).then(value=>{if(!request.signal.aborted)rememberWorld(prepared.current,value);},()=>{});},900);
    return()=>{clearTimeout(timer);request.abort();};
  },[active,visible,pageVisible,world?.id,target?.id,choices]);
  useEffect(()=>{
    if(!active||!visible||!pageVisible||hovered||focused||paused||reduced||!world||world.id!==target?.id||worlds.games.length<2)return;
    const timer=setTimeout(()=>setSelected(choices[(choices.findIndex(item=>item.id===world.id)+1)%choices.length].id),10000);
    return()=>clearTimeout(timer);
  },[active,visible,pageVisible,hovered,focused,paused,reduced,world?.id,target?.id,choices]);
  const members=usePagedGameRow({id:world?.id??"none",active:active&&near&&!!world,load:(offset,signal)=>offset===0&&displayed?Promise.resolve(displayed.page):loadGameFranchise(world!.id,offset,signal)});
  const memberGames=members.loaded?members.games:displayed?.page.games??[];
  return <section className="games-section games-inset games-franchise-worlds" ref={root} onPointerEnter={event=>{if(event.pointerType!=="touch")setHovered(true)}} onPointerLeave={()=>setHovered(false)} onFocus={()=>setFocused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false)}}>
    <div className="games-section-heading"><div><h2>{t("games.discovery.worldsTitle")}</h2><p>{t("games.discovery.worldsNote")}</p></div>{worlds.games.length>1&&!reduced&&<button className="games-icon-button" aria-label={t(paused?"games.discovery.resumeWorlds":"games.discovery.pauseWorlds")} title={t(paused?"games.discovery.resumeWorlds":"games.discovery.pauseWorlds")} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button>}</div>
    <Row className="games-world-picker games-content-rail" min={160} shape="landscape" arrowsAlways scrollKey="games:worlds" onEndReached={()=>{if(!worlds.busy&&!worlds.failed&&worlds.nextOffset!==null)void worlds.more(worlds.games.length+10);}}>
      {[
        ...choices.map(item=><button className="games-world-choice" key={item.id} aria-pressed={target?.id===item.id} aria-label={item.name} onClick={()=>setSelected(item.id)}><GameArt className="games-world-picker-art" src={item.hero}/><WorldMark name={item.name}/></button>),
        ...(!worlds.loaded?Array.from({length:5},(_,i)=><WorldPickerSkeleton key={`skeleton:${i}`}/>):[]),
        ...(worlds.loaded&&worlds.nextOffset!==null&&!worlds.failed?[<WorldContinuation key="more" active={active&&visible} busy={worlds.busy} failed={worlds.failed} cursor={worlds.nextOffset} more={()=>{void worlds.more(worlds.games.length+10);}}/>]:[]),
      ]}
    </Row>
    {world?<div className="games-world-stage" aria-busy={target?.id!==world.id}>{displayed?.previous&&<img className="games-world-art is-previous" src={displayed.previous.hero} alt=""/>}<GameArt key={world.id} className="games-world-art" src={world.hero} eager/><div className="games-world-shade"/>{displayed?.previous&&<div className="games-world-copy is-previous" aria-hidden="true"><h3><WorldMark name={displayed.previous.name}/></h3><span className="games-feature-link">{t("games.discovery.exploreWorld")}</span></div>}<div className="games-world-copy" key={`copy:${world.id}`}><h3><WorldMark name={world.name}/></h3><button className="games-feature-link" onClick={()=>browse(world.route)}>{t("games.discovery.exploreWorld")}</button></div><button className="games-world-feature" onClick={()=>open(world.featuredGame)}>{world.featuredGame.name}</button>{target?.id!==world.id&&!prepareFailed&&<span className="games-world-loading" role="status" aria-label={t("games.atlas.loading")}><LoaderCircle size={18}/></span>}</div>:<div className="games-world-stage games-world-stage-placeholder"><div className="games-world-copy" aria-hidden="true"><i/><b/><i/></div></div>}
    <Row className="games-world-members games-content-rail" key={members.key} min={144} shape="portrait" arrowsAlways scrollKey={`games:world:${members.key}`} onEndReached={()=>{if(!members.busy&&!members.failed&&members.nextOffset!==null)void members.more(members.games.length+12);}}>
      {memberGames.map(game=><div className="games-save-card" key={game.id}><button className="games-world-member" data-game={game.id} onClick={()=>open(game)}><GameAvailabilityCover game={game} src={game.portrait??game.capsule} fallback={game.capsule}/><strong>{game.name}</strong><span>{game.release&&<time>{new Date(game.release*1000).getUTCFullYear()}</time>}{[5,8,9,11].includes(game.gameType??-1)&&<span>{t("games.discovery.gameType."+game.gameType)}</span>}</span><small>{game.platforms.slice(0,2).join(" · ")}{game.platforms.length>2?" +"+(game.platforms.length-2):""}</small></button><GamePosterSave game={game}/><GameCatalogRating score={game.rating} count={game.ratingCount} open={()=>open(game)}/></div>)}
      {!memberGames.length&&!members.loaded&&!members.failed&&Array.from({length:6},(_,i)=><WorldMemberSkeleton key={i}/>)}
    </Row>
    {(worlds.failed||members.failed||prepareFailed)&&<div className="games-inline-status" role="alert"><span>{t("games.atlas.error")}</span><button className="games-button" onClick={()=>prepareFailed?setAttempt(n=>n+1):worlds.failed?worlds.retry():members.retry()}>{t("common.retry")}</button></div>}
    {world&&members.loaded&&!members.games.length&&!members.failed&&<p className="games-inline-status">{t("games.noResults")}</p>}
    <div className="games-world-footer"><GameDataStatus at={world?.cachedAt??members.cachedAt} busy={worlds.busy||members.busy}/></div>
  </section>;
}
