import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Heart, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { consumeBack, pushBackHandler } from "@/lib/back-intercept";
import { loadGameCatalog, loadRecommendationTagNames } from "@/lib/games/catalog";
import { loadMetadataMatches } from "@/lib/games/atlas";
import { DEFAULT_CATALOG_FILTERS } from "@/lib/games/catalog-filters";
import { buildRecommendationLibrary, gameIdentities, type RecommendationLibraryContext } from "@/lib/games/recommendations";
import { DISCOVERY_STYLES, DISCOVERY_MODES, discoverySignals, observeSteamLibrary, rankDiscovery, type DiscoveryOptions, type DiscoveryPick } from "@/lib/games/discovery-picker";
import { loadDiscoveryFeed, type DiscoveryFeed } from "@/lib/games/discovery-picker-source";
import { readDiscoveryPreferences, writeDiscoveryPreferences } from "@/lib/games/discovery-picker-storage";
import type { GameSummary } from "@/lib/games/types";
import type { SteamInstall } from "@/lib/games/installed";
import type { EmulationStore } from "@/lib/games/emulation";
import { GamePreviewTrigger } from "./game-search-results";
import "./game-search.css";
import { GameArt } from "./game-art";
import { GameHeroLogo } from "./game-hero-logo";
import { GamePosterSave } from "./game-poster-save";
import { SteamMark } from "./game-detail-marks";
import { Play } from "@/components/icons/play-filled";
import { DiscoveryPickerIcon, DiscoveryStyleIcon } from "./game-discovery-picker-icon";
import "./game-discovery-picker.css";

/* ANIMATION STORYBOARD
 *   0ms  Harbor's modal enters; controls become available immediately.
 * 180ms  New step settles: opacity 0 → 1, y 6px → 0.
 * On response: result cards settle in 28ms steps, capped after six cards.
 * Reduced motion removes both translation and stagger. No artificial loading delay.
 */
const TIMING={step:180,stagger:28,maxStagger:6};
const NO_LOGOS:string[]=[],NO_PLATFORMS:number[]=[];
type Props={profile:string;saved:GameSummary[];installed:SteamInstall[];emulation:EmulationStore;libraryContext:RecommendationLibraryContext;active:boolean;open:(game:GameSummary)=>void};

export function GameDiscoveryPicker(props:Props) {
  const t=useT(),[shown,setShown]=useState(false),trigger=useRef<HTMLButtonElement>(null);
  const dismiss=useCallback(()=>{setShown(false);requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));},[]);
  useEffect(()=>{if(!props.active)setShown(false);},[props.active]);
  if(!props.active)return null;
  return <>
    <div className="games-inset game-picker-entry">
      <button ref={trigger} className="game-picker-invitation" onClick={()=>setShown(true)} aria-haspopup="dialog">
        <span className="game-picker-entry-mark"><DiscoveryPickerIcon size={32}/></span>
        <span><strong>{t("games.pick.title")}</strong><small>{t("games.pick.invite")}</small></span>
        <span className="game-picker-entry-action">{t("games.pick.start")}</span>
      </button>
    </div>
    {shown&&<PickerModal key={props.profile} {...props} dismiss={dismiss}/>}
  </>;
}

