import { GameAvailabilityBadge } from "./game-availability";
import { useEffect, useRef, useState } from "react";
import { useInViewport, observeWithin } from "@/lib/visibility";

import { Row } from "@/components/row";
import { Dropdown } from "@/components/dropdown";
import { GAME_PLATFORMS } from "@/lib/games/platforms";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadAtlasPage, queryIgdb, readAtlasPageSnapshot } from "@/lib/games/atlas";
import { DEFAULT_ATLAS_FILTERS, parseAtlasGame, type AtlasFilters, type AtlasGame, type AtlasRoute } from "@/lib/games/igdb-data";
import { GAME_MILESTONES, milestoneQuery } from "@/lib/games/discovery-collections";
import { rotateExplorePage } from "@/lib/games/explore-selection";
import type { GameSummary } from "@/lib/games/types";
import { GameCard } from "./game-ui";
import { GameArt } from "./game-art";
import { GameHeroLogo } from "./game-hero-logo";
import { GameCatalogRating } from "./game-discovery-ratings";
import "./games-discovery-refinement.css";
import { GamePosterSkeletons, GameSkeleton } from "./game-loading";
import { GameDataStatus } from "./game-data-status";
import { useLiveRefresh } from "./use-live-refresh";
import { usePagedGameRow } from "./use-paged-game-row";
import "./game-rails.css";
import "./game-discovery-collections.css";

function useNear() {
  const root=useRef<HTMLElement>(null),[near,setNear]=useState(false);
  useEffect(()=>{const node=root.current;if(!node)return;return observeWithin(node,"450px",entry=>{if(entry.isIntersecting)setNear(true);});},[]);
  return {root,near};
}

export function GameDiscoveryCollection({kind,active,open,browse,visit=""}:{kind:"greats"|"coop";active:boolean;open:(game:GameSummary)=>void;browse:(route:AtlasRoute,filters?:AtlasFilters)=>void;visit?:string}) {
  const t=useT(),{root,near}=useNear();
  const [filters,setFilters]=useState<AtlasFilters>({...DEFAULT_ATLAS_FILTERS,sort:"rated"});
  const revision=useLiveRefresh(active&&near,31*60_000);
  const route:AtlasRoute={kind,name:t(`games.collectionsLive.${kind}`)},selection=`${kind}:${filters.platform??"all"}:${filters.era}`;
  const row=usePagedGameRow({id:`${selection}:${revision}:${visit}`,active:active&&near,load:async(offset,signal)=>{const page=await loadAtlasPage(route,filters,offset,signal);return {...page,games:rotateExplorePage(page.games,visit+kind,offset)};},snapshot:async()=>{const page=await readAtlasPageSnapshot(route,filters);return page?{...page,games:rotateExplorePage(page.games,visit+kind,0)}:null;}});
  return <section ref={root} className={`games-section games-inset games-discovery-collection games-collection-${kind}`} aria-busy={row.busy}><div className="games-section-heading"><div><h2>{t(`games.collectionsLive.${kind}`)}</h2><p>{t(`games.collectionsLive.${kind}Note`)}</p></div><div className="games-greats-controls">{kind==="greats"&&<><Dropdown size="sm" ariaLabel={t("games.platforms")} value={String(filters.platform??"all")} options={[{value:"all",label:t("games.recommend.allPlatforms")},...GAME_PLATFORMS.map(platform=>({value:String(platform.id),label:platform.short}))]} onChange={value=>setFilters(previous=>({...previous,platform:value==="all"?undefined:Number(value)}))}/><Dropdown size="sm" ariaLabel={t("games.atlas.era")} value={filters.era} options={(["all","before1990","1990","2000","2010","2020"] as const).map(value=>({value,label:t(`games.atlas.era.${value}`)}))} onChange={value=>setFilters(previous=>({...previous,era:value as AtlasFilters["era"]}))}/></>}<button className="games-text-action" onClick={()=>browse(route,filters)}>{t("games.atlas.browseAll")}</button></div></div>
    {row.games.length?<Row key={selection} className="games-content-rail" min={144} shape="portrait" arrowsAlways scrollKey={`games:collection:${selection}`} onEndReached={()=>{if(!row.busy&&!row.failed&&row.nextOffset!==null)void row.more(row.games.length+12);}}>{row.games.map(game=><article key={game.id} className="games-save-card"><GameCard game={game} open={open} portrait/><GameCatalogRating score={game.rating} count={game.ratingCount} open={()=>open(game)}/></article>)}</Row>:!row.failed&&!row.loaded?<GamePosterSkeletons/>:null}
    {row.failed&&<div className="games-inline-status" role="alert"><span>{t("games.atlas.error")}</span><button className="games-button" onClick={row.retry}>{t("common.retry")}</button></div>}{row.loaded&&!row.games.length&&<p className="games-inline-status">{t("games.noResults")}</p>}<GameDataStatus at={row.cachedAt} busy={row.busy} refresh={row.refresh}/>
  </section>;
}

