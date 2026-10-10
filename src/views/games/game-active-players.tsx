import { GameAvailabilityBadge, useGameAvailabilityIndex } from "./game-availability";
import { gameAvailability } from "@/lib/games/availability";
import { GameActiveSkeleton } from "./game-loading";
import { observeWithin } from "@/lib/visibility";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavChevron } from "@/components/nav-arrow";
import { RefreshCw } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { Dropdown } from "@/components/dropdown";
import { AUDIENCE_REPORT, audienceChart, audiencePage, type AudienceBoard, type AudienceGame } from "@/lib/games/audience-charts";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadGameHighlights, type GameHighlight } from "@/lib/games/catalog";
import { PLAYER_COUNT_TTL } from "@/lib/games/player-counts";
import { loadConcurrentSteamChart, readConcurrentSteamChart, type ConcurrentChart } from "@/lib/games/concurrent-chart";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { useLiveRefresh } from "./use-live-refresh";
import { GameDiscoveryRatings, RatingMark } from "./game-discovery-ratings";
import { combineGameRatings } from "@/lib/games/rating-data";
import { openUrl } from "@/lib/window";
import { GameChartRank } from "./game-chart-rank";
import { GameActiveFeature, PlayersMark } from "./game-active-feature";
import { AudiencePlatformMark } from "./game-audience-marks";
import { loadXboxAudience } from "@/lib/games/xbox-audience-api";
import { XBOX_AUDIENCE_TTL, XBOX_AUDIENCE_URL } from "@/lib/games/xbox-audience";
import { loadDeckAudience } from "@/lib/games/deck-audience-api";
import { DECK_AUDIENCE_TTL, DECK_AUDIENCE_URL, type DeckAudience } from "@/lib/games/deck-audience";
import "./game-active-players.css";

