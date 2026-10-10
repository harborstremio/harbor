import { NavChevron } from "@/components/nav-arrow";
import { observeWithin } from "@/lib/visibility";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { FEATURED_STUDIOS, loadStudioProfile, readStudioProfileSnapshot, searchStudios, readStudioSearchSnapshot, type StudioProfile } from "@/lib/games/studios";
import type { AtlasRoute, GameConnection } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { savedMetadataAt } from "@/lib/games/metadata-records";
import { GameDataStatus } from "./game-data-status";
import { useLiveRefresh } from "./use-live-refresh";
import { GameStudioGames, GameStudioShelfSkeleton } from "./game-studio-games";
import { GameStudioRelations } from "./game-studio-relations";
import { StudioLogo } from "./game-studio-logo";

const studioRoute = (studio: GameConnection): AtlasRoute => ({kind:"company",...studio,includeSubsidiaries:true});
export function StudioFamily({profile,browse}:{profile:StudioProfile;browse:(route:AtlasRoute)=>void}) {
  const t=useT();
  return <>{profile.parent&&<div className="games-studio-parent"><span>{t("games.studios.partOf")}</span><button onClick={()=>browse(studioRoute(profile.parent!))}><StudioLogo studio={profile.parent}/>{profile.parent.name}</button></div>}
    {!!profile.children.length&&<div className="games-studio-family"><span>{t("games.studios.related")}</span>{profile.children.map(child=><button key={child.id} onClick={()=>browse(studioRoute(child))}><StudioLogo studio={child}/><span>{child.name}</span></button>)}</div>}</>;
}
export function GameStudios({active,open,browse}:{active:boolean;open:(game:GameSummary)=>void;browse:(route:AtlasRoute)=>void}) {
  const t=useT(),root=useRef<HTMLElement>(null),[seen,setSeen]=useState(false),[selected,setSelected]=useState<number>(139),[profiles,setProfiles]=useState<StudioProfile[]>([]),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  const [studioPage,setStudioPage]=useState(0);
  const revision = useLiveRefresh(active && seen, 31 * 60_000);
  const [studioSlots,setStudioSlots]=useState(6),selectedStudio=useRef(selected);selectedStudio.current=selected;
  const visibleStudios=FEATURED_STUDIOS.slice(studioPage*studioSlots,studioPage*studioSlots+studioSlots),studioPages=Math.ceil(FEATURED_STUDIOS.length/studioSlots);
  const changeStudioPage=(page:number)=>{setStudioPage(page);setSelected(FEATURED_STUDIOS[page*studioSlots].id);};
  useEffect(()=>{const node=root.current;if(!node)return;const measure=()=>{const style=getComputedStyle(node),width=node.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),slots=Math.max(2,Math.min(6,Math.floor(width/160)));setStudioSlots(slots);const index=FEATURED_STUDIOS.findIndex(studio=>studio.id===selectedStudio.current);setStudioPage(Math.floor(Math.max(0,index)/slots));};measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
  const [query,setQuery]=useState(""),[results,setResults]=useState<GameConnection[]>([]),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState(false);
  useEffect(()=>{const node=root.current;if(!node)return;return observeWithin(node, "1000px", entry => { if (entry.isIntersecting) setSeen(true); });},[]);
  useEffect(() => {
    if (!active || !seen) return;
    const request = new AbortController(); setFailed(false);
    const needed = visibleStudios.filter(studio => studio.id === selected && (attempt > 0 || revision > 0 || !profiles.some(profile => profile.id === studio.id)));
    const fetchProfile = (studio: typeof FEATURED_STUDIOS[number]) => {
      let received = false;
      void readStudioProfileSnapshot(studio.id).then(profile => {
        if (profile && !received && !request.signal.aborted) setProfiles(previous => previous.some(value => value.id === profile.id) ? previous : [...previous, profile]);
      });
      return loadStudioProfile(studio.id, request.signal).then(profile => {
        received = true;
        if (!request.signal.aborted) setProfiles(previous => [...previous.filter(value => value.id !== profile.id), profile]);
      });
    };
    // Finish the selected company's related queries before background logo/catalog work.
    // IGDB is serialized by the shared pool, so enqueueing the whole row delays its feature.
    void (async () => {
      const lead = needed.find(studio => studio.id === selected);
      const leading = lead ? await Promise.allSettled([fetchProfile(lead)]) : [];
      if (request.signal.aborted) return;
      if (leading.some(result => result.status === "rejected")) setFailed(true);

    })();
    return () => request.abort();
  }, [active, seen, attempt, selected, studioPage, studioSlots, revision]);
  useEffect(()=>{
    if(!active||query.trim().length<2){setResults([]);setSearching(false);return;}
    const request=new AbortController();let received=false;setSearching(true);setSearchError(false);setResults([]);
    void readStudioSearchSnapshot(query).then(value=>{if(value&&!received&&!request.signal.aborted)setResults(value);});
    const timer=setTimeout(()=>void searchStudios(query,request.signal).then(value=>{received=true;if(!request.signal.aborted)setResults(value);},()=>{if(!request.signal.aborted)setSearchError(true);}).finally(()=>{if(!request.signal.aborted)setSearching(false);}),300);
    return()=>{clearTimeout(timer);request.abort();};
  },[query,active,attempt,revision]);
  const profile=profiles.find(value=>value.id===selected);
  useEffect(()=>{
    const next=FEATURED_STUDIOS[(studioPage+1)*studioSlots];
    if(!active||!seen||!profile||!next||profiles.some(item=>item.id===next.id))return;
    const request=new AbortController();
    const timer=setTimeout(()=>{void loadStudioProfile(next.id,request.signal,false).then(value=>{if(!request.signal.aborted)setProfiles(old=>old.some(item=>item.id===value.id)?old:[...old,value]);},()=>{});},1000);
    return()=>{request.abort();clearTimeout(timer);};
  },[active,seen,studioPage,studioSlots,profile?.id,profiles]);
  const explore=()=>{if(profile)browse({...studioRoute(profile),description:profile.description,related:profile.children});};
  return <section className="games-section games-inset games-studios" ref={root}>
    <div className="games-section-heading"><div><h2>{t("games.studios.title")}</h2><p>{t("games.studios.note")}</p></div><div className="games-search games-studio-search"><Search size={16}/><input aria-label={t("games.studios.search")} placeholder={t("games.studios.search")} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="games-icon-button" aria-label={t("games.clear")} onClick={()=>setQuery("")}><X size={15}/></button>}</div></div>
    {query.trim().length>=2?<div className="games-studio-search-results" aria-busy={searching}>{searching&&!results.length?<p role="status">{t("common.loading")}</p>:searchError?<p role="alert">{t("games.studios.error")} <button className="games-button" onClick={()=>setAttempt(n=>n+1)}>{t("common.retry")}</button></p>:results.length?results.map(studio=><button key={studio.id} onClick={()=>browse(studioRoute(studio))}><StudioLogo studio={studio}/><strong>{studio.name}</strong></button>):<p role="status">{t("games.studios.empty")}</p>}</div>:<>
      <div className="games-studio-navigation"><span>{t("games.studios.featured")}</span><div className="games-page-controls"><span>{studioPage+1} / {studioPages}</span><button className="games-icon-button" aria-label={t("games.studios.previous")} disabled={!studioPage} onClick={()=>changeStudioPage(studioPage-1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" aria-label={t("games.studios.next")} disabled={studioPage===studioPages-1} onClick={()=>changeStudioPage(studioPage+1)}><NavChevron dir="right" size={18}/></button></div></div>
      <div className="games-studio-tabs" style={{gridTemplateColumns:`repeat(${studioSlots},minmax(0,1fr))`}} aria-label={t("games.studios.choose")}>{visibleStudios.map(studio=>{const loaded=profiles.find(value=>value.id===studio.id)??studio;return <button key={studio.id} aria-pressed={selected===studio.id} onClick={()=>setSelected(studio.id)}><StudioLogo studio={loaded}/><span>{studio.name}</span></button>;})}</div>
      <div className="games-studio-catalog" key={selected}>{profile?<><div className="games-studio-intro"><div><h3>{profile.name}</h3><p>{profile.description}</p></div><button className="games-text-action" onClick={explore}>{t("games.studios.explore")}</button></div><GameStudioGames key={profile.id} profile={profile} open={open} active={active}/></>:<><div className="games-studio-intro" aria-busy={!failed}>{failed?<div role="alert"><span>{t("games.studios.error")}</span><button className="games-button" onClick={()=>setAttempt(n=>n+1)}>{t("common.retry")}</button></div>:<span role="status">{t("common.loading")}</span>}</div><GameStudioShelfSkeleton/></>}</div>
      <GameStudioRelations profile={profile} browse={browse}/>
    </>}
    <div className="games-studio-footer"><p className="games-feed-source">{t("games.studios.source")}</p><GameDataStatus at={query.trim().length >= 2 ? savedMetadataAt(results) : profile?.cachedAt} refresh={() => setAttempt(value => value + 1)} /></div>
  </section>;
}

export function GameStudioHeading({route,active,browse,showStatus=true}:{route:AtlasRoute;active:boolean;browse:(route:AtlasRoute)=>void;showStatus?:boolean}) {
  const t=useT(),[profile,setProfile]=useState<StudioProfile|null>(null),[expanded,setExpanded]=useState(false),[attempt,setAttempt]=useState(0);
  const revision = useLiveRefresh(active, 31 * 60_000);
  useEffect(()=>{setProfile(null);setExpanded(false);},[route.id]);
  useEffect(()=>{
    if(!active||!route.id)return;const request=new AbortController();let received=false;
    void readStudioProfileSnapshot(route.id).then(value=>{if(value&&!received&&!request.signal.aborted)setProfile(previous=>previous??value);});
    void loadStudioProfile(route.id,request.signal).then(value=>{received=true;if(!request.signal.aborted)setProfile(value);},()=>{});return()=>request.abort();
  },[route.id,active,attempt,revision]);
  const studio=profile?.id===route.id?profile:null,description=studio?.description??route.description??"",cover=studio?.games.find(game=>game.screenshots.length)?.screenshots[0];
  return <div className="games-studio-destination">
    <div className="games-studio-banner">{cover&&<GameArt className="games-studio-banner-art" src={cover}/>}<div className="games-studio-banner-shade"/>
      <div className="games-studio-banner-copy"><StudioLogo studio={studio??{id:route.id!,name:route.name,image:route.image}} className="games-studio-logo"/><span className="games-section-kicker">{t("games.atlas.kind.company")}</span><h1>{route.name}</h1><p className={expanded?"is-expanded":""}>{description||t("games.studios.catalogNote")}</p>{description.length>240&&<button className="games-text-action" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{t(expanded?"games.studios.less":"games.studios.about")}</button>}</div>
    </div>
    {studio&&<StudioFamily profile={studio} browse={browse}/>}
    {showStatus && <GameDataStatus at={studio?.cachedAt} refresh={() => setAttempt(value => value + 1)} />}
  </div>;
}
