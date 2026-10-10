import { Play } from "@/components/icons/play-filled";
import { GameAvailabilityCover } from "./game-availability";
import { GameSkeleton } from "./game-loading";
import { useEffect, useRef, useState } from "react";
import { Pause } from "lucide-react";
import { useT } from "@/lib/i18n";
import { loadGameCatalog, loadGameDetail } from "@/lib/games/catalog";
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from "@/lib/games/catalog-filters";
import { gameSeason, seasonCatalog } from "@/lib/games/seasons";
import type { GameDetail, GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import { GameDataStatus } from "./game-data-status";
import { savedMetadataAt } from "@/lib/games/metadata-records";
import { useInViewport, usePageVisible, observeWithin } from "@/lib/visibility";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { GameHeroVideo } from "./game-hero-video";
import { GameDiscoveryRatings } from "./game-discovery-ratings";
import { Row } from "@/components/row";
import { decodeGameLogo, type GameLogoArt } from "@/lib/games/logo-art";
import { loadSteamHeroLogo } from "@/lib/games/hero-logo";

export function GameSeasonal({open,browse,active}:{open:(game:GameSummary)=>void;browse:(filters:Partial<CatalogFilters>,query?:string)=>void;active:boolean}) {
  const t=useT(),root=useRef<HTMLElement>(null),[seen,setSeen]=useState(false),[season,setSeason]=useState(gameSeason),[games,setGames]=useState<GameSummary[]>([]),[selected,setSelected]=useState(""),[detail,setDetail]=useState<GameDetail|null>(null),[loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const refresh=useLiveRefresh(active&&seen);
  const visible=useInViewport(root),pageVisible=usePageVisible(),reducedMotion=useReducedMotion();
  const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[preview,setPreview]=useState(false),[paused,setPaused]=useState(false),[started,setStarted]=useState(false);
  useEffect(()=>{const timer=setInterval(()=>setSeason(gameSeason()),60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{const el=root.current;if(!el)return;return observeWithin(el,"400px",entry=>{if(entry.isIntersecting)setSeen(true);});},[]);
  useEffect(()=>{if(!active||!seen)return;const request=new AbortController(),selection=seasonCatalog(season);setFailed(false);void loadGameCatalog(selection.query,{...DEFAULT_CATALOG_FILTERS,tags:selection.tags},0,request.signal).then(result=>{if(!request.signal.aborted){setGames(result.games.slice(0,12));setLoaded(true);}},()=>{if(!request.signal.aborted)setFailed(true);});return()=>request.abort();},[active,seen,season,attempt,refresh]);
  const game=games.find(game=>game.id===selected)??games[0];
  const currentDetail=detail?.steamId===game?.steamId?detail:null;
  const inspecting=active&&visible&&pageVisible&&(hovered||focused);
  useEffect(()=>{setPreview(false);if(!inspecting)return;const timer=setTimeout(()=>setPreview(true),250);return()=>clearTimeout(timer);},[inspecting,game?.id]);
  useEffect(()=>{setStarted(false);setPaused(false);},[game?.id]);
  useEffect(()=>{let current=true;setDetail(null);if(game?.steamId)void loadGameDetail(game.steamId).then(value=>{if(current)setDetail(value);},()=>{});return()=>{current=false;};},[game?.id]);
  const explore=()=>{const selection=seasonCatalog(season);browse({tags:selection.tags},selection.query);};
  return <section className={`games-section games-inset games-seasonal is-${season}`} ref={root}>
    <div className="games-season-event-frame"><div className={`games-season-event${preview?" is-inspecting":""}`} onPointerEnter={e=>{if(e.pointerType!=="touch")setHovered(true);}} onPointerLeave={()=>setHovered(false)} onFocus={()=>setFocused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}}>
      {game&&<div className="games-season-event-art"><GameArt key={game.id} src={currentDetail?.screenshots[0]??currentDetail?.libraryHero??game.capsule} fallback={game.capsule}/>{game.steamId&&<GameHeroVideo key={`${game.id}-video`} appId={game.steamId} playing={preview&&hovered&&!paused&&!reducedMotion} onPlaybackChange={playing=>{if(playing)setStarted(true);}}/>}</div>}
      <div className="games-season-event-shade" aria-hidden="true"/>
      <div className="games-season-event-intro">{season==="halloween"?<img className="games-season-tree" src="/spooktober/assets/art/foreground-tree.svg" alt="" aria-hidden="true"/>:<span className="games-season-label"><SeasonMark season={season}/><span>{t(`games.season.${season}.label`)}</span></span>}<div className="games-season-title"><h2>{t(season==="halloween"?"games.discovery.spooktober":`games.season.${season}.title`)}</h2>{season==="halloween"&&<div className="games-season-pumpkins" aria-hidden="true"><img src="/spooktober/assets/art/pumpkin-mischief.svg" alt=""/><img src="/spooktober/assets/art/pumpkin-grin.svg" alt=""/></div>}</div><p>{t(`games.season.${season}.note`)}</p><button className="games-season-explore games-feature-link" onClick={explore}>{t("games.explore")}</button></div>
      {started&&!reducedMotion&&<button className="games-season-preview-toggle" aria-label={t(paused?"games.discovery.previewPlay":"games.discovery.previewPause")} title={t(paused?"games.discovery.previewPlay":"games.discovery.previewPause")} onClick={()=>setPaused(value=>!value)}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>}
      {game?<div className="games-season-event-game" key={game.id}><span>{currentDetail?.genres.slice(0,2).join(" · ")??game.platforms.join(" · ")}</span><button className="games-season-game-link" aria-label={t("games.discovery.viewGame")+": "+game.name} onClick={()=>open(game)}><SeasonalGameLogo game={game} detail={currentDetail} active={active&&visible}/></button><div className="games-season-insight" inert={!preview}><div>{currentDetail?.description&&<p>{currentDetail.description}</p>}<GameDiscoveryRatings game={game} active={preview}/></div></div></div>:failed?<div className="games-season-pending" role="alert"><p>{t("games.season.error")}</p><button className="games-button" onClick={()=>setAttempt(n=>n+1)}>{t("common.retry")}</button></div>:<div className="games-season-pending" role="status"><span>{t(loaded?"games.season.empty":"games.season.loading")}</span></div>}
    </div></div>
    {!games.length&&!loaded&&!failed&&<div className="games-season-filmstrip games-season-filmstrip-loading" aria-hidden="true">{[0,1,2,3,4,5].map(i=><div key={i}><GameSkeleton className="games-season-skeleton-art"/><GameSkeleton className="games-season-skeleton-name"/></div>)}</div>}
    {!!games.length&&<Row className="games-season-rail games-content-rail" min={180} shape="landscape" arrowsAlways scrollKey={`games:season:${season}`}>{games.map(item=><button className="games-season-choice" key={item.id} aria-pressed={item.id===game.id} onClick={()=>setSelected(item.id)}><GameAvailabilityCover game={item} src={item.capsule}/><span>{item.name}</span></button>)}</Row>}
    <GameDataStatus at={savedMetadataAt(games)} refresh={() => setAttempt(value => value + 1)} />
  </section>;
}

function SeasonalGameLogo({game,detail,active}:{game:GameSummary;detail:GameDetail|null;active:boolean}) {
  const [logo,setLogo]=useState<GameLogoArt>();
  useEffect(()=>{
    if(!active||!game.steamId)return;
    const controller=new AbortController();
    void (async()=>{
      const src=await loadSteamHeroLogo(game.steamId!,AbortSignal.any([controller.signal,AbortSignal.timeout(8000)])).catch(()=>undefined);
      if(controller.signal.aborted)return;
      const art=await decodeGameLogo(src||detail?.logo,game.steamId);
      if(!controller.signal.aborted)setLogo(art);
    })();
    return()=>controller.abort();
  },[active,game.steamId,detail?.logo]);
  return <div className="games-season-game-identity">{logo?<svg className="games-season-game-logo" viewBox={logo.viewBox} role="img" aria-label={game.name} preserveAspectRatio="xMaxYMid meet"><image style={{filter: logo.white ? "brightness(0) invert(1)" : undefined}} href={logo.src} width={logo.width} height={logo.height}/></svg>:<h3>{game.name}</h3>}</div>;
}

function SeasonMark({season}:{season:string}) { return <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{season==="halloween"?<><path d="M20 11c-15-7-23 20-7 23 4 1 5-1 7-1s3 2 7 1C43 31 35 4 20 11Z"/><path d="M20 11c-8 1-8 22 0 22s8-21 0-22ZM20 11V7l4-3M11 21l4-3 2 4m6 0 2-4 4 3M14 28l3 2 3-2 3 2 3-2"/></>:season==="holiday"?<><path d="m20 4 9 12h-5l9 11H7l9-11h-5L20 4Zm0 23v8M15 35h10M9 7v5M6.5 9.5h5M32 18v5M29.5 20.5h5"/></>:<><circle cx="20" cy="20" r="8"/><path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l4 4M28 28l4 4M8 32l4-4M28 12l4-4"/></>}</svg>; }