export function GameMilestones({active,open}:{active:boolean;open:(game:GameSummary)=>void}) {
  const t=useT(),language=useUiLanguage(),{root,near}=useNear(),[games,setGames]=useState<AtlasGame[]>([]),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!active||!near||games.length)return;const request=new AbortController();setFailed(false);void queryIgdb(milestoneQuery,request.signal).then(rows=>{if(!request.signal.aborted){const games=rows.map(parseAtlasGame);setGames(games);setFailed(!games.length);}},()=>{if(!request.signal.aborted)setFailed(true);});return()=>request.abort();},[active,near,attempt,games.length]);
  return <section ref={root} className="games-section games-inset games-milestones">
    <div className="games-section-heading"><div><h2>{t("games.collectionsLive.records")}</h2><p>{t("games.collectionsLive.recordsNote")}</p></div><a className="games-record-brand" href="https://www.guinnessworldrecords.com/" onClick={event=>{event.preventDefault();openUrl(event.currentTarget.href);}} aria-label="Guinness World Records"><img src="/games/guinness.png" alt="Guinness World Records"/></a></div>
    <Row className="games-content-rail games-milestone-rail" min={290} shape="landscape" arrowsAlways scrollKey="games:records">
      {GAME_MILESTONES.map(record=><Milestone key={record.key} record={record} game={games.find(game=>game.igdbId===record.id)} language={language} active={active} open={open}/>)}
    </Row>
    {failed&&<div className="games-inline-status"><span>{t("games.atlas.error")}</span><button className="games-text-action" onClick={()=>setAttempt(n=>n+1)}>{t("common.retry")}</button></div>}
  </section>;
}

function Milestone({record,game,language,active,open}:{record:typeof GAME_MILESTONES[number];game?:AtlasGame;language:string;active:boolean;open:(game:GameSummary)=>void}) {
  const t=useT(),card=useRef<HTMLElement>(null),shown=useInViewport(card);
  const date=record.date.length===4?record.date:new Date(record.date.length===7?record.date+"-01T12:00:00Z":record.date+"T12:00:00Z").toLocaleDateString(language,{month:"long",year:"numeric",timeZone:"UTC"});
  return <article ref={card} className="games-milestone">
    <button onClick={()=>game&&open(game)} disabled={!game} aria-label={record.name}>
      {game?<GameArt src={record.scene||game.hero} fallback={game.screenshots[0]??game.portrait}/>:<GameSkeleton/>}
      <GameHeroLogo key={record.id} className="games-record-logo" name={record.name} sources={[record.logo||undefined]} steamId={game?.steamId} platformIds={game?.platformLinks.map(platform=>platform.id)??[]} ready={!!game} active={active&&shown}/><span className="games-record-title">{record.name}</span>
          <GameAvailabilityBadge game={game}/>
    </button>
    <div><strong>{record.value}</strong><span>{t(`games.collectionsLive.${record.key}Record`)}<small>{"dated" in record?t(`games.collectionsLive.${record.key}Date`):date}</small></span></div>
    <a href={record.source} onClick={e=>{e.preventDefault();openUrl(record.source);}}>Guinness World Records</a>
  </article>;
}

