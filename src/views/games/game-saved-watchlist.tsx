import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT, useUiLanguage } from "@/lib/i18n";
import { savedReleaseGames, savedReleaseState, type SavedReleaseFilter, type SavedReleaseSort } from "@/lib/games/saved-releases";
import type { SavedReleaseRequest } from "@/lib/games/saved-releases-load";
import type { GameSummary } from "@/lib/games/types";
import type { GameSource } from "@/lib/games/sources";
import { GameArt } from "./game-art";
import { GameSourceIcon } from "./game-source-icon";
import { useSavedGameReleases } from "./use-saved-game-releases";
import "./game-saved-watchlist.css";

export function GameSavedWatchlist({games,query,active,open,save,request,sources=[]}:{games:GameSummary[];query:string;active:boolean;open:(game:GameSummary,origin?:HTMLElement)=>void;save:(game:GameSummary)=>void;request?:SavedReleaseRequest;sources?:readonly Pick<GameSource,"id"|"url"|"name"|"homepage"|"icon">[]}) {
  const t=useT(),language=useUiLanguage(),root=useRef<HTMLElement>(null),refreshButton=useRef<HTMLButtonElement>(null),removed=useRef<{id:string;index:number}|null>(null);
  const {results,loading,pending,membership,checked,failed,retry,more}=useSavedGameReleases(games,active,request);
  const [filter,setFilter]=useState<SavedReleaseFilter>("all"),[sort,setSort]=useState<SavedReleaseSort>("recent");
  useLayoutEffect(()=>{
    const target=removed.current;if(!target||games.some(game=>game.id===target.id))return;
    removed.current=null;
    const rows=root.current?.querySelectorAll<HTMLButtonElement>(".games-watchlist-open");
    (rows?.[Math.min(target.index,rows.length-1)]??root.current?.querySelector<HTMLElement>("h2"))?.focus({preventScroll:true});
  },[membership]);
  const shown=savedReleaseGames(games,results,query,filter,sort);
  const filters:SavedReleaseFilter[]=["all","upcoming","released","unknown",...(filter==="cancelled"||games.some(game=>savedReleaseState(results[game.id]?.info).status==="cancelled")?["cancelled" as const]:[])];
  return <section ref={root} className="games-results games-inset games-watchlist">
    <div className="games-section-heading"><div><h2 tabIndex={-1}>{t("games.saved")}</h2><p>{t("games.watchlist.note")}</p></div>{!!games.length&&<HoverTooltip label={t("games.watchlist.refresh")}><button ref={refreshButton} className="games-icon-button" aria-label={t("games.watchlist.refresh")} aria-disabled={loading} onClick={()=>{if(!loading)retry();}}><RefreshCw size={18} className={loading?"is-scanning":""}/></button></HoverTooltip>}</div>
    {!!games.length&&<><div className="games-watchlist-tools"><div className="games-watchlist-filters" role="group" aria-label={t("games.saved")}>{filters.map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{t(`games.watchlist.${value}`)}<span>{savedReleaseGames(games,results,query,value,"recent").length.toLocaleString(language)}</span></button>)}</div><Dropdown value={sort} onChange={value=>setSort(value as SavedReleaseSort)} size="sm" ariaLabel={t("games.watchlist.sort")} options={(["recent","next","name"] as const).map(value=>({value,label:t(`games.watchlist.${value}`)}))}/></div>
      <p className="games-watchlist-note">{t("games.watchlist.dateNote")}</p>
      <div className="games-watchlist-progress"><span role="status">{t(loading?"games.watchlist.checking":"games.watchlist.coverage",{count:checked.toLocaleString(language),total:games.length.toLocaleString(language)})}</span>{checked<games.length&&<button className="games-text-action" aria-disabled={loading} onClick={()=>{if(loading)return;refreshButton.current?.focus({preventScroll:true});more();}}>{t("games.watchlist.checkMore")}</button>}</div>
      {failed&&<div className="games-watchlist-error" role="status"><span>{t("games.watchlist.partial")}</span><button className="games-text-action" aria-disabled={loading} onClick={()=>{if(!loading){refreshButton.current?.focus({preventScroll:true});retry();}}}>{t("common.retry")}</button></div>}
    </>}
    {shown.length?<div className="games-watchlist-rows">{shown.map((game,index)=>{
      const result=results[game.id],info=result?.info,state=savedReleaseState(info),release=state.release;
      const origin=game.sourceOrigin,source=origin?sources.find(source=>source.id===origin.sourceId&&source.url===origin.sourceUrl):undefined;
      const sourceName=source?.name??game.sourceListing?.sourceName;
      const label=release?.window?.precision==="day"?new Date(release.window.start).toLocaleDateString(language,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}):release?.label;
      return <article key={game.id} data-saved-game={game.id} className="games-watchlist-row">
        <button className="games-watchlist-open" data-game={game.id} onClick={event=>open(game,event.currentTarget)}>
          <div className="games-watchlist-art"><GameArt src={game.capsule}/><ArrowUpRight size={20}/></div>
          <div className="games-watchlist-game"><h3 dir="auto">{game.name}</h3><p>{game.platforms.join(" · ")}</p>{sourceName&&<div className="games-watchlist-source"><GameSourceIcon name={sourceName} url={source?.url??origin?.sourceUrl??game.sourceListing?.page} homepage={source?.homepage} icon={source?.icon}/><span>{sourceName}</span>{origin?.title&&origin.title!==game.name&&<small title={origin.title} dir="auto">{origin.title}</small>}</div>}</div>
          <div className="games-watchlist-date" data-status={state.status}><span>{!result?t(pending.includes(game.id)?"games.watchlist.checking":"games.watchlist.unknown"):result.failed&&!info?t("games.watchlist.unavailable"):t(state.status==="released"?"games.watchlist.released":`games.watchlist.${state.status}`)}</span><strong dir="auto">{label||"—"}</strong>{info&&<small className="games-watchlist-provider"><i aria-hidden="true" style={{maskImage:`url(/games/brands/${info.source.toLowerCase()}.svg)`}}/><span>{info.source}{release?.platform?` · ${release.platform}`:""}{release?.region?` · ${release.region.replace(/_/g," ")}`:""}</span></small>}{(info?.cachedAt!==undefined||result?.failed&&info)&&<em>{t("games.watchlist.saved")}</em>}</div>
        </button>
        <HoverTooltip label={t("games.watchlist.remove",{name:game.name})}><button className="games-icon-button games-watchlist-save" aria-pressed="true" aria-label={t("games.watchlist.remove",{name:game.name})} onClick={()=>{removed.current={id:game.id,index};save(game);}}><MusicGlyph name="heart-filled" size={19}/></button></HoverTooltip>
      </article>;
    })}</div>:<div className="games-state"><MusicGlyph name="heart" size={30}/><h3>{t(!games.length?"games.savedEmpty":query?"games.noResults":"games.watchlist.noMatch")}</h3><p>{t(!games.length?"games.savedEmptyNote":"games.trySearch")}</p></div>}
  </section>;
}