/** Each chart retains its own metric, period and platform coverage. */
export function GameActivePlayers({ active, open, search }: { active: boolean; open: (game: GameSummary) => void; search: (name: string) => void }) {
  const t=useT(),language=useUiLanguage(),root=useRef<HTMLElement>(null);
  const availability = useGameAvailabilityIndex();
  const [near,setNear]=useState(false),[chart,setChart]=useState<ConcurrentChart|null>(()=>readConcurrentSteamChart()??null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),[refreshing,setRefreshing]=useState(false);
  const [page,setPage]=useState(0),[chosen,setChosen]=useState<string>(),[now,setNow]=useState(Date.now);
  const selectedId=useRef<string | undefined>(undefined);
  const [reviews,setReviews]=useState<GameHighlight[]>([]);
  const [board,setBoard]=useState<AudienceBoard>("steam");
  const [xboxChart,setXboxChart]=useState<{data:AudienceGame[];at:number}>(),[xboxFailed,setXboxFailed]=useState(false);
  const [deckChart,setDeckChart]=useState<{data:DeckAudience;at:number}>(),[deckFailed,setDeckFailed]=useState(false);
  const steam=board==="steam",xbox=board==="xbox",deck=board==="deck";
  const chartRevision=useLiveRefresh(active&&near&&steam,PLAYER_COUNT_TTL);
  const xboxRevision=useLiveRefresh(active&&near&&xbox,XBOX_AUDIENCE_TTL);
  const deckRevision=useLiveRefresh(active&&near&&deck,DECK_AUDIENCE_TTL);
  useEffect(()=>{const node=root.current;if(!node)return;return observeWithin(node, "450px", entry => setNear(entry.isIntersecting));},[]);
  useEffect(()=>{if(!active||!near||!steam)return;const request=new AbortController();setFailed(false);setRefreshing(true);void loadConcurrentSteamChart(request.signal,value=>{if(!request.signal.aborted)setChart(previous=>previous??value);},retry>0).then(value=>{if(!request.signal.aborted){setChosen(id=>id??selectedId.current);setChart(value);setNow(Date.now());}},()=>{if(!request.signal.aborted)setFailed(true);}).finally(()=>{if(!request.signal.aborted)setRefreshing(false);});return()=>request.abort();},[active,near,steam,chartRevision,retry]);
  useEffect(()=>{if(!active||!near||!xbox)return;const request=new AbortController();setXboxFailed(false);void loadXboxAudience(request.signal).then(value=>{if(!request.signal.aborted)setXboxChart(value);},()=>{if(!request.signal.aborted)setXboxFailed(true);});return()=>request.abort();},[active,near,xbox,xboxRevision,retry]);
  useEffect(()=>{if(!active||!near||!deck)return;const request=new AbortController();setDeckFailed(false);void loadDeckAudience(request.signal).then(value=>{if(!request.signal.aborted)setDeckChart(value);},()=>{if(!request.signal.aborted)setDeckFailed(true);});return()=>request.abort();},[active,near,deck,deckRevision,retry]);
  const all:AudienceGame[]=useMemo(()=>board==="steam"?chart?.games??[]:board==="xbox"?xboxChart?.data??[]:board==="deck"?deckChart?.data.games??[]:audienceChart(board),[board,chart,xboxChart,deckChart]);
  const pages=Math.ceil(all.length/6),currentPage=Math.min(page,Math.max(0,pages-1)),games=audiencePage(all,currentPage),selected=all.find(game=>game.id===chosen)??games[0];
  selectedId.current=selected?.id;
  const ids=games.map(game=>game.steamId).filter((id):id is number=>!!id),identity=ids.join(",");
  useEffect(()=>{if(!active||!near||!identity)return;let current=true;void loadGameHighlights(ids).then(value=>{if(current)setReviews(value);},()=>{});return()=>{current=false;};},[active,near,identity,chartRevision]);
  useEffect(()=>{if(!active||!near||!steam)return;const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[active,near,steam]);
  const observation=(id?:number)=>id&&chart&&now>=chart.observedAt&&Math.max(now,Date.now())-chart.observedAt<PLAYER_COUNT_TTL?chart.games.find(game=>game.steamId===id):undefined;
  const format=new Intl.NumberFormat(language);
  const month=new Date(`${AUDIENCE_REPORT.month}T12:00:00Z`).toLocaleDateString(language,{month:"long",year:"numeric",timeZone:"UTC"});
  const sourceUrl=steam?"https://store.steampowered.com/charts/mostplayed":xbox?XBOX_AUDIENCE_URL:deck?DECK_AUDIENCE_URL:AUDIENCE_REPORT.url;
  const rankLabel=(rank:number)=>t(steam||xbox||deck?"games.audience.rank":"games.audience.monthlyRank",{rank});
  return <section className="games-section games-inset games-active-players" ref={root}>
    <div className="games-section-heading"><div><h2>{t("games.discovery.activeTitle")}</h2><p>{steam?t("games.discovery.activeNote"):xbox?t("games.audience.xboxNote"):deck?t("games.audience.deckNote"):t(board==="pc"?"games.audience.pcNote":"games.audience.consoleNote",{month})}</p></div><div className="games-active-controls"><Dropdown size="sm" ariaLabel={t("games.audience.choose")} value={board} options={(["steam","xbox","deck","pc","console"] as const).map(value=>({value,label:t(`games.audience.${value}`),left:<AudiencePlatformMark board={value}/>}))} onChange={value=>{setBoard(value as AudienceBoard);setPage(0);setChosen(undefined);}}/>{pages>1&&<div className="games-page-controls"><span>{currentPage+1} / {pages}</span><button className="games-icon-button" disabled={!currentPage} aria-label={t("common.previous")} onClick={()=>{setPage(currentPage-1);setChosen(undefined);}}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" disabled={currentPage===pages-1} aria-label={t("common.next")} onClick={()=>{setPage(currentPage+1);setChosen(undefined);}}><NavChevron dir="right" size={18}/></button></div>}</div></div>
    {selected?<div className="games-active-layout"><GameActiveFeature game={selected} active={active&&near} open={game=>game.steamId||game.igdbId?open(game):search(game.name)}/><div className="games-active-list">{games.map(game=>{const count=observation(game.steamId),review=game.steamId?reviews.find(item=>item.steamId===game.steamId):undefined,status=gameAvailability(availability,game),statusLabel=status?t("games.availability."+status):undefined;return <div key={game.id} className={`games-active-row${selected.id===game.id?" is-selected":""}`} data-game={game.id}>
      <button className="games-active-select" aria-label={statusLabel?`${game.name} · ${statusLabel}`:game.name} title={statusLabel} aria-pressed={selected.id===game.id} onClick={()=>setChosen(game.id)}/>
      <span className={`games-active-rank${game.chartRank<=3?" is-podium":""}`} aria-label={rankLabel(game.chartRank)}>{game.chartRank<=3?<GameChartRank rank={game.chartRank}/>:String(game.chartRank).padStart(2,"0")}</span>
      <div className="games-active-cover"><GameArt src={review?.wideCapsule || review?.capsule || game.capsule} fallback={game.capsule} className="games-active-thumbnail"/><GameAvailabilityBadge status={status} iconOnly/></div>
      <div className="games-active-game-name"><strong title={game.name}>{game.name}</strong>{!xbox&&<GameDiscoveryRatings game={game} active={active&&near} initialRatings={combineGameRatings(game,undefined,undefined,review)} compact/>}</div>
      {steam&&<span className="games-active-row-stat">{count?<><strong>{format.format(count.currentPlayers)}</strong><span><PlayersMark/>{t("games.audience.onSteamNow")}</span></>:<span>{rankLabel(game.chartRank)}</span>}</span>}
    </div>;})}</div></div>:(xbox?xboxFailed:deck?deckFailed:failed)?<div className="games-inline-status" role="alert"><span>{t("games.charts.error")}</span><button className="games-button" onClick={()=>setRetry(value=>value+1)}>{t("common.retry")}</button></div>:<GameActiveSkeleton/>}
    {(!steam||chart)&&<footer className="games-active-source">
      <HoverTooltip label={steam?t("games.discovery.activeSource"):xbox?t("games.audience.xboxSource"):deck?t("games.audience.deckSource"):t("games.audience.source")}
        sublabel={steam?t("games.discovery.countsSource"):t(xbox?"games.audience.xboxCoverage":deck?"games.audience.deckCoverage":"games.audience.coverage")}
        mark={steam?<RatingMark source="steam"/>:undefined} arrow large side="top">
        <a href={sourceUrl} onClick={event=>{event.preventDefault();openUrl(event.currentTarget.href);}}>
          {steam&&<RatingMark source="steam"/>}{steam?t("games.discovery.steamCharts"):xbox?t("games.audience.xboxSource"):deck?t("games.audience.deckSource"):t("games.audience.snapshot",{month})}
        </a>
      </HoverTooltip>
      {deck&&deckChart&&<span>{new Date(deckChart.data.start*1000).toLocaleDateString(language,{month:"short",day:"numeric"})} – {new Date(deckChart.data.end*1000).toLocaleDateString(language,{month:"short",day:"numeric",year:"numeric"})}</span>}
      {((xbox&&xboxChart)||(deck&&deckChart))&&<span>{t("games.audience.xboxChecked",{date:new Date((xbox?xboxChart:deckChart)!.at).toLocaleString(language,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})})}</span>}
    </footer>}
    {((xbox&&xboxFailed&&xboxChart)||(deck&&deckFailed&&deckChart))&&<div className="games-inline-status" role="status"><span>{t("games.charts.error")}</span><button className="games-button" onClick={()=>setRetry(value=>value+1)}>{t("common.retry")}</button></div>}
    {steam&&chart&&<div className="games-active-refresh"><span>{t("games.audience.xboxChecked",{date:new Date(chart.observedAt).toLocaleString(language,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})})}</span><button className="games-text-action" aria-label={t("games.cache.refresh")} disabled={refreshing} onClick={()=>setRetry(value=>value+1)}><RefreshCw size={14}/>{t(refreshing?"games.cache.refreshing":"games.cache.refresh")}</button></div>}
    {steam&&failed&&chart&&<p className="games-inline-status" role="status">{t("games.charts.error")}</p>}
  </section>;
}
