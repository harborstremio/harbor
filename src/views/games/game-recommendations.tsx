import { GameAvailabilityBadge } from "./game-availability";
import { observeWithin } from "@/lib/visibility";
import { Row } from "@/components/row";
import { Dropdown } from "@/components/dropdown";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Bookmark, Heart, History, RefreshCw, SlidersHorizontal, X } from "lucide-react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadRecommendationGames } from "@/lib/games/recommendation-source";
import type { RecommendationPool } from "@/lib/games/recommendation-pool";
import { buildRecommendationLibrary, chooseRecommendationSeeds, excludeRecommendationSeed, gameIdentities, hideRecommendation, rankRecommendations, readRecommendationPreferences, recommendationChoice, recommendationExclusions, recommendationPlatformNames, recommendationsForPlatform, restoreRecommendation, restoreRecommendationSeed, writeRecommendationPreferences, type RecommendationChoice, type RecommendationSeed, type RecommendationLibraryContext, type GameRecommendation } from "@/lib/games/recommendations";
import type { SteamInstall } from "@/lib/games/installed";
import type { EmulationStore } from "@/lib/games/emulation";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { Play } from "@/components/icons/play-filled";
import { ForYouMark, RecommendationRating, useRecommendationRatings } from "./game-recommendation-rating";
import { CATALOG_PAGE_SIZE } from "@/lib/games/catalog-filters";
import { pushBackHandler } from "@/lib/back-intercept";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";
import { RecommendationControls } from "./game-recommend-controls";
import { LibrarySourceMark } from "./game-library-marks";
import { GameDataStatus } from "./game-data-status";
import { oldestRecommendationObservation } from "@/lib/games/recommendation-pool";
import "./game-recommendations.css";
import "./game-rails.css";

type RelatedLoader = (game: GameSummary, signal?: AbortSignal, language?: string, offset?:number) => Promise<RecommendationPool | GameSummary[]>;

