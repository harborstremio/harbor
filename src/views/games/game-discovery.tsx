import { GameAvailabilityBadge, GameAvailabilityCover } from "./game-availability";
import { observeWithin } from "@/lib/visibility";
import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadGameCatalog, loadGameDetail, loadGameHighlights, loadMostPlayedGames, loadStoreSelectionPage, type GameChart, type GameHighlight } from "@/lib/games/catalog";
import type { GameDetail, GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameHeroLogo } from "./game-hero-logo";
import { SteamMark } from "./game-detail-marks";
import { GameChartPreview } from "./game-chart-preview";
import { GameCard, GameMark, GamePrice } from "./game-ui";
import { Dropdown } from "@/components/dropdown";
import { DEFAULT_CATALOG_FILTERS } from "@/lib/games/catalog-filters";
import { isRecentGameRelease } from "@/lib/games/steam-data";
import { useLiveRefresh } from "./use-live-refresh";
import { GameDataStatus } from "./game-data-status";
import { savedMetadataAt } from "@/lib/games/metadata-records";
import { GameSkeleton } from "./game-loading";
import { GameRowArrows, useStoreRow } from "./game-store-row";
import { usePagedGameRow, useRowNavigation } from "./use-paged-game-row";
import { scoreTone } from "./game-discovery-ratings";
import { useRecommendationRatings } from "./game-recommendation-rating";
import "./game-discovery-desk.css";

function ReleaseMeta({game,publishers}:{game?:GameHighlight;publishers?:string[]}) {
  const t=useT(),language=useUiLanguage(),names=game?.publishers?.length?game.publishers:publishers,reviews=game?.reviews;
  return <span className="games-release-meta">{names?.length?<span className="games-release-publisher" title={names.join(" · ")}>{names.join(" · ")}</span>:null}{reviews&&<span className="games-release-rating" data-score-tone={scoreTone(reviews.positive)} title={t("games.editorial.scoreNote",{score:reviews.positive,count:reviews.count.toLocaleString(language)})}><SteamMark/><strong>{reviews.positive}%</strong><span>{t("games.community.authorReviews",{count:reviews.count.toLocaleString(language)})}</span></span>}</span>;
}

export function NewReleases({ games, open, active = true }: { games: GameSummary[]; open: (game: GameSummary) => void; active?: boolean }) {
  const t = useT();
  const [detail, setDetail] = useState<GameDetail | null>(null);
  const [metadata,setMetadata]=useState<GameHighlight[]>([]);
  const {root,row}=useStoreRow("popularnew",active,games.filter(game=>isRecentGameRelease(game)));
  const navigation=useRowNavigation(row,5),recent=navigation.visible;
  const first = recent[0], lead = detail?.id === recent[0]?.id ? detail : null;
  const ids=recent.flatMap(game=>game.steamId?[game.steamId]:[]).join(",");
  useEffect(()=>{if(!active||!ids)return;let current=true;void loadGameHighlights(ids.split(",").map(Number)).then(value=>{if(current)setMetadata(value);},()=>{});return()=>{current=false;};},[active,ids]);
  useEffect(() => {
    let current = true;
    setDetail(null);
    if (first?.steamId) void loadGameDetail(first.steamId).then(value => { if (current) setDetail(value); }, () => {});
    return () => { current = false; };
  }, [first?.steamId]);
  return <section ref={root} className="games-section games-inset games-release-section">
    <div className="games-section-heading"><div><div className="games-section-kicker"><GameMark kind="release" />{t("games.freshArrivals")}</div><h2 className="games-steam-section-title"><SteamMark/>{t("games.new_releases")}</h2><p>{t("games.new_releasesNote")}</p></div><GameRowArrows row={row} navigation={navigation}/></div>
    {!first&&!row.loaded&&!row.failed&&<div className="games-release-grid" aria-busy="true"><GameSkeleton className="games-release-feature"/>{[0,1,2,3].map(i=><div key={i}><GameSkeleton className="games-card-art"/><GameSkeleton className="games-skeleton-title"/><GameSkeleton className="games-skeleton-meta"/></div>)}</div>}
    {first&&<div className="games-release-grid games-row-motion" key={navigation.page} data-direction={navigation.direction}><button className="games-release-feature" onClick={() => open(first)} data-game={first.id}>
      <GameArt src={lead?.screenshots[0] ?? (first.steamId?`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${first.steamId}/library_hero.jpg`:first.capsule)} fallback={first.capsule} /><div className="games-collection-shade" />
      <GameAvailabilityBadge game={first}/><span className="games-release-label"><GameMark kind="release" size={16} />{t("games.newRelease")}</span>
      <span className="games-release-copy"><span>{lead?.genres.slice(0, 2).join(" · ") || first.platforms.join(" · ")}</span><GameHeroLogo key={first.id} sources={[lead?.logo]} steamId={first.steamId} name={first.name} platformIds={[]} ready={true} active={active} preferCurrentSteamLogo className="games-release-logo"/><strong>{first.name}</strong><ReleaseMeta game={metadata.find(game=>game.id===first.id)} publishers={lead?.publishers}/>{lead && <span className="games-release-description">{lead.description}</span>}<span className="games-release-action games-feature-link">{t("games.discovery.viewGame")}</span></span>
    </button>
      {recent.slice(1, 5).map(game => <article className="games-release-card" key={game.id}><GameCard game={game} open={open} showRelease /><ReleaseMeta game={metadata.find(item=>item.id===game.id)}/></article>)}
    </div>}
    {row.failed&&<div className="games-inline-status" role="alert"><span>{t("games.charts.error")}</span><button className="games-button" onClick={row.retry}>{t("common.retry")}</button></div>}
    <GameDataStatus at={row.cachedAt} busy={row.busy} refresh={row.refresh} />
  </section>;
}

