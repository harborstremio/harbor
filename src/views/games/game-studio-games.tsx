import { GameAvailabilityCover } from "./game-availability";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NavChevron } from "@/components/nav-arrow";
import { useT } from "@/lib/i18n";
import { loadAtlasPage } from "@/lib/games/atlas";
import { DEFAULT_ATLAS_FILTERS, type AtlasGame } from "@/lib/games/igdb-data";
import { studioShowcaseGames, type StudioProfile } from "@/lib/games/studio-data";
import type { GameSummary } from "@/lib/games/types";

import { GameCatalogRating } from "./game-discovery-ratings";
import { GamePosterSave } from "./game-poster-save";

function useStudioShelfSlots() {
  const root=useRef<HTMLDivElement>(null),[slots,setSlots]=useState(4);
  useLayoutEffect(()=>{const el=root.current;if(!el)return;const measure=()=>setSlots(Math.max(2,Math.min(6,Math.floor((el.clientWidth+16)/158))));measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[]);
  return [root,slots] as const;
}

export function GameStudioShelfSkeleton() {
  const [root,slots]=useStudioShelfSlots();
  return <div ref={root} className="games-studio-shelf-skeleton" style={{gridTemplateColumns:`repeat(${slots},minmax(0,1fr))`}} aria-hidden="true">{Array.from({length:slots},(_,index)=><div key={index}/>)}</div>;
}

export function GameStudioGames({profile,open,active}:{profile:StudioProfile;open:(game:GameSummary)=>void;active:boolean}) {
  const t=useT(),[root,slots]=useStudioShelfSlots();
  const [page,setPage]=useState(0),[extra,setExtra]=useState<AtlasGame[]>([]),[offset,setOffset]=useState<number|null>(0),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
  const request=useRef<AbortController|null>(null);
  const games=useMemo(()=>{const lead=studioShowcaseGames(profile.games);return [...new Map([...lead,...profile.games,...extra].map(game=>[game.id,game])).values()];},[profile.games,extra]);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{if(!active){request.current?.abort();setLoading(false);}},[active]);
  const current=Math.min(page,Math.max(0,Math.ceil(games.length/slots)-1));
  const next=async()=>{
    if(loading)return;
    if((current+1)*slots<games.length){setPage(current+1);return;}
    if(offset===null)return;
    const controller=new AbortController();request.current=controller;setLoading(true);setFailed(false);
    try {
      const additions:AtlasGame[]=[],known=new Set(games.map(game=>game.id));let cursor:number|null=offset;
      // Profile's representative spread overlaps the catalog. Skip duplicates
      // until the next row is filled; every request still uses the shared pool.
      while(cursor!==null&&additions.length<slots){
        const result=await loadAtlasPage({kind:"company",id:profile.id,name:profile.name,includeSubsidiaries:true},DEFAULT_ATLAS_FILTERS,cursor,controller.signal);
        controller.signal.throwIfAborted();cursor=result.nextOffset;
        for(const game of result.games)if(!known.has(game.id)){known.add(game.id);additions.push(game);}
      }
      if(!controller.signal.aborted){setOffset(cursor);setExtra(old=>[...old,...additions]);if(additions.length)setPage(current+1);}
    } catch { if(!controller.signal.aborted)setFailed(true); }
    finally {if(request.current===controller){request.current=null;setLoading(false);}}
  };
  const visible=games.slice(current*slots,(current+1)*slots),canNext=(current+1)*slots<games.length||offset!==null;
  return <div className="games-studio-game-shelf" ref={root} aria-busy={loading}>
    <div className="games-studio-game-navigation"><span aria-live="polite">{t("games.discovery.studioRange",{start:current*slots+1,end:current*slots+visible.length})}</span><div className="games-page-controls"><button className="games-icon-button" aria-label={t("games.discovery.studioPrevious")} disabled={!current||loading} onClick={()=>setPage(current-1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" aria-label={t("games.discovery.studioNext")} disabled={!canNext||loading} onClick={()=>void next()}><NavChevron dir="right" size={18}/></button></div></div>
    <div className={`games-studio-games${loading?" is-loading":""}`} key={`${current}-${slots}`} style={{gridTemplateColumns:`repeat(${slots},minmax(0,1fr))`}}>{visible.map(game=><article className="games-studio-game-card games-save-card" key={game.id}><button className="games-studio-game-open" onClick={()=>open(game)}><GameAvailabilityCover game={game} src={game.portrait??game.capsule} fallback={game.capsule}/><strong>{game.name}</strong></button><GamePosterSave game={game}/><GameCatalogRating score={game.rating} count={game.ratingCount} open={()=>open(game)}/></article>)}</div>
    {loading&&<span className="games-studio-page-status" role="status">{t("games.discovery.studioLoading")}</span>}
    {failed&&<div className="games-studio-page-status" role="alert"><span>{t("games.studios.error")}</span><button onClick={()=>void next()}>{t("common.retry")}</button></div>}
  </div>;
}
