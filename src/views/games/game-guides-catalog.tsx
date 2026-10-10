import { Play } from "@/components/icons/play-filled";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, BookOpen, Crosshair, Radio, Search, X, RefreshCw } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useView } from "@/lib/view";
import { officialBroadcastSource } from "@/lib/sports/esports-streams";
import { twitchGameSlug } from "@/lib/games/guide-streams";
import type { GuideVideoSort, GuideVideoDate } from "@/lib/games/guide-video-options";
import { useT, getUiLanguage } from "@/lib/i18n";
import { defaultSteamGuideFilters } from "@/lib/games/steam-guide-options";
import { GameWrittenGuides } from "./game-written-guides";
import type { GameGuide } from "@/lib/games/guides-data";
import { proConfigGame } from "@/lib/games/pro-configs";
import { GameArt } from "./game-art";
import type { GuideGame } from "./game-guides";
import { GuideProviderMark, GuideSourceLink, guideSourceName } from "./guide-shared";
import { GameProConfigs } from "./game-pro-configs";
import { GuideRetry } from "./guide-retry";
import { useGuideResults, type GuideTab, type LiveProvider } from "./use-guide-results";

export function GameGuides({game,active,read,back}:{game:GuideGame;active:boolean;read:(item:GameGuide,origin?:HTMLElement)=>void;back?:()=>void}) {
  const {openPlayer}=useView();
  const [videoSort,setVideoSort]=useState<GuideVideoSort>("popular"),[videoDate,setVideoDate]=useState<GuideVideoDate>("year"),[liveSort,setLiveSort]=useState<"popular"|"relevance">("popular");
  const selectGuide=(item:GameGuide,origin?:HTMLElement)=>{if(item.live&&(item.source==="twitch"||item.source==="kick"||item.source==="youtube")){const source=officialBroadcastSource({title:item.author||item.title,url:item.url,platform:item.source});if(source){openPlayer({...source,isLive:true});return;}}read(item,origin);};
  const t=useT(),[tab,setTab]=useState<GuideTab>("written"),[provider,setProvider]=useState<LiveProvider>("all");
  const [draft,setDraft]=useState(""),[query,setQuery]=useState(""),[steamFilters,setSteamFilters]=useState(()=>defaultSteamGuideFilters(getUiLanguage())),[floor,setFloor]=useState(0);
  const root=useRef<HTMLElement>(null),stage=useRef<HTMLDivElement>(null),anchor=useRef<number|null>(null);
  const result=useGuideResults(game,active,tab,provider,query,steamFilters,tab==="live"?liveSort:videoSort,videoDate),configGame=proConfigGame(game.name,game.steamId);
  const key=JSON.stringify([tab,provider,query,steamFilters,tab==="live"?liveSort:videoSort,videoDate]);
  const change=(action:()=>void)=>{
    const container=root.current?.closest<HTMLElement>(".games-view");
    anchor.current=container?.scrollTop??null;
    setFloor(stage.current?.getBoundingClientRect().height??0);action();
  };
  useLayoutEffect(()=>{
    const container=root.current?.closest<HTMLElement>(".games-view"),current=stage.current;
    if(!container||!current||!active)return;
    if(anchor.current!==null){container.scrollTop=anchor.current;anchor.current=null;}
    if(result.busy)return;
    // Keep enough canvas below the viewport to prevent scroll clamping. Release
    // that reservation as the reader scrolls up, rather than leaving a tall void.
    const preserve=()=>setFloor(Math.max(0,container.clientHeight-(current.getBoundingClientRect().top-container.getBoundingClientRect().top)-80));
    preserve();container.addEventListener("scroll",preserve,{passive:true});return()=>container.removeEventListener("scroll",preserve);
  },[key,result.busy,active]);
  const pcwiki:GameGuide={id:game.name,title:t("games.guides.pcTitle"),author:"PCGamingWiki",source:"pcwiki",image:game.capsule,description:t("games.guides.pcNote"),url:`https://www.pcgamingwiki.com/wiki/${encodeURIComponent(game.name.replaceAll(" ","_"))}`};
  const tabs:GuideTab[]=configGame?["written","videos","live","configs"]:["written","videos","live"];
  return <article className="games-guides" ref={root}>
    <header className="games-guides-hero">
      <GameArt className="games-guides-backdrop" src={game.hero||game.capsule} fallback={game.capsule} eager/>
      <div className="games-inset games-guides-heading">{back&&<button className="games-detail-back" onClick={back}><ArrowLeft size={16}/>{t("common.back")}</button>}<span>{game.name}</span><h1 tabIndex={-1}>{t("games.guides.title")}</h1><p>{t("games.guides.note")}</p></div>
    </header>
    <div className="games-inset games-guides-body">
      <div className="games-guides-toolbar"><nav aria-label={t("games.guides.title")}>{tabs.map(value=>{const Icon={written:BookOpen,videos:Play,live:Radio,configs:Crosshair}[value];return <button key={value} aria-pressed={tab===value} aria-controls="games-guide-results" onClick={()=>change(()=>setTab(value))}><Icon size={18}/>{t(`games.guides.${value}`)}</button>;})}</nav>
        <form className="games-guides-search" onSubmit={event=>{event.preventDefault();change(()=>setQuery(draft.trim()));}}><Search size={18}/><input aria-label={t(tab==="configs"?"games.guides.searchPlayers":"games.guides.search")} placeholder={t(tab==="configs"?"games.guides.searchPlayers":"games.guides.search")} value={draft} onChange={event=>{setDraft(event.target.value);if(tab==="configs")setQuery(event.target.value);}}/>{draft&&<button type="button" aria-label={t("games.clear")} onClick={()=>change(()=>{setDraft("");setQuery("");})}><X size={17}/></button>}</form>
      </div>
      <div ref={stage} id="games-guide-results" className="games-guide-stage" style={{"--guide-floor":`${floor}px`} as CSSProperties}>
        <div key={tab} className="games-guide-panel">
          {tab==="configs"&&configGame?<GameProConfigs game={configGame} gameName={game.name} query={query} active={active}/>:tab==="written"?<GameWrittenGuides game={game} filters={steamFilters} query={query} setFilters={next=>change(()=>setSteamFilters(next))} reset={()=>change(()=>{setSteamFilters(current=>({...current,categories:[],language:""}));setDraft("");setQuery("");})} result={result} read={selectGuide} pcwiki={pcwiki}>{result.items.length>0&&<GuideContinuation key={key} result={result} active={active}/>}</GameWrittenGuides>:<>
            <div className="games-guide-subtoolbar">
              {tab==="live"?<div className="games-guide-providers" aria-label={t("games.guides.platform")}>{(["all","youtube","twitch","kick"] as const).map(value=><button key={value} aria-pressed={provider===value} onClick={()=>change(()=>setProvider(value))}>{value!=="all"&&<GuideProviderMark provider={value}/>} {value==="all"?t("games.guides.allPlatforms"):value==="youtube"?"YouTube":value==="twitch"?"Twitch":"Kick"}</button>)}</div>:<div className="games-guide-video-label"><GuideProviderMark provider="youtube"/><span>YouTube</span></div>}
            </div>
            <div className="games-guides-section-title"><h2>{t(tab==="live"?"games.guides.liveTitle":"games.guides.videoTitle")}</h2>
              {tab==="live"?<button className="games-guides-refresh" aria-label={t("games.guides.refresh")} onClick={result.retry} disabled={result.busy}><RefreshCw size={17}/></button>:<GuideSourceLink href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.name} walkthrough ${query}`)}`}>{t("games.guides.youtube")}</GuideSourceLink>}
            </div>

            {(tab==="videos"||tab==="live")&&<div className="games-guide-discovery-filters">
              <div><span>{t("games.guides.order")}</span><Dropdown ariaLabel={t("games.guides.order")} value={tab==="live"?liveSort:videoSort} onChange={value=>change(()=>tab==="live"?setLiveSort(value as "popular"|"relevance"):setVideoSort(value as GuideVideoSort))} options={[{value:"popular",label:t(tab==="live"?"games.guides.mostViewers":"games.guides.mostViews")},...(tab==="videos"?[{value:"newest",label:t("games.guides.recent")}]:[]),{value:"relevance",label:t(tab==="live"?"games.guides.streamerName":"games.guides.relevance")}]} /></div>
              {tab==="videos"&&<div><span>{t("games.guides.uploaded")}</span><Dropdown ariaLabel={t("games.guides.uploaded")} value={videoDate} onChange={value=>change(()=>setVideoDate(value as GuideVideoDate))} options={(["year","month","week","all"] as const).map(value=>({value,label:t(`games.guides.date.${value}`)}))}/></div>}
            </div>}
            {result.partial&&<p className="games-guide-provider-note" role="status">{t("games.guides.partial")} <button onClick={result.retry}>{t("common.retry")}</button></p>}
            <div aria-busy={result.busy}>
              {result.items.length>0?<div className="games-guides-grid">{result.items.map((item,index)=><GuideCard key={`${item.source}:${item.id}`} item={item} game={game} read={selectGuide} index={index}/>)}</div>:result.busy?<GuideCardSkeletons/>:result.error?<div className="games-guides-empty" role="alert">{tab==="live"&&provider==="kick"?<GuideProviderMark provider="kick"/>:<BookOpen size={30}/>}<h3>{t("games.guides.sourceErrorTitle")}</h3><p>{t("games.guides.error")}</p><GuideRetry retryAt={result.retryAt} onRetry={result.retry}/>{tab==="live"&&provider==="kick"&&<GuideSourceLink href={`https://kick.com/category/${encodeURIComponent(game.name.toLowerCase().replace(/[’']/g,"").replace(/[^\p{L}\p{N}]+/gu,"-"))}`}>{t("games.guides.moreKick")}</GuideSourceLink>}</div>:<div className="games-guides-empty"><BookOpen size={28}/><p>{t(tab==="live"?"games.guides.noLive":"games.guides.empty")}</p></div>}
              {result.busy&&result.items.length>0&&<GuideCardSkeletons count={12}/>}
            </div>
            {result.items.length>0&&<GuideContinuation key={key} result={result} active={active}/>}
            {result.items.length>0&&!result.more&&!result.error&&tab==="live"&&provider==="twitch"&&<div className="games-guides-pagination"><GuideSourceLink href={`https://www.twitch.tv/directory/category/${encodeURIComponent(twitchGameSlug(game.name))}`}>{t("games.guides.twitch")}</GuideSourceLink></div>}
            {result.items.length>0&&!result.more&&!result.error&&tab==="live"&&provider==="kick"&&<div className="games-guides-pagination"><GuideSourceLink href={`https://kick.com/category/${encodeURIComponent(game.name.toLowerCase().replace(/[’']/g,"").replace(/[^\p{L}\p{N}]+/gu,"-"))}`}>{t("games.guides.moreKick")}</GuideSourceLink></div>}
          </>}
        </div>
      </div>
    </div>
  </article>;
}
function GuideContinuation({result,active}:{result:ReturnType<typeof useGuideResults>;active:boolean}) {
  const t=useT(),root=useRef<HTMLDivElement>(null),attempted=useRef(-1),[manual,setManual]=useState(false);
  const load=useRef(result.loadMore);load.current=result.loadMore;
  useEffect(()=>{
    const node=root.current,container=node?.closest('.games-view');
    if(!active){attempted.current=-1;setManual(false);return;}
    if(!node||!active||result.busy||result.error||!result.more)return;
    if(typeof IntersectionObserver==='undefined'){setManual(true);return;}
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      // A sparse provider continuation must not turn into an automatic crawl.
      // Normal full batches move the sentinel away; no-progress batches expose
      // a manual continuation while errors always require an explicit retry.
      if(attempted.current===result.items.length){setManual(true);return;}
      attempted.current=result.items.length;setManual(false);observer.disconnect();load.current();
    },{root:container,rootMargin:'0px 0px 360px 0px'});
    observer.observe(node);return()=>observer.disconnect();
  },[active,result.busy,result.error,result.more,result.items.length]);
  return !result.more&&!result.error&&!result.busy?null:<div className="games-guides-pagination games-guide-continuation" ref={root}>
    {result.error?<><p role="status">{t('games.guides.error')}</p><GuideRetry retryAt={result.retryAt} onRetry={result.loadMore}/></>:result.busy?<span role="status">{t('common.loading')}</span>:result.more?<button className={manual?'games-button':'games-button games-guide-load-fallback'} onClick={result.loadMore}>{t('games.guides.more')}</button>:null}
  </div>;
}
function GuideCard({item,game,read,index}:{item:GameGuide;game:GuideGame;read:(item:GameGuide,origin?:HTMLElement)=>void;index:number}) {
  const t=useT();return <button className="games-guide-card" style={{"--guide-delay":`${Math.min(index%24,7)*18}ms`} as CSSProperties} onClick={event=>read(item,event.currentTarget)}><div className="games-guide-art"><GameArt src={item.image} fallback={game.capsule}/>{(item.source==="youtube"||item.source==="kick"||item.source==="twitch")&&<span className="games-guide-play"><Play size={23}/></span>}{(item.live||item.duration)&&<small>{item.live?t("games.guides.live"):item.duration}</small>}</div><div className="games-guide-card-copy"><small>{(item.source==="youtube"||item.source==="kick"||item.source==="twitch")&&<GuideProviderMark provider={item.source}/>}<span>{item.author||guideSourceName(item)}{item.published?` · ${item.published}`:""}</span></small><h3>{item.title}</h3>{(item.live?item.viewers:item.views)!==undefined&&<span className="games-guide-view-count">{t(item.live?"games.guides.viewers":"games.guides.views",{count:(item.live?item.viewers!:item.views!).toLocaleString()})}</span>}{item.description&&<p>{item.description}</p>}</div></button>;
}
export function GuideCardSkeletons({count=24,written=false}:{count?:number;written?:boolean}) {
  const t=useT();return <div className="games-guides-grid games-guides-skeletons" role="status" aria-label={t("common.loading")}>{Array.from({length:count},(_,i)=><div className="games-guide-card games-guide-skeleton" key={i} aria-hidden><div className="games-guide-art"/><div className="games-guide-card-copy"><small/><h3/>{written?<p/>:<span className="games-guide-view-count"/>}</div></div>)}</div>;
}
