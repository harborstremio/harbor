import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Gamepad2, Route } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { queryIgdb } from "@/lib/games/atlas";
import { ATLAS_SUMMARY_FIELDS, parseAtlasGame, type AtlasGame } from "@/lib/games/igdb-data";
import { initialOrderBranch, playOrderDefinition, orderedGames, playOrderFamily, type PlayOrderBranch } from "@/lib/games/play-orders";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
export function GamePlayOrder({game,active,openGame}:{game:AtlasGame;active:boolean;openGame:(game:GameSummary)=>void}) {
  const t=useT(), id=useId(), trigger=useRef<HTMLButtonElement>(null), [expanded,setExpanded]=useState(false), [visited,setVisited]=useState(false);
  const family=playOrderFamily(game);
  useEffect(()=>{if(!active)setExpanded(false);},[active]);
  if(!family)return null;
  return <><button ref={trigger} id={`${id}-trigger`} className="games-story-entry" aria-expanded={expanded} aria-controls={`${id}-panel`} onClick={()=>{setVisited(true);setExpanded(value=>!value);}}><Route size={23}/><span><strong>{t("games.order.title")}</strong><small>{playOrderDefinition(family).name} · {t("games.order.entry")}</small></span><ChevronDown className="games-story-chevron" size={22}/></button><section className="games-story-panel" id={`${id}-panel`} aria-labelledby={`${id}-trigger`} hidden={!expanded}>{visited&&active&&<PlayOrderContent key={`${family}:${game.igdbId}`} game={game} family={family} openGame={target=>{trigger.current?.focus({preventScroll:true});setExpanded(false);openGame(target);}}/>}</section></>;
}
function PlayOrderContent({game,family,openGame}:{game:AtlasGame;family:string;openGame:(game:GameSummary)=>void}) {
  const t=useT(), [branchKey,setBranchKey]=useState(()=>initialOrderBranch(family,game)), [order,setOrder]=useState<"release"|"story">("release");
  const definition=playOrderDefinition(family), branch=definition.branches.find(item=>item.key===branchKey)??definition.branches[0];
  const canOrder=branch.storyOrder ?? (family==="metal-gear");
  return <><div className="games-story-panel-content"><p className="games-story-note">{t(`games.order.${definition.note}`)}</p><div className="games-story-filters">{definition.branches.length>1&&<Dropdown ariaLabel={t("games.order.series")} value={branchKey} onChange={key=>{setBranchKey(key);setOrder("release");}} options={definition.branches.map(item=>({value:item.key,label:item.name}))}/>} {canOrder&&(["release","story"] as const).map(value=><button key={value} aria-pressed={order===value} onClick={()=>setOrder(value)}>{t(`games.order.${value}`)}</button>)}</div><OrderEntries key={branch.key} branch={branch} order={canOrder?order:"release"} current={game.igdbId} openGame={openGame}/></div><footer><a href={branch.source} onClick={event=>{event.preventDefault();void openUrl(branch.source);}}>{definition.publisher} · {t("games.order.source")}</a></footer></>;
}
function OrderEntries({branch,order,current,openGame}:{branch:PlayOrderBranch;order:"release"|"story";current:number;openGame:(game:GameSummary)=>void}) {
  const t=useT(), [games,setGames]=useState<AtlasGame[]>([]), [pending,setPending]=useState(true), [failed,setFailed]=useState(false), [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const request=new AbortController(),ids=branch.entries.flatMap(entry=>entry.editions.map(edition=>edition.id));setPending(true);setFailed(false);
    void queryIgdb(`fields ${ATLAS_SUMMARY_FIELDS}; where id = (${ids.join(",")}); limit 50;`,request.signal).then(rows=>{if(!request.signal.aborted)setGames(rows.map(parseAtlasGame).filter(game=>ids.includes(game.igdbId)));},()=>{if(!request.signal.aborted)setFailed(true);}).finally(()=>{if(!request.signal.aborted)setPending(false);});return()=>request.abort();
  },[branch,attempt]);
  const lookup=(edition:{id:number;name:string}):GameSummary=>games.find(game=>game.igdbId===edition.id)??{id:`igdb:${edition.id}`,igdbId:edition.id,name:edition.name,capsule:"",platforms:[]};
  return <>{failed&&<div className="games-story-error" role="status">{t("games.story.error")} <button onClick={()=>setAttempt(value=>value+1)}>{t("common.retry")}</button></div>}<ol className="games-story-list" aria-busy={pending}>{orderedGames(branch,order).map((entry,index)=>{
    const currentEdition=entry.editions.find(edition=>edition.id===current),target=lookup(currentEdition??entry.editions[0]);
    return <li key={entry.editions[0].id} data-current={!!currentEdition}><time><b>{String(index+1).padStart(2,"0")}</b>{order==="story"?(entry.storyYear?` · ${entry.storyYear}${entry.storyEndYear?`–${entry.storyEndYear}`:""}`:""):` · ${entry.year}`}</time><div className="games-story-item"><button className="games-story-open" onClick={()=>openGame(target)}><span className="games-story-art">{pending?<i className="games-skeleton"/>:<><Gamepad2 size={20}/><GameArt src={target.portrait??target.capsule}/></>}</span><span><strong>{entry.name}</strong><small>{currentEdition&&<b>{t("games.order.current")}</b>}</small></span></button>{entry.editions.length>1&&<details className="games-order-editions"><summary>{t("games.order.versions")}</summary>{entry.editions.filter((edition,index,list)=>edition.id===current||(!list.some(other=>other.name===edition.name&&other.id===current)&&list.findIndex(other=>other.name===edition.name)===index)).map(edition=><button key={edition.id} onClick={()=>openGame(lookup(edition))}>{edition.name}{edition.id===current&&<span> · {t("games.order.current")}</span>}</button>)}</details>}</div></li>;
  })}</ol></>;
}