function PickerModal({profile,saved,installed,emulation,libraryContext,active,open,dismiss}:Props&{dismiss:()=>void}) {
  const t=useT(),language=useUiLanguage(),id=useId();
  const [preferences,setPreferences]=useState(()=>readDiscoveryPreferences(profile));
  const [step,setStep]=useState(0),[advanced,setAdvanced]=useState(false),[names,setNames]=useState<Map<number,string>>(new Map());
  const [tagSearch,setTagSearch]=useState("");
  const [query,setQuery]=useState(""),[search,setSearch]=useState<GameSummary[]>([]),[searchBusy,setSearchBusy]=useState(false),[searchFailed,setSearchFailed]=useState(false);
  const [feed,setFeed]=useState<DiscoveryFeed|null>(null),[picks,setPicks]=useState<DiscoveryPick[]>([]),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),[saveFailed,setSaveFailed]=useState(false);
  const [visible,setVisible]=useState(13),[lastHidden,setLastHidden]=useState<DiscoveryPick|null>(null);
  const request=useRef<AbortController|null>(null),body=useRef<HTMLDivElement>(null),container=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null);
  const continuation=useRef<HTMLDivElement>(null), paging=useRef(false);
  const snapshot=useRef<DiscoveryOptions|null>(null),sessionScroll=useRef(0),lastOpened=useRef("");
  const {closing,close}=useModalExit(dismiss);
  const library=useMemo(()=>buildRecommendationLibrary(installed,emulation,libraryContext),[installed,emulation,libraryContext.steam,libraryContext.custom,libraryContext.launchers]);
  const {options,favorites}=preferences;
  const signals=discoverySignals(favorites,saved,library,libraryContext.steam,libraryContext.custom,preferences.observation,options.history);
  const tagName=(tag:number,fallback="")=>names.get(tag)??DISCOVERY_STYLES.find(item=>item[0]===tag)?.[2]??DISCOVERY_MODES.find(item=>item[0]===tag)?.[2]??fallback;
  const persist=(next:typeof preferences)=>{setPreferences(next);try{writeDiscoveryPreferences(profile,next);setSaveFailed(false);}catch{setSaveFailed(true);}};
  const change=(patch:Partial<DiscoveryOptions>)=>persist({...preferences,options:{...options,...patch}});
  const toggle=(field:"tags"|"modes",value:number)=>change({[field]:options[field].includes(value)?options[field].filter(id=>id!==value):[...options[field],value]});

  useEffect(()=>{
    const steam=libraryContext.steam;if(!steam?.libraryVisible)return;
    const observation=observeSteamLibrary(preferences.observation,steam);
    if(JSON.stringify(observation)!==JSON.stringify(preferences.observation))persist({...preferences,observation});
  },[libraryContext.steam?.steamId,libraryContext.steam?.updatedAt]);
  useEffect(()=>{if(!active)return;let current=true;void loadRecommendationTagNames(language).then(tags=>{if(current)setNames(new Map(tags.map(tag=>[tag.id,tag.name])));},()=>{});return()=>{current=false;};},[active,language]);
  useEffect(()=>{if(!active){request.current?.abort();setBusy(false);}return()=>request.current?.abort();},[active]);
  useEffect(()=>{if(closing)request.current?.abort();},[closing]);
  useEffect(()=>{if(!active)return;return pushBackHandler(()=>{close();return true;});},[active,close]);
  useEffect(()=>{
    if(!active)return;
    const recoverFocus=(event:KeyboardEvent)=>{
      if(event.key!=="Tab"||!container.current||container.current.contains(document.activeElement))return;
      const dialogs=document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if(dialogs[dialogs.length-1]!==container.current.closest('[role="dialog"]'))return;
      event.preventDefault();event.stopPropagation();
      container.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({preventScroll:true});
    };
    document.addEventListener("keydown",recoverFocus,true);return()=>document.removeEventListener("keydown",recoverFocus,true);
  },[active]);
  useEffect(()=>{
    if(!active)return;
    const frame=requestAnimationFrame(()=>{
      if(body.current)body.current.scrollTop=sessionScroll.current;
      const card=lastOpened.current?container.current?.querySelector<HTMLButtonElement>(`[data-pick="${CSS.escape(lastOpened.current)}"]`):null;
      (card??heading.current)?.focus({preventScroll:true});
    });return()=>cancelAnimationFrame(frame);
  },[active]);
  const go=(next:number)=>{sessionScroll.current=0;lastOpened.current="";setStep(next);requestAnimationFrame(()=>{body.current?.scrollTo({top:0});heading.current?.focus({preventScroll:true});});};

  useEffect(()=>{
    if(!active||step!==1||query.trim().length<2){setSearch([]);setSearchBusy(false);setSearchFailed(false);return;}
    const controller=new AbortController();setSearchBusy(true);setSearchFailed(false);
    const timer=setTimeout(async()=>{
      const responses=await Promise.allSettled([loadGameCatalog(query,DEFAULT_CATALOG_FILTERS,0,controller.signal),loadMetadataMatches(query,undefined,0,controller.signal)]);
      if(controller.signal.aborted)return;
      const results:GameSummary[]=[],seen=new Set<string>();
      for(const response of responses)if(response.status==="fulfilled")for(const game of response.value.games){
        const ids=gameIdentities(game);if(game.adultContent===true||ids.some(id=>seen.has(id)))continue;
        ids.forEach(id=>seen.add(id));results.push(game);
      }
      // Exact titles lead, then the providers' own order. Editions are not collapsed by title.
      const exact=(game:GameSummary)=>game.name.toLocaleLowerCase()===query.trim().toLocaleLowerCase()?1:0;
      setSearch(results.sort((a,b)=>exact(b)-exact(a)).slice(0,10));setSearchFailed(responses.some(r=>r.status==="rejected"));setSearchBusy(false);
    },240);
    return()=>{clearTimeout(timer);controller.abort();};
  },[active,step,query]);

  const find=async(more=false)=>{
    if(busy||paging.current)return;
    paging.current=true;
    request.current?.abort();const controller=new AbortController();request.current=controller;
    const selected=more&&snapshot.current?{...snapshot.current,excluded:options.excluded}:{...options,tags:[...options.tags],modes:[...options.modes]};
    snapshot.current=selected;setBusy(true);setFailed(false);setLastHidden(null);
    if(!more){setFeed(null);setPicks([]);setVisible(13);go(2);}
    try{
      const next=await loadDiscoveryFeed(selected,signals,library.games,controller.signal,more?feed??undefined:undefined);
      if(controller.signal.aborted)return;
      // Keep hidden candidates in this session so Undo also works after a fresh search.
      const ranked=rankDiscovery(next.candidates,next.taste,{...selected,excluded:[]},library.games);
      setFeed(next);
      setPicks(previous=>more?[...previous,...ranked.filter(pick=>!previous.some(old=>old.game.id===pick.game.id))]:ranked);
      if(more)setVisible(value=>value+12);
    }catch{if(!controller.signal.aborted)setFailed(true);}
    finally{paging.current=false;if(!controller.signal.aborted)setBusy(false);}
  };
  const hidden=new Set(options.excluded),shown=picks.filter(pick=>!hidden.has(pick.game.steamId!));
  const hasMore=feed?.hasMore??false;
  const loadMore=useRef<()=>void>(()=>{});
  loadMore.current=()=>{if(shown.length>visible)setVisible(value=>value+12);else if(hasMore)void find(true);};
  useEffect(()=>{
    if(!active||closing||step!==2||busy||failed||(!hasMore&&shown.length<=visible)||!continuation.current||!body.current)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();loadMore.current();}},{root:body.current,rootMargin:"0px 0px 240px 0px"});
    observer.observe(continuation.current);return()=>observer.disconnect();
  },[active,closing,step,busy,failed,hasMore,visible,shown.length,feed]);
  const addFavorite=(game:GameSummary)=>{
    if(favorites.length>=5||favorites.some(old=>gameIdentities(old).some(id=>gameIdentities(game).includes(id))))return;
    persist({...preferences,favorites:[...favorites,game]});setQuery("");
    requestAnimationFrame(()=>container.current?.querySelector<HTMLInputElement>('.game-picker-search input')?.focus({preventScroll:true}));
  };
  const removeFavorite=(game:GameSummary)=>{persist({...preferences,favorites:favorites.filter(f=>f.id!==game.id)});requestAnimationFrame(()=>container.current?.querySelector<HTMLInputElement>('.game-picker-search input')?.focus({preventScroll:true}));};
  const viewGame=(game:GameSummary)=>{lastOpened.current=game.id;sessionScroll.current=body.current?.scrollTop??0;open(game);};
  const hidePick=(pick:DiscoveryPick)=>{setLastHidden(pick);change({excluded:[...options.excluded,pick.game.steamId!].slice(-500)});requestAnimationFrame(()=>container.current?.querySelector<HTMLButtonElement>('[data-pick-undo]')?.focus({preventScroll:true}));};
  const restoreHidden=(all=false)=>{
    const restored=lastHidden?.game.id;
    change({excluded:all?[]:options.excluded.filter(id=>id!==lastHidden?.game.steamId)});setLastHidden(null);
    requestAnimationFrame(()=>container.current?.querySelector<HTMLButtonElement>(restored?`[data-pick="${CSS.escape(restored)}"]`:'[data-pick]')?.focus({preventScroll:true}));
  };
  const reason=(pick:DiscoveryPick)=>pick.missingTags.length?t("games.pick.closeMatch",{count:pick.matchedTags.length,total:pick.matchedTags.length+pick.missingTags.length}):pick.seed?t("games.pick.because",{name:pick.seed.game.name}):t("games.pick.matches");
  const missingTags=(pick:DiscoveryPick)=>pick.missingTags.length>0&&<p className="game-picker-missing">{t("games.pick.missing",{tags:pick.missingTags.map(tag=>tagName(tag,DISCOVERY_STYLES.find(style=>style[0]===tag)?.[2]??String(tag))).join(", ")})}</p>;
  if(!active)return null;

  return <ModalShell closing={closing} onDismiss={() => { if (!consumeBack()) close(); }} width={1040} labelledBy={id} backdropClassName="game-picker-scrim">
    <div className="game-picker" ref={container} style={{"--pick-step-ms":`${TIMING.step}ms`,"--pick-stagger-ms":`${TIMING.stagger}ms`} as React.CSSProperties} onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const dialog=event.currentTarget.closest('[role="dialog"]')!;
      const controls=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===heading.current)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }}>
      <header className="game-picker-header"><div><DiscoveryPickerIcon/><h2 id={id}>{t("games.pick.title")}</h2></div><button className="game-picker-icon-button" onClick={close} aria-label={t("common.close")}><X size={21}/></button></header>
      <nav className="game-picker-steps" aria-label={t("games.pick.steps")}>
        {["mood","taste","picks"].map((name,index)=><button key={name} aria-current={step===index?"step":undefined} disabled={busy||(index===2&&!feed&&!failed)} onClick={()=>go(index)}><span>{index+1}</span>{t(`games.pick.${name}`)}</button>)}
      </nav>
      <div className="game-picker-body" ref={body} onScroll={event=>{sessionScroll.current=event.currentTarget.scrollTop;}}>
        <div key={step} className="game-picker-step">
          <h3 ref={heading} tabIndex={-1}>{t(`games.pick.heading${step}`)}</h3>
          <p className="game-picker-intro">{t(`games.pick.note${step}`)}</p>
          {step===0&&<>
            <div className="game-picker-style-grid" role="group" aria-label={t("games.pick.mood")}>
              {DISCOVERY_STYLES.map(([tag,kind,fallback])=><button key={tag} aria-pressed={options.tags.includes(tag)} onClick={()=>toggle("tags",tag)}><DiscoveryStyleIcon kind={kind}/><span>{tagName(tag,fallback)}</span>{options.tags.includes(tag)&&<Check className="game-picker-selected" size={14}/>}</button>)}
            </div>
            <div className="game-picker-question"><h4>{t("games.pick.company")}</h4><div className="game-picker-choices" role="group" aria-label={t("games.pick.company")}>{DISCOVERY_MODES.map(([tag,,fallback])=><button key={tag} aria-pressed={options.modes.includes(tag)} onClick={()=>toggle("modes",tag)}>{options.modes.includes(tag)&&<Check size={14}/>} {tagName(tag,fallback)}</button>)}</div></div>
            <button className="game-picker-refine" aria-expanded={advanced} onClick={()=>setAdvanced(value=>!value)}><SlidersHorizontal size={17}/>{t("games.pick.refine")}<span>{options.scope!=="new"||options.platform!=="all"||options.price!=="all"||options.direction!=="balanced"||options.controller?<Check size={15}/>:null}</span></button>
            {advanced&&<div className="game-picker-filters">
              <div className="game-picker-extra-tags"><label className="game-picker-search"><Search size={17}/><input value={tagSearch} onChange={e=>setTagSearch(e.target.value)} placeholder={t("games.pick.tagSearch")} aria-label={t("games.pick.tagSearch")}/></label><div className="game-picker-choices">{[...names].filter(([tag,name])=>options.tags.includes(tag)||tagSearch.trim().length>1&&name.toLocaleLowerCase().includes(tagSearch.trim().toLocaleLowerCase())).slice(0,18).map(([tag,name])=><button key={tag} aria-pressed={options.tags.includes(tag)} onClick={()=>toggle("tags",tag)}>{options.tags.includes(tag)&&<Check size={14}/>} {name}</button>)}</div></div>
              <label>{t("games.pick.scope")}<select aria-label={t("games.pick.scope")} value={options.scope} onChange={e=>change({scope:e.target.value as DiscoveryOptions["scope"]})}>{["new","library","any"].map(value=><option key={value} value={value}>{t(`games.pick.scope.${value}`)}</option>)}</select></label>
              <label>{t("games.pick.direction")}<select aria-label={t("games.pick.direction")} value={options.direction} onChange={e=>change({direction:e.target.value as DiscoveryOptions["direction"]})}>{["balanced","acclaimed","hidden","recent"].map(value=><option key={value} value={value}>{t(`games.pick.direction.${value}`)}</option>)}</select></label>
              <label>{t("games.platforms")}<select aria-label={t("games.platforms")} value={options.platform} onChange={e=>change({platform:e.target.value as DiscoveryOptions["platform"]})}>{[["all",t("games.allPlatforms")],["win","Windows"],["mac","macOS"],["linux","Linux"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
              <label>{t("games.pick.price")}<select aria-label={t("games.pick.price")} value={options.price} onChange={e=>change({price:e.target.value as DiscoveryOptions["price"]})}>{["all","free","offers"].map(value=><option key={value} value={value}>{t(`games.pick.price.${value}`)}</option>)}</select></label>
              <label className="game-picker-checkbox"><input type="checkbox" checked={options.controller} onChange={e=>change({controller:e.target.checked})}/>{t("games.pick.controller")}</label>
            </div>}
          </>}
          {step===1&&<>
            <label className="game-picker-search"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("games.pick.search")} aria-label={t("games.pick.search")} maxLength={120}/>{query&&<button onClick={()=>setQuery("")} aria-label={t("games.clear")}><X size={17}/></button>}</label>
            {searchBusy&&<div className="game-picker-search-skeleton" role="status" aria-label={t("common.loading")}>{[0,1,2].map(n=><i key={n}/>)}</div>}
            {!searchBusy&&search.length>0&&<div className="game-picker-search-results">{search.map(game=><button key={game.id} disabled={favorites.length>=5||favorites.some(f=>gameIdentities(f).some(id=>gameIdentities(game).includes(id)))} onClick={()=>addFavorite(game)}><GameArt src={game.capsule}/><span>{game.name}</span><span>+</span></button>)}</div>}
            {searchFailed&&<p role="status" className="game-picker-status">{t("games.pick.searchError")}</p>}
            {!searchBusy&&!searchFailed&&query.trim().length>=2&&!search.length&&<p className="game-picker-status">{t("games.pick.noSearch")}</p>}
            <div className="game-picker-favorites"><div><h4>{t("games.pick.favorites")}</h4><span>{favorites.length} / 5</span></div><div className="game-picker-seed-grid">
              {favorites.map(game=><div className="game-picker-seed" key={game.id}><GameArt src={game.portrait??game.capsule} fallback={game.capsule}/><span>{game.name}</span><button onClick={()=>removeFavorite(game)} aria-label={t("games.pick.remove",{name:game.name})}><X size={15}/></button></div>)}
              {!favorites.length&&<p>{t("games.pick.optional")}</p>}
            </div></div>
            <div className="game-picker-history"><label className="game-picker-checkbox"><input type="checkbox" checked={options.history} onChange={e=>change({history:e.target.checked})}/><span><strong>{t("games.pick.history")}</strong><small>{t("games.pick.historyNote")}</small></span></label>
              {signals.filter(s=>s.reason!=="favorite").length>0?<div className="game-picker-influences">{signals.filter(s=>s.reason!=="favorite").map(signal=><button key={signal.game.id} onClick={()=>addFavorite(signal.game)} disabled={favorites.length>=5} title={t("games.pick.addFavorite",{name:signal.game.name})}><GameArt src={signal.game.capsule}/><span><strong>{signal.game.name}</strong><small>{t(`games.pick.signal.${signal.reason}`)}{signal.minutes?` · ${Math.round(signal.minutes/60).toLocaleString(language)} ${t("games.pick.hours")}`:""}</small></span><Heart size={16}/></button>)}</div>:<p className="game-picker-status">{t(options.history?"games.pick.noHistory":"games.pick.manualOnly")}</p>}
              <p className="game-picker-fineprint">{t("games.pick.addedNote")}</p>
            </div>
          </>}
          {step===2&&<>
            {!!snapshot.current&&<div className="game-picker-summary"><span><SteamMark/>{t("games.pick.steamCatalog")}</span>{[...snapshot.current.tags,...snapshot.current.modes].map(tag=><span key={tag}>{tagName(tag,DISCOVERY_STYLES.find(t=>t[0]===tag)?.[2]??DISCOVERY_MODES.find(t=>t[0]===tag)?.[2])}</span>)}<button disabled={busy} onClick={()=>go(0)}>{t("games.pick.edit")}</button></div>}
            {busy&&!picks.length&&<div className="game-picker-results-skeleton" role="status" aria-label={t("games.pick.finding")}><div/><div className="game-picker-skeleton-line"/>{[0,1,2,3].map(n=><i key={n}/>)}</div>}
            {feed?.partial&&<div className="game-picker-status" role="status">{t("games.pick.partial")}<button disabled={busy} onClick={()=>void find(false)}>{t("common.retry")}</button></div>}
            {feed?.cachedAt&&<p className="game-picker-fineprint">{t("games.pick.cached",{date:new Date(feed.cachedAt).toLocaleDateString(language)})}</p>}
            {shown.slice(0,visible).some(pick=>pick.missingTags.length>0)&&<p className="game-picker-status" role="status">{t("games.pick.closest")}</p>}
            {shown[0]&&<GamePreviewTrigger className="game-picker-lead" game={shown[0].game} review={{...shown[0].game, reviews:shown[0].reviews}} active={active && !closing && step === 2}>{descriptionId => <><div className="game-picker-lead-art"><GameArt eager src={shown[0].hero??shown[0].game.capsule} fallback={shown[0].game.capsule}/></div><div className="game-picker-lead-copy"><span className="game-picker-kicker">{t("games.pick.startHere")}</span><GameHeroLogo key={shown[0].game.id} name={shown[0].game.name} steamId={shown[0].game.steamId} sources={NO_LOGOS} platformIds={NO_PLATFORMS} ready active={active} className="game-picker-logo"/><h4>{shown[0].game.name}</h4><PickerScore pick={shown[0]}/><p>{reason(shown[0])}</p>{missingTags(shown[0])}<div className="game-picker-match-tags">{shown[0].sharedTags.filter(tag=>tagName(tag)).map(tag=><span key={tag}>{tagName(tag)}</span>)}</div><div className="game-picker-lead-actions"><button className="game-picker-primary" aria-describedby={descriptionId} data-pick={shown[0].game.id} onClick={()=>viewGame(shown[0].game)}><Play size={18}/>{t("games.discovery.viewGame")}</button><button onClick={()=>hidePick(shown[0])}>{t("games.pick.notForMe")}</button></div></div><GamePosterSave game={shown[0].game}/></>}</GamePreviewTrigger>}
            {lastHidden&&<div className="game-picker-status" role="status">{t("games.pick.hidden",{name:lastHidden.game.name})}<button data-pick-undo onClick={()=>restoreHidden()}>{t("games.pick.undo")}</button></div>}
            <div className="game-picker-results">{shown.slice(1,visible).map((pick,index)=><article key={pick.game.id} style={{"--pick-order":Math.min(index,TIMING.maxStagger)} as React.CSSProperties}><GamePreviewTrigger className="game-picker-poster" game={pick.game} review={{...pick.game, reviews:pick.reviews}} active={active && !closing && step === 2}>{descriptionId => <><button aria-describedby={descriptionId} data-pick={pick.game.id} onClick={()=>viewGame(pick.game)} aria-label={pick.game.name}><GameArt src={pick.game.portrait??pick.game.capsule} fallback={pick.game.capsule}/><span className="game-picker-poster-play"><Play size={23}/></span></button><GamePosterSave game={pick.game}/></>}</GamePreviewTrigger><h4>{pick.game.name}</h4><PickerScore pick={pick}/><p>{reason(pick)}</p>{missingTags(pick)}<div className="game-picker-match-tags">{pick.sharedTags.filter(tag=>tagName(tag)).slice(0,2).map(tag=><span key={tag}>{tagName(tag)}</span>)}</div><button className="game-picker-dismiss" onClick={()=>hidePick(pick)}>{t("games.pick.notForMe")}</button></article>)}</div>
            {failed&&<div className="game-picker-empty" role="alert"><DiscoveryPickerIcon size={35}/><h4>{t("games.pick.error")}</h4><p>{t("games.pick.errorNote")}</p><button className="game-picker-primary" onClick={()=>void find(!!feed)}>{t("common.retry")}</button></div>}
            {!busy&&!failed&&feed&&!shown.length&&<div className="game-picker-empty"><DiscoveryPickerIcon size={35}/><h4>{t("games.pick.noMatches")}</h4><p>{t("games.pick.noMatchesNote")}</p><button className="game-picker-primary" onClick={()=>go(0)}>{t("games.pick.edit")}</button>{options.excluded.length>0&&<button onClick={()=>restoreHidden(true)}>{t("games.pick.resetHidden")}</button>}</div>}
            {(shown.length>visible||hasMore)&&!failed&&<div ref={continuation} className="game-picker-more" aria-busy={busy}>{busy&&<span role="status"><RefreshCw className="game-picker-spin" size={16}/>{t("games.pick.finding")}</span>}</div>}
            {feed&&<p className="game-picker-fineprint">{t("games.pick.rankingNote")}</p>}
          </>}
        </div>
      </div>
      <footer className="game-picker-footer">
        {saveFailed?<p role="status">{t("games.pick.saveError")}</p>:<p>{step===0?t("games.pick.selected",{count:options.tags.length+options.modes.length}):step===1?t("games.pick.favoriteCount",{count:favorites.length}):t("games.pick.resultsCount",{count:shown.length})}</p>}
        <div>{step>0&&<button className="game-picker-secondary" disabled={busy} onClick={()=>go(step-1)}>{t("common.back")}</button>}{step===0&&<button className="game-picker-secondary" onClick={()=>void find(false)}>{t("games.pick.quickFind")}</button>}{step<2&&(step===0?<button className="game-picker-primary" onClick={()=>go(1)}>{t("games.pick.addTaste")}<Heart size={17}/></button>:<button className="game-picker-primary" onClick={()=>void find(false)}><DiscoveryPickerIcon size={19}/>{t("games.pick.find")}</button>)}</div>
      </footer>
    </div>
  </ModalShell>;
}

function PickerScore({pick}:{pick:DiscoveryPick}) {
  const t=useT(),language=useUiLanguage();
  return <div className="game-picker-score">{pick.reviews?<span title={t("games.editorial.scoreNote",{score:pick.reviews.positive,count:pick.reviews.count.toLocaleString(language)})}><SteamMark/><strong>{pick.reviews.positive}%</strong><small>{t("games.pick.reviews",{count:pick.reviews.count.toLocaleString(language)})}</small></span>:<span>{t("games.pick.unrated")}</span>}{pick.owned&&<span><Check size={13}/>{t("games.pick.owned")}</span>}</div>;
}