export function GameRecommendations({profile,saved,installed,emulation,libraryContext,active,open,save,browse,loadRelated=loadRecommendationGames}: {profile:string;saved:GameSummary[];installed:SteamInstall[];emulation:EmulationStore;libraryContext?:RecommendationLibraryContext;active:boolean;open:(game:GameSummary)=>void;save:(game:GameSummary)=>void;browse:()=>void;loadRelated?:RelatedLoader}) {
  const t=useT(),language=useUiLanguage(),[preferences,setPreferences]=useState(()=>readRecommendationPreferences(profile)),[settings,setSettings]=useState(false),[saveError,setSaveError]=useState(false);
  const [groups,setGroups]=useState<(RecommendationPool & {seed:RecommendationSeed; page:number})[]>([]),[failed,setFailed]=useState(false),[pending,setPending]=useState(true),[attempt,setAttempt]=useState(0),[near,setNear]=useState(false);
  const [railVersion,setRailVersion]=useState(0),row=useRef<HTMLDivElement>(null),grid=useRef<HTMLDivElement>(null),platformFilter=useRef<HTMLDivElement>(null);
  const [visibleCount,setVisibleCount]=useState(24),[sourcePage,setSourcePage]=useState(0);
  const extending=useRef(false);
  const [notice,setNotice]=useState<{kind:"hidden"|"excluded";choice:RecommendationChoice}|null>(null);
  const settingsButton=useRef<HTMLButtonElement>(null),undoButton=useRef<HTMLButtonElement>(null),retryButton=useRef<HTMLButtonElement>(null),settingsId=useId();
  const library=useMemo(()=>buildRecommendationLibrary(installed,emulation,libraryContext),[installed,emulation,libraryContext?.steam,libraryContext?.custom,libraryContext?.launchers]);
  const seeds=useMemo(()=>chooseRecommendationSeeds(saved,installed,emulation,preferences,library),[saved,library,preferences.saved,preferences.recent,preferences.excludedSeeds]);
  const seedKey=seeds.map(s=>`${s.game.id}:${s.reason}`).join("|");
  const known=useMemo(()=>recommendationExclusions(saved,library,preferences),[saved,library,preferences.hideSaved,preferences.hideLibrary]);
  const libraryIds=useMemo(()=>new Set(library.games.flatMap(gameIdentities)),[library]);
  const savedByIdentity=useMemo(()=>new Map(saved.flatMap(game=>gameIdentities(game).map(id=>[id,game] as const))),[saved]);
  // Rank each fetched page separately so appending a batch never reshuffles earlier cards.
  const allPicks=useMemo(()=>{
    const ranked:GameRecommendation[]=[],excluded=[...preferences.hidden];
    for(const page of [...new Set(groups.map(group=>group.page))].sort((a,b)=>a-b)){
      const batch=seeds.flatMap(seed=>{const group=groups.find(group=>group.page===page&&group.seed.game.id===seed.game.id);return group?[{...group,seed}]:[];});
      const picks=rankRecommendations(batch,known,excluded,Infinity);
      ranked.push(...picks);excluded.push(...picks.flatMap(pick=>gameIdentities(pick.game)));
    }
    return ranked;
  },[groups,known,preferences.hidden,seedKey]);
  const matchingPicks=useMemo(()=>recommendationsForPlatform(allPicks,preferences.platform),[allPicks,preferences.platform]);
  const picks=useMemo(()=>matchingPicks.slice(0,visibleCount),[matchingPicks,visibleCount]);
  const hasMore=matchingPicks.length>visibleCount||groups.some(group=>group.page===sourcePage&&group.nextOffset!=null);
  const ratings=useRecommendationRatings(picks.map(pick=>pick.game),active&&near);
  const cachedAt=oldestRecommendationObservation(...groups.filter(group=>seeds.some(seed=>seed.game.id===group.seed.game.id)).map(group=>group.cachedAt));
  const platforms=useMemo(()=>[...new Set([...allPicks.flatMap(pick=>recommendationPlatformNames(pick.game)),...(preferences.platform!=="all"?[preferences.platform]:[])])].sort((a,b)=>a.localeCompare(b,language)),[allPicks,preferences.platform,language]);
  useEffect(()=>{setPreferences(readRecommendationPreferences(profile));setGroups([]);setRailVersion(value=>value+1);setNotice(null);setSettings(false);},[profile]);
  useEffect(()=>{setGroups([]);setVisibleCount(24);setSourcePage(0);extending.current=false;},[profile,seedKey,language]);
  useEffect(()=>{setVisibleCount(24);},[preferences.platform]);
  useEffect(()=>{extending.current=false;},[pending,visibleCount]);
  const closeSettings=()=>{setSettings(false);settingsButton.current?.focus({preventScroll:true});};
  useEffect(()=>{
    if(!active||!settings)return;
    const removeBack=pushBackHandler(()=>{closeSettings();return true;});
    const onKey=(event:KeyboardEvent)=>{if(!isBackKey(event))return;event.preventDefault();event.stopImmediatePropagation();closeSettings();};
    window.addEventListener("keydown",onKey,true);
    return()=>{removeBack();window.removeEventListener("keydown",onKey,true);};
  },[active,settings]);
  useEffect(()=>{
    if(!active || !seeds.length){setPending(false);if(!seeds.length)setFailed(false);return;}
    if(!near){setPending(true);return;}
    const request=new AbortController();setPending(true);setFailed(false);
    // Publish a complete seed batch together so late providers cannot reshuffle cards under focus.
    void Promise.allSettled(seeds.map(async seed=>{
      const result=await loadRelated(seed.game,request.signal,language,sourcePage*CATALOG_PAGE_SIZE);
      return {...(Array.isArray(result)?{games:result,nextOffset:null}:result),seed,page:sourcePage};
    })).then(results=>{
      if(request.signal.aborted)return;
      const retryHadFocus=retryButton.current===document.activeElement;
      setGroups(previous=>[...previous.filter(group=>group.page!==sourcePage),...seeds.flatMap((seed,index)=>{
        const result=results[index];
        if(result.status==="fulfilled")return [result.value];
        const held=previous.find(group=>group.page===sourcePage&&group.seed.game.id===seed.game.id);
        return held?[held]:[];
      })]);
      setPending(false);setFailed(results.some(result=>result.status==="rejected"||result.value.partial));
      if(retryHadFocus)requestAnimationFrame(()=>{
        if(document.activeElement!==document.body)return;
        (grid.current?.querySelector<HTMLButtonElement>(".games-recommendation-open")??platformFilter.current?.querySelector<HTMLButtonElement>("button")??settingsButton.current)?.focus({preventScroll:true});
      });
    });
    return()=>request.abort();
  },[active,near,seedKey,attempt,profile,loadRelated,language,sourcePage]);
  useEffect(()=>{const node=row.current;if(!node)return;return observeWithin(node, "450px", entry => { if (entry.isIntersecting) setNear(true); });},[]);
  const update=(next:typeof preferences,resetPage=false)=>{try{writeRecommendationPreferences(profile,next);setPreferences(next);setSaveError(false);if(resetPage||next.saved!==preferences.saved||next.recent!==preferences.recent||next.hideLibrary!==preferences.hideLibrary||next.hideSaved!==preferences.hideSaved||next.platform!==preferences.platform)setRailVersion(value=>value+1);return true;}catch{setSaveError(true);return false;}};
  const retry=()=>{if(!pending)setAttempt(value=>value+1);};
  const morePicks=()=>{
    if(pending||extending.current||!hasMore)return;
    extending.current=true;
    setVisibleCount(value=>value+24);
    if(matchingPicks.length<=visibleCount){setPending(true);setSourcePage(value=>value+1);}
  };
  const clearPlatform=()=>{if(update({...preferences,platform:"all"}))requestAnimationFrame(()=>platformFilter.current?.querySelector("button")?.focus({preventScroll:true}));};
  const allExcluded=!seeds.length&&preferences.excludedSeeds.length>0&&chooseRecommendationSeeds(saved,installed,emulation,{...preferences,excludedSeeds:[]},library).length>0;
  const focusCard=(index:number)=>requestAnimationFrame(()=>{
    const buttons=grid.current?.querySelectorAll<HTMLButtonElement>(".games-recommendation-open");
    (buttons?.[Math.min(index,(buttons?.length??0)-1)]??undoButton.current??settingsButton.current)?.focus();
  });
  const hide=(game:GameSummary)=>{
    const index=picks.findIndex(pick=>pick.game.id===game.id);
    if(!update(hideRecommendation(preferences,game)))return;
    setNotice({kind:"hidden",choice:recommendationChoice(game)});focusCard(Math.max(0,index));
  };
  const exclude=(game:GameSummary)=>{
    const index=seeds.findIndex(seed=>seed.game.id===game.id);
    if(!update(excludeRecommendationSeed(preferences,game),true))return;
    setNotice({kind:"excluded",choice:recommendationChoice(game)});
    requestAnimationFrame(()=>{const buttons=row.current?.querySelectorAll<HTMLButtonElement>(".games-recommend-seed button");(buttons?.[Math.min(index,(buttons?.length??0)-1)]??row.current?.querySelector<HTMLElement>(".games-recommend-history summary")??settingsButton.current)?.focus({preventScroll:true});});
  };
  const restore=(choice:RecommendationChoice,kind:"hidden"|"excluded")=>{
    if(!update(kind==="hidden"?restoreRecommendation(preferences,choice):restoreRecommendationSeed(preferences,choice),kind==="excluded"))return;
    if(notice?.kind===kind&&choice.identities.some(id=>notice.choice.identities.includes(id)))setNotice(null);
  };
  const undo=()=>{
    if(!notice)return;
    const next=notice.kind==="hidden"?restoreRecommendation(preferences,notice.choice):restoreRecommendationSeed(preferences,notice.choice);
    if(!update(next))return;
    setNotice(null);
    requestAnimationFrame(()=>{
      const buttons=notice.kind==="excluded"?row.current?.querySelectorAll<HTMLButtonElement>(".games-recommend-seed button"):grid.current?.querySelectorAll<HTMLButtonElement>(".games-recommendation-open");
      const restored=[...buttons??[]].find(button=>notice.choice.identities.includes((notice.kind==="excluded"?button.dataset.recommendSeed:button.dataset.game)??""));
      (restored??settingsButton.current)?.focus();
    });
  };
  return <section className="games-recommendations games-inset" ref={row}>
    <div className="games-section-heading"><div><div className="games-section-kicker"><ForYouMark/>{t("games.recommend.forYou")}</div><h2>{t("games.recommend.title")}</h2><p>{t("games.recommend.note")}</p></div><div className="games-recommend-heading-actions">{hasMore&&<button className="games-button games-more-picks" disabled={pending} onClick={morePicks}><RefreshCw size={16}/>{t("games.recommend.morePicks")}</button>}<button className="games-icon-button" ref={settingsButton} onClick={()=>setSettings(!settings)} aria-expanded={settings} aria-controls={settingsId} aria-label={t("games.recommend.tune")} title={t("games.recommend.tune")}><SlidersHorizontal size={18}/></button></div></div>
    {settings && <div id={settingsId}><RecommendationControls preferences={preferences} seeds={seeds} update={update} exclude={exclude} restoreHidden={choice=>restore(choice,"hidden")} restoreSeed={choice=>restore(choice,"excluded")} close={closeSettings} libraryNote={library.steamSyncedAt?t("games.recommend.steamSynced",{date:new Date(library.steamSyncedAt*1000).toLocaleString(language,{dateStyle:"medium",timeStyle:"short"})}):t("games.recommend.steamUnavailable")}/></div>}
    {!seeds.length ? <div className="games-recommend-start"><div className="games-recommend-start-art"><Bookmark size={26}/><i/><i/></div><div><h3>{t(allExcluded?"games.recommend.allExcluded":"games.recommend.empty")}</h3><p>{t(!preferences.saved&&!preferences.recent?"games.recommend.signalsOff":allExcluded?"games.recommend.allExcludedNote":"games.recommend.emptyNote")}</p></div><button className="games-button" onClick={allExcluded?()=>setSettings(true):browse}>{t(allExcluded?"games.recommend.tune":"games.catalog.browse")}</button></div> : <>
      <div className="games-recommend-platform-filter" ref={platformFilter}><Dropdown value={preferences.platform} onChange={platform=>update({...preferences,platform})} ariaLabel={t("games.recommend.platform")} size="sm" options={[{value:"all",label:t("games.recommend.allPlatforms")},...platforms.map(platform=>({value:platform,label:platform}))]}/></div>
      <div ref={grid} className="games-recommend-picks" aria-busy={pending}><Row key={railVersion} className="games-content-rail" min={180} shape="portrait" alwaysActive arrowsAlways onEndReached={()=>{if(!failed)morePicks();}} scrollKey={`games:recommendations:${profile}:${preferences.platform}:${railVersion}`}>
        {picks.map(({game,seed})=>{
          const aliases=gameIdentities(game),savedGame=aliases.map(id=>savedByIdentity.get(id)).find(Boolean),inLibrary=aliases.some(id=>libraryIds.has(id));
          const platformNames=recommendationPlatformNames(game).sort((a,b)=>Number(b===preferences.platform)-Number(a===preferences.platform)).join(" · ");
          return <article className="games-recommendation" key={game.id}>
            <div className="games-recommend-poster">
            <button className="games-recommendation-open" onClick={()=>open(game)} data-game={game.id} aria-label={game.name}>
              <div className="games-recommend-art"><GameArt src={game.portrait??game.capsule} fallback={game.capsule}/><GameAvailabilityBadge game={game}/><span className="games-recommend-enter"><Play size={20}/></span></div>
            </button>
            <div className="games-recommend-card-actions">
              <button className="games-icon-button" onClick={()=>save(savedGame??game)} aria-pressed={!!savedGame} aria-label={t(savedGame?"games.recommend.removeSaved":"games.recommend.save",{name:game.name})} title={t(savedGame?"games.recommend.removeSaved":"games.recommend.save",{name:game.name})}><Heart size={16} fill={savedGame?"currentColor":"none"}/></button>
              <button className="games-icon-button" onClick={()=>hide(game)} aria-label={t("games.recommend.hide",{name:game.name})} title={t("games.recommend.hideShort")}><X size={16}/></button>
            </div>
            <RecommendationRating rating={ratings[game.id]} open={()=>open(game)}/>
            </div>
            <h3><button onClick={()=>open(game)} tabIndex={-1}>{game.name}</button></h3>
            <p className="games-recommend-platforms" title={platformNames}>{recommendationPlatformNames(game).slice(0,2).join(" · ")}{recommendationPlatformNames(game).length>2?` +${recommendationPlatformNames(game).length-2}`:""}</p>
            {inLibrary&&<span className="games-recommend-library-mark"><LibrarySourceMark source="all" size={13}/>{t("games.recommend.inLibrary")}</span>}
            <button className="games-recommend-reason" onClick={()=>open(seed.game)} title={`${t(`games.recommend.because.${seed.reason}`)} ${seed.game.name}`} aria-label={`${t(`games.recommend.because.${seed.reason}`)} ${seed.game.name}`}>{seed.reason==="saved"?<Bookmark size={13}/>:<History size={13}/>}<span>{t("games.recommend.like")} <strong>{seed.game.name}</strong></span></button>
          </article>;
        })}
        {pending && !failed && Array.from({length:5},(_,index)=><div className="games-recommend-skeleton" key={index} aria-hidden="true"><i/><b/><span/><small/></div>)}
      </Row></div>
      {!picks.length && (!pending||failed) && <div className="games-recommend-empty"><h3>{t(failed?"games.recommend.unavailable":"games.recommend.caughtUp")}</h3><p>{t(failed?"games.recommend.retryNote":preferences.platform!=="all"?"games.recommend.noPlatformGames":"games.recommend.caughtUpNote")}</p>{failed && <button ref={retryButton} className="games-button" aria-disabled={pending} onClick={retry}>{t("common.retry")}</button>}{preferences.platform!=="all"&&<button className="games-button" onClick={clearPlatform}>{t("games.recommend.allPlatforms")}</button>}{preferences.hidden.length>0 && <button className="games-button" onClick={()=>{if(update({...preferences,hidden:[],hiddenGames:[]})&&notice?.kind==="hidden")setNotice(null);}}>{t("games.recommend.reset")}</button>}</div>}
      <div className="games-recommend-provenance"><span role={pending?"status":undefined}>{t(pending?"games.recommend.finding":"games.recommend.source")}</span>{failed && picks.length>0 && <button ref={retryButton} aria-disabled={pending} onClick={retry}>{t("games.recommend.retrySome")}</button>}</div>
      <GameDataStatus at={cachedAt}/>
    </>}
    {notice&&<div className="games-recommend-notice"><span role="status">{t(notice.kind==="hidden"?"games.recommend.hiddenNotice":"games.recommend.excludedNotice",{name:notice.choice.name})}</span><button ref={undoButton} onClick={undo} aria-label={t("games.recommend.undoLabel",{name:notice.choice.name})}>{t("games.recommend.undo")}</button></div>}
    {saveError && <p role="alert">{t("games.recommend.saveError")}</p>}
  </section>;
}