const DESK_TABS=["most_played","top_rated","top_sellers","new_releases","coming_soon"] as const;
const DESK_BATCH_SIZE = 12;

function ChartRating({ reviews }: { reviews?: GameHighlight["reviews"] }) {
  const t = useT(), language = useUiLanguage();
  if (!reviews) return null;
  const label = t("games.editorial.scoreNote", { score: reviews.positive, count: reviews.count.toLocaleString(language) });
  return <span className="games-desk-rating" data-score-tone={scoreTone(reviews.positive)} role="img" aria-label={label} title={label}>
    <SteamMark/><strong>{reviews.positive}%</strong><span>{t("games.community.authorReviews", { count: new Intl.NumberFormat(language, { notation: "compact", maximumFractionDigits: 1 }).format(reviews.count) })}</span>
  </span>;
}

export function DiscoveryDesk({open,active}:{open:(game:GameSummary)=>void;active:boolean}) {
  const t=useT(),language=useUiLanguage(),id=useId(),root=useRef<HTMLElement>(null),continuation=useRef<HTMLDivElement>(null);
  const [tab,setTab]=useState<string>("most_played"),[focused,setFocused]=useState<string|null>(null),[platform,setPlatform]=useState("all"),[query,setQuery]=useState(""),[seen,setSeen]=useState(false),[term,setTerm]=useState("");
  const [extent,setExtent]=useState({key:"",count:DESK_BATCH_SIZE});
  const [chart,setChart]=useState<GameChart|null>(null),[chartLoading,setLoading]=useState(false),[chartFailed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const timer=setTimeout(()=>setTerm(query.trim()),250);return()=>clearTimeout(timer);},[query]);
  const os=platform==="Windows"?"win":platform==="macOS"?"mac":platform==="Linux"?"linux":"all";
  const provider=usePagedGameRow({id:`desk:${tab}:${platform}:${term}`,active:active&&seen&&tab!=="most_played",load:async(offset,signal)=>{
    const page=tab==="top_rated"?await loadGameCatalog(term,{...DEFAULT_CATALOG_FILTERS,platform:os,sort:"Reviews_DESC"},offset,signal):await loadStoreSelectionPage(tab==="new_releases"?"popularnew":tab==="coming_soon"?"popularcomingsoon":"topsellers",offset,signal,{query:term,platform:os});
    return {...page,cachedAt:savedMetadataAt(page)};
  }});
  const loading=tab==="most_played"?chartLoading:provider.busy,failed=tab==="most_played"?chartFailed:provider.failed;
  const refresh=useLiveRefresh(active&&seen);
  useEffect(()=>{const el=root.current;if(!el)return;return observeWithin(el, "400px", entry => { if (entry.isIntersecting) setSeen(true); });},[]);
  useEffect(()=>{
    if(!active||!seen||tab!=="most_played")return;
    const request=new AbortController();setLoading(true);setFailed(false);
    const task=loadMostPlayedGames().then(value=>{if(!request.signal.aborted)setChart(value);});
    void task.catch(()=>{if(!request.signal.aborted)setFailed(true);}).finally(()=>{if(!request.signal.aborted)setLoading(false);});return()=>request.abort();
  },[active,seen,tab,attempt,refresh]);
  useEffect(()=>{setFocused(null);},[tab,platform,term]);
  const all=tab==="most_played"?chart?.games??[]:provider.games;
  const games=tab==="most_played"?all.filter(game=>(platform==="all"||game.platforms.includes(platform))&&game.name.toLocaleLowerCase().includes(term.toLocaleLowerCase())):all;
  const key=`desk:${tab}:${platform}:${term}`,count=extent.key===key?extent.count:DESK_BATCH_SIZE;
  const visible=games.slice(0,count),selected=visible.find(game=>game.id===focused)??visible[0];
  const ratings=useRecommendationRatings(tab==="most_played"?[]:visible,active&&seen,true);
  const hasMore=count<games.length||(tab!=="most_played"&&provider.nextOffset!==null);
  useEffect(()=>{
    const node=continuation.current;
    if(!node||!active||!seen||loading||failed||!games.length||!hasMore)return;
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      setExtent({key,count:count+DESK_BATCH_SIZE});
      if(count>=games.length&&tab!=="most_played")void provider.more(count+DESK_BATCH_SIZE);
    },{root:node.closest(".games-view"),rootMargin:"400px 0px"});
    observer.observe(node);return()=>observer.disconnect();
  },[active,seen,key,count,games.length,loading,failed,hasMore]);
  const choose=(value:string)=>{setTab(value);setFailed(false);setLoading(false);};
  return <section className="games-section games-inset games-discovery-desk" ref={root}>
    <div className="games-section-heading"><div><h2>{t("games.charts.title")}</h2><p>{t("games.charts.note")}</p></div><div className="games-platform-filter"><Dropdown value={platform} onChange={setPlatform} ariaLabel={t("games.platforms")} size="sm" options={[{value:"all",label:t("games.allPlatforms")},...["Windows","macOS","Linux"].map(value=>({value,label:value}))]}/></div></div>
    <div className="games-desk-controls"><div className="games-desk-tabs" role="tablist" aria-label={t("games.liveCatalog")} onKeyDown={event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')],at=buttons.indexOf(event.target as HTMLButtonElement);if(at<0)return;const rtl=getComputedStyle(event.currentTarget).direction==="rtl",direction=(event.key==="ArrowRight"?1:-1)*(rtl?-1:1),next=event.key==="Home"?0:event.key==="End"?buttons.length-1:(at+direction+buttons.length)%buttons.length;event.preventDefault();event.stopPropagation();buttons[next]?.focus();}}>{DESK_TABS.map(value=><button id={`${id}-${value}`} key={value} role="tab" tabIndex={tab===value?0:-1} aria-controls={`${id}-panel`} aria-selected={tab===value} onClick={()=>choose(value)}>{t(`games.desk.${value}`)}</button>)}</div><label className="games-desk-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("games.charts.search")} aria-label={t("games.charts.search")}/></label></div>
    <div className="games-desk-body" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}><div className="games-desk-list" key={key}>
      {visible.map((game,index)=>{const rank=chart?.games.find(item=>item.id===game.id)?.chartRank;return <button key={game.id} className={`games-desk-row${selected?.id===game.id?" is-selected":""}`} data-game={game.id} onPointerEnter={()=>setFocused(game.id)} onFocus={()=>setFocused(game.id)} onClick={()=>open(game)}>{tab==="most_played"&&<span className="games-desk-rank">{String(rank??index+1).padStart(2,"0")}</span>}<GameAvailabilityCover game={game} src={game.capsule}/><span className="games-desk-row-copy"><strong>{game.name}</strong><span className="games-desk-meta"><span>{game.platforms.join(" · ")}</span>{game.releaseTimestamp&&<time dateTime={new Date(game.releaseTimestamp*1000).toISOString()}>{new Date(game.releaseTimestamp*1000).toLocaleDateString(language,{year:"numeric",month:"short",day:"numeric"})}</time>}</span><span className="games-desk-row-footer"><GamePrice game={game}/><ChartRating reviews={(game as GameHighlight).reviews??ratings[game.id]?.steam}/></span></span></button>})}
      {!games.length&&(loading||(!failed&&((tab==="most_played"&&!chart)||(tab!=="most_played"&&!provider.loaded)))?<div className="games-desk-loading" role="status">{t("games.charts.loading")}{[0,1,2,3,4].map(i=><div key={i}/>)}</div>:failed?<div className="games-state" role="alert"><p>{t("games.charts.error")}</p><button className="games-button" onClick={()=>tab==="most_played"?setAttempt(n=>n+1):provider.retry()}>{t("common.retry")}</button></div>:<div className="games-state"><p>{t("games.noResults")}</p></div>)}
      <div ref={continuation} className="games-desk-continuation" aria-busy={loading&&games.length>0}>{loading&&games.length>0&&<><span className="sr-only" role="status">{t("games.charts.loading")}</span>{[0,1,2].map(i=><GameSkeleton key={i} className="games-desk-row-skeleton"/>)}</>}</div>
    </div>{selected&&<GameChartPreview key={selected.id} game={selected} active={active&&seen} open={open}/>}</div>
    {failed&&games.length>0&&<div className="games-inline-status" role="alert"><span>{t("games.charts.error")}</span><button className="games-button" onClick={()=>tab==="most_played"?setAttempt(n=>n+1):provider.retry()}>{t("common.retry")}</button></div>}
    <footer className="games-desk-footer"><span>{t(tab==="most_played"?"games.charts.playedSource":tab==="top_rated"?"games.charts.ratedSource":"games.charts.storeSource")}{tab==="most_played"&&chart?.date&&<> · {new Date(chart.date*1000).toLocaleDateString(language,{month:"short",day:"numeric"})}</>}</span></footer>
    <GameDataStatus at={savedMetadataAt(all)} refresh={tab === "most_played" ? () => setAttempt(value => value + 1) : provider.refresh} busy={loading} />
  </section>;
}
