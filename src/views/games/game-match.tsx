import { useSettings } from "@/lib/settings";
import { artworkImportPolicy, prepareImportedArtwork, reviewImportedArtwork } from "@/lib/games/imported-artwork";
import { backgroundArtwork, type LibraryArtwork } from "@/lib/games/igdb-artwork";
import { GameArtworkPicker } from "./game-artwork-picker";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { loadAtlasGame, loadMetadataMatches } from "@/lib/games/atlas";
import type { AtlasGame } from "@/lib/games/igdb-data";
import { mergeMetadataMatches, metadataMatchType, metadataMatchYear } from "@/lib/games/metadata-matching";
import { EMULATION_SYSTEMS, localSearchName, type LocalGame } from "@/lib/games/emulation";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import "./game-match.css";

export function GameMatch({ game, onMatch, onClose, platform, metadataOnly=false, error, localCover }: { game:Pick<LocalGame,"path"|"name"|"system"|"linked">; onMatch:(value:GameSummary|null)=>boolean|Promise<boolean>; onClose:()=>void; platform?:{id:number;name:string;short:string}; metadataOnly?:boolean; error?:string; localCover?:boolean }) {
  const t=useT(), titleId=useId(), {settings}=useSettings();
  const {closing,close}=useModalExit(onClose);
  const [query,setQuery]=useState(localSearchName(game.name));
  const [attempt,setAttempt]=useState(0);
  const [state,setState]=useState<{games:AtlasGame[];loading:boolean;error:boolean;next:number|null}>({games:[],loading:true,error:false,next:null});
  const [selected,setSelected]=useState<GameSummary|null>(null);
  const [saveError,setSaveError]=useState(false), [artworkError,setArtworkError]=useState(false);
  const [saving,setSaving]=useState(false);
  const [artReview,setArtReview]=useState<{game:GameSummary;screenshots:boolean}|null>(null);
  const prepared=useRef<{game:GameSummary;review:boolean;screenshots:boolean}|null>(null), artworkRequest=useRef<AbortController|null>(null);
  const body=useRef<HTMLDivElement>(null), input=useRef<HTMLInputElement>(null);
  const moreRequest=useRef<AbortController|null>(null);
  const system=platform??EMULATION_SYSTEMS.find(s=>s.id===game.system);
  const [thisPlatform,setThisPlatform]=useState(!!system);
  const platformId=thisPlatform?system?.id:undefined;
  const dismiss=()=>{if(!saving)close();};
  useSectionBack(dismiss,!artReview);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    input.current?.focus({preventScroll:true});
    const dialog=body.current?.closest<HTMLElement>('[role="dialog"]');
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=="Tab"||!dialog||[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1)!==dialog)return;
      const items=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')].filter(item=>item.getClientRects().length);
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",trap);
    return()=>{document.removeEventListener("keydown",trap);previous?.focus({preventScroll:true});moreRequest.current?.abort();artworkRequest.current?.abort();};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    moreRequest.current?.abort();prepared.current=null;setSelected(null);setSaveError(false);
    setState({games:[],loading:true,error:false,next:null});
    const timer=setTimeout(()=>{
      void loadMetadataMatches(query,platformId,0,controller.signal).then(page=>{
        if(!controller.signal.aborted)setState({games:page.games,loading:false,error:false,next:page.nextOffset});
      },()=>{if(!controller.signal.aborted)setState({games:[],loading:false,error:true,next:null});});
    },280);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,attempt,platformId]);
  const more=async()=>{
    if(state.loading||state.next===null)return;
    const controller=new AbortController();moreRequest.current=controller;
    setState(s=>({...s,loading:true,error:false}));
    try {
      const page=await loadMetadataMatches(query,platformId,state.next,controller.signal);
      if(!controller.signal.aborted)setState(s=>({games:mergeMetadataMatches(s.games,page.games),loading:false,error:false,next:page.nextOffset}));
    }catch{if(!controller.signal.aborted)setState(s=>({...s,loading:false,error:true}));}
  };
  const commit=async(value:GameSummary|null)=>{const ok=await onMatch(value);if(ok)close();else setSaveError(true);return ok;};
  const apply=async(value:GameSummary|null)=>{
    if(saving)return;setSaving(true);setSaveError(false);setArtworkError(false);
    const controller=new AbortController();artworkRequest.current=controller;
    try {
      if(!value){await commit(null);return;}
      if(prepared.current?.game.igdbId!==value.igdbId){
        const detail=await loadAtlasGame({...value,id:`igdb:${value.igdbId}`},controller.signal);
        if(controller.signal.aborted)return;
        if(!detail||detail.igdbId!==value.igdbId)throw Error("metadata_artwork_missing");
        const policy=artworkImportPolicy(settings),images=detail.artwork??[];
        prepared.current={game:{...value,id:`igdb:${value.igdbId}`,importedArtwork:prepareImportedArtwork(detail.igdbId,images,policy)},review:policy.selection==="manual"&&backgroundArtwork(images,policy.screenshots).length>1,screenshots:policy.screenshots};
      }
      const next=prepared.current!;
      if(next.review)setArtReview({game:next.game,screenshots:next.screenshots});
      else await commit(next.game);
    } catch {if(!controller.signal.aborted){setSaveError(true);setArtworkError(!!value&&prepared.current?.game.igdbId!==value.igdbId);}}
    finally{if(!controller.signal.aborted)setSaving(false);}
  };
  const reviewedChoice:LibraryArtwork|undefined=artReview?.game.importedArtwork&&(artReview.game.importedArtwork.cover||artReview.game.importedArtwork.background)?{binding:`igdb:${artReview.game.igdbId}`,igdbId:artReview.game.igdbId!,cover:artReview.game.importedArtwork.cover,background:artReview.game.importedArtwork.background??undefined}:undefined;
  const closeArtworkReview=()=>{setArtReview(null);if(!closing)requestAnimationFrame(()=>body.current?.querySelector<HTMLElement>("footer .games-button-primary")?.focus({preventScroll:true}));};
  return <><ModalShell closing={closing} onDismiss={dismiss} width={760} labelledBy={titleId} backdropClassName="games-match-backdrop">
    <div className="games-match" ref={body}>
      <header><div><span className="games-section-kicker">IGDB</span><h2 id={titleId}>{t("games.match.title")}</h2></div><button className="games-icon-button" onClick={dismiss} disabled={saving} aria-label={t("common.close")}><X size={19}/></button></header>
      <p className="games-match-filename" title={game.path}>{game.name}</p>
      <div className="games-search"><Search size={17}/><input ref={input} value={query} disabled={saving} onChange={event=>{setSelected(null);setQuery(event.target.value);}} aria-label={t("games.metadata.search")} placeholder={t("games.metadata.search")}/>{query&&<button className="games-icon-button" disabled={saving} onClick={()=>{setSelected(null);setQuery("");input.current?.focus();}} aria-label={t("games.clear")}><X size={16}/></button>}</div>
      {system&&<div className="games-match-platforms"><button className="games-button" disabled={saving} aria-pressed={thisPlatform} onClick={()=>{setSelected(null);setThisPlatform(true);}}>{system.name}</button><button className="games-button" disabled={saving} aria-pressed={!thisPlatform} onClick={()=>{setSelected(null);setThisPlatform(false);}}>{t("games.allPlatforms")}</button></div>}
      <div className="games-match-scroll">
        <p className="games-match-note">{t(metadataOnly?"games.metadata.note":"games.match.note")}</p>
        <div className="games-match-results" aria-busy={state.loading}>{state.games.map(item=><button key={item.igdbId} disabled={saving} aria-pressed={selected?.igdbId===item.igdbId} onClick={()=>{if(selected?.igdbId!==item.igdbId)prepared.current=null;setSelected(item);}}><span className="games-match-art"><GameArt src={item.portrait||item.capsule}/>{selected?.igdbId===item.igdbId&&<i><Check size={16}/></i>}</span><span className="games-match-context"><strong>{item.name}</strong><small>{[metadataMatchYear(item),metadataMatchType(item,t),`IGDB ${item.igdbId}`].filter(value=>value!==undefined).join(" · ")}</small>{!!item.platforms.length&&<small>{item.platforms.join(" · ")}</small>}{!!item.developers.length&&<small>{item.developers.map(company=>company.name).join(" · ")}</small>}</span></button>)}</div>
        {state.loading&&!state.games.length&&<div className="games-match-results games-match-skeleton" aria-label={t("common.loading")}>{Array.from({length:4},(_,i)=><span key={i}><i/><b/><small/></span>)}</div>}
        {state.error&&<div className="games-match-state" role="alert"><p>{t("games.atlas.error")}</p><button className="games-button" onClick={()=>state.games.length?void more():setAttempt(v=>v+1)}>{t("common.retry")}</button></div>}
        {!state.loading&&!state.error&&!state.games.length&&<div className="games-match-state"><p>{t("games.noResults")}</p><span>{t("games.match.empty")}</span></div>}
        {state.next!==null&&!state.error&&<button className="games-button games-catalog-more" disabled={state.loading} onClick={()=>void more()}>{t(state.loading?"common.loading":"games.catalog.more")}</button>}
      </div>
      {saveError&&<p className="games-match-error" role="alert">{t(artworkError?"games.artwork.importError":error||"games.saveError")}</p>}
      <footer>{game.linked?<button className="games-button" disabled={saving} onClick={()=>void apply(null)}>{t("games.match.remove")}</button>:<span>{t("games.match.source")}</span>}<button className="games-button games-button-primary" disabled={!selected||saving} onClick={()=>selected&&void apply(selected)}><Check size={16}/>{t(saving?"common.loading":"games.match.use")}</button></footer>
    </div>
  </ModalShell>{artReview&&<GameArtworkPicker game={artReview.game} binding={`igdb:${artReview.game.igdbId}`} value={reviewedChoice} screenshots={artReview.screenshots} allowReset={false} localCover={localCover} error={error} onSave={async choice=>commit({...artReview.game,importedArtwork:reviewImportedArtwork(artReview.game.importedArtwork!,choice)})} onClose={closeArtworkReview}/>}</>;
}
