import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Copy, File, Link2, LoaderCircle, SlidersHorizontal, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { copyText } from "@/components/player/copy-link-button";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { torrentError, torrentFolder, torrentSelection, torrentSpace, type GameTorrent, type TorrentPlan } from "@/lib/games/torrents";
import { transferBytes } from "@/lib/games/transfers";
import { MAGNET_MAX_BYTES } from "@/lib/games/magnet";
import { preparationError, preparationDraft, preparationOptions, type PreparationForm } from "@/lib/games/download-preparation";
import { GamePreparationOptions } from "./game-preparation-options";
import type { GameTorrents } from "@/hooks/use-game-torrents";
import { TorrentFiles, TorrentReviewSkeleton } from "./game-torrent-files";
import { TorrentDestination } from "./game-torrent-destination";
import "./game-torrent.css";

// Step storyboard: content settles over 200ms; the shell finishes opening at
// 320ms. Exit uses Harbor's shared modal timing. Reduced motion skips both.
const STEP_MOTION={duration:320,easing:"cubic-bezier(.22,1,.36,1)"};

export function GameTorrentDialog({ torrents, source: initialSource, onClose, onStarted }: { torrents: GameTorrents; source: string; onClose: () => void; onStarted?: (record:GameTorrent)=>void }) {
  const t=useT(), id=useId(), root=useRef<HTMLDivElement>(null), started=useRef<GameTorrent|null>(null), profile=torrents.profile;
  const finish=useCallback(()=>{onClose();if(started.current)onStarted?.(started.current);},[onClose,onStarted]);
  const {closing,close}=useModalExit(finish);
  const [source,setSource]=useState(initialSource), [plan,setPlan]=useState<TorrentPlan|null>(null), [parent,setParent]=useState(""), [name,setName]=useState("");
  const [selected,setSelected]=useState(new Set<number>()), [download,setDownload]=useState(0), [upload,setUpload]=useState(1024*1024);
  const [busy,setBusy]=useState<"pick"|"inspect"|"start"|null>(null), [error,setError]=useState(""), [copied,setCopied]=useState(false), [insufficient,setInsufficient]=useState(false);
  const [preparation,setPreparation]=useState<PreparationForm>({enabled:false}),[preparationBrowsing,setPreparationBrowsing]=useState(false);
  const options=useMemo(()=>preparationOptions((plan?.files??[]).filter(file=>!file.padding).map(file=>({path:file.path,selected:selected.has(file.index)}))),[plan,selected]);
  const unpack=preparationDraft(preparation,options,parent,"torrent",name=>t("games.preparation.folder",{name}));
  const invalidPreparation=preparation.enabled&&(!options.length||!unpack);
  useEffect(()=>{if(!options.length)setPreparation({enabled:false});},[options.length]);
  const live=useRef(true), pending=useRef(false), operation=useRef(""), token=useRef(""), closingRef=useRef(false);closingRef.current=closing;
  const lastHeight=useRef(0), heightAnimation=useRef<Animation|null>(null);
  const stage=plan?"review":busy==="inspect"?"loading":"source";
  const discard=()=>{const held=token.current;token.current="";if(held)void invoke("games_discard_torrent",{profile,token:held}).catch(()=>{});};
  const cancel=()=>{if(operation.current)void invoke("games_cancel_torrent_inspection",{profile,operationId:operation.current}).catch(()=>{});};
  const dismiss=()=>{if(!preparationBrowsing&&(!pending.current||busy!=="start"))close();};
  useSectionBack(dismiss,true);
  useEffect(()=>{
    live.current=true;const previous=document.activeElement as HTMLElement|null, dialog=root.current;
    dialog?.querySelector<HTMLElement>(".games-torrent-source input")?.focus({preventScroll:true});
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=="Tab"||!dialog||(event.target as Element)?.closest?.('[data-dropdown-menu]')||[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1)!==dialog.closest('[role="dialog"]'))return;
      const items=[...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
      if(event.shiftKey&&(document.activeElement===items[0]||!dialog.contains(document.activeElement))){event.preventDefault();items.at(-1)?.focus();}
      else if(!event.shiftKey&&(document.activeElement===items.at(-1)||!dialog.contains(document.activeElement))){event.preventDefault();items[0]?.focus();}
    };
    document.addEventListener("keydown",trap);
    return()=>{live.current=false;cancel();discard();document.removeEventListener("keydown",trap);if(!started.current)previous?.focus({preventScroll:true});};
  },[profile]);
  useLayoutEffect(()=>{
    const element=root.current;if(!element)return;
    heightAnimation.current?.cancel();
    const height=element.getBoundingClientRect().height;
    if(lastHeight.current&&Math.abs(lastHeight.current-height)>2&&!matchMedia("(prefers-reduced-motion: reduce)").matches)heightAnimation.current=element.animate([{height:`${lastHeight.current}px`},{height:`${height}px`}],STEP_MOTION);
    lastHeight.current=height;
    if(stage==="review")element.querySelector<HTMLElement>(".games-torrent-review-heading")?.focus({preventScroll:true});
    return()=>heightAnimation.current?.cancel();
  },[stage]);
  useEffect(()=>{if(closing){cancel();discard();}},[closing]);
  useEffect(()=>{if(error)root.current?.querySelector('.games-torrent-error')?.scrollIntoView({block:"nearest"});},[error]);
  useEffect(()=>{if(!copied)return;const timer=window.setTimeout(()=>setCopied(false),2200);return()=>clearTimeout(timer);},[copied]);
  const task=async(kind:NonNullable<typeof busy>,action:()=>Promise<void>)=>{
    if(pending.current)return;pending.current=true;setBusy(kind);setError("");
    try{await action();}catch(reason){if(live.current&&!closingRef.current)setError(String(reason).includes("archive_")?preparationError(reason):torrentError(reason));}
    finally{pending.current=false;operation.current="";if(live.current)setBusy(null);}
  };
  const changeSource=(value:string)=>{discard();setPlan(null);setPreparation({enabled:false});setSource(value);setError("");setCopied(false);};
  const pick=(directory:boolean)=>task("pick",async()=>{
    const {open}=await import("@tauri-apps/plugin-dialog");
    const value=await open({directory,multiple:false,title:t(directory?"games.torrent.chooseFolder":"games.torrent.chooseFile"),filters:directory?undefined:[{name:"BitTorrent",extensions:["torrent"]}]});
    if(typeof value==="string"&&live.current){if(directory)setParent(value);else changeSource(value);}
  });
  const inspect=()=>task("inspect",async()=>{
    discard();setPlan(null);setPreparation({enabled:false});operation.current=crypto.randomUUID();
    const value=await invoke<TorrentPlan>("games_inspect_torrent",{profile,source:source.trim(),operationId:operation.current});
    if(!live.current||closingRef.current){void invoke("games_discard_torrent",{profile,token:value.token}).catch(()=>{});return;}
    token.current=value.token;setPlan(value);setName(torrentFolder(value.name));setSelected(new Set(value.files.filter(file=>!file.padding).map(file=>file.index)));
  });
  useEffect(()=>{
    if(!torrents.draftReview||!initialSource.trim())return;
    // The setup action already asked to review this file. Defer one task so
    // StrictMode's effect rehearsal can cancel without starting a second read.
    const timer=window.setTimeout(()=>void inspect(),0);
    return()=>window.clearTimeout(timer);
  },[profile,initialSource,torrents.draftReview]);
  const start=()=>task("start",async()=>{
    if(!plan||insufficient||invalidPreparation||preparationBrowsing)return;
    try{const record=await torrents.start({token:token.current,parent,name:name.trim(),selected:[...selected],downloadBps:download,uploadBps:upload,game:source.trim()===initialSource.trim()?torrents.draftGame:undefined},unpack);token.current="";started.current=record;close();}
    catch(reason){if(String(reason)==="torrent_expired"){discard();setPlan(null);}throw reason;}
  });
  const copy=async()=>{const success=await copyText(source);if(live.current){setCopied(success);if(!success)setError("games.guides.copyError");}};
  const bytes=plan?torrentSelection(plan,selected):0;
  const disabled=busy!==null||closing||preparationBrowsing;
  return <ModalShell width={stage==="source"?620:760} labelledBy={id} closing={closing} onDismiss={dismiss} backdropClassName="games-torrent-backdrop"><div className="games-torrent-dialog" ref={root} data-step={stage}>
    <header><h2 id={id}>{t(stage==="source"?"games.torrent.add":stage==="loading"?"games.torrent.resolving":"games.torrent.chooseFiles")}</h2><button className="games-icon-button" disabled={busy==="start"} onClick={dismiss} aria-label={t("common.close")}><X size={21}/></button></header>
    <div className="games-torrent-scroll"><div className="games-torrent-step" key={stage}>
      {stage==="source"?<><p className="games-torrent-intro">{t("games.torrent.introClean")}</p><label className="games-torrent-source"><span><Link2 size={17}/>{t("games.torrent.source")}</span><div><input aria-label={t("games.torrent.source")} value={source} onChange={event=>changeSource(event.target.value)} maxLength={MAGNET_MAX_BYTES} placeholder="magnet:?xt=urn:btih:…" disabled={disabled} autoComplete="off" spellCheck={false}/><button className="games-torrent-copy" type="button" aria-label={t(copied?"games.guides.copied":"games.guides.copy")} disabled={!source||disabled} onClick={()=>void copy()}>{copied?<Check size={17}/>:<Copy size={17}/>}<span role="status">{t(copied?"games.guides.copied":"games.guides.copy")}</span></button></div></label><button className="games-button games-torrent-file-picker" disabled={disabled} onClick={()=>void pick(false)}><File size={18}/>{t("games.torrent.chooseFile")}</button></>:stage==="loading"?<><p className="games-torrent-intro" role="status">{t("games.torrent.resolvingNote")}</p><TorrentReviewSkeleton/></>:plan&&<>
        <div className="games-torrent-review-heading" tabIndex={-1}><div><h3>{plan.name}</h3><span>{t("games.torrent.inventory",{count:plan.files.filter(file=>!file.padding).length.toLocaleString(),size:transferBytes(plan.totalBytes)})}</span></div><button className="games-button" disabled={disabled} onClick={()=>{discard();setPlan(null);}}>{t("games.torrent.change")}</button></div>
        <TorrentFiles files={plan.files} selected={selected} onChange={setSelected} disabled={disabled}/>
        <p className="games-torrent-piece-note">{t("games.torrent.pieceNoteClean")}</p>
        <TorrentDestination parent={parent} name={name} needed={torrentSpace(plan,selected)} disabled={disabled} setParent={setParent} setName={setName} pick={()=>void pick(true)} onInsufficient={setInsufficient}/>
        <GamePreparationOptions value={preparation} change={setPreparation} options={options} parent={parent} disabled={disabled} onBrowsing={setPreparationBrowsing}/>
        <details className="games-torrent-advanced"><summary><SlidersHorizontal size={16}/>{t("games.torrent.options")}</summary><div className="games-torrent-bandwidth"><label><span><ArrowDown size={15}/>{t("games.torrent.downloadLimit")}</span><select aria-label={t("games.torrent.downloadLimit")} value={download} disabled={disabled} onChange={event=>setDownload(Number(event.target.value))}>{[0,1024*1024,5*1024*1024,10*1024*1024,25*1024*1024].map(value=><option key={value} value={value}>{value?`${transferBytes(value)}/s`:t("games.torrent.unlimited")}</option>)}</select></label><label><span><ArrowUp size={15}/>{t("games.torrent.uploadLimit")}</span><select aria-label={t("games.torrent.uploadLimit")} value={upload} disabled={disabled} onChange={event=>setUpload(Number(event.target.value))}>{[32*1024,128*1024,512*1024,1024*1024,5*1024*1024].map(value=><option key={value} value={value}>{transferBytes(value)}/s</option>)}</select></label></div><p className="games-torrent-sharing-note">{t("games.torrent.sharingNote")}</p><div className="games-torrent-identity"><span>{t("games.torrent.identity")}</span><code>{plan.infoHash}</code>{plan.private&&<p>{t("games.torrent.private")}</p>}</div></details>
      </>}
    </div>{error&&<p role="alert" className="games-torrent-error">{t(error)}</p>}</div>
    <footer><span aria-live="polite">{started.current?t("games.torrent.added"):plan?<><strong>{t("games.torrent.selection",{count:selected.size.toLocaleString(),size:transferBytes(bytes)})}</strong><small>{t("games.torrent.nextDownloads")}</small></>:t("games.torrent.reviewNote")}</span>{busy==="inspect"?<button className="games-button" onClick={cancel}>{t("common.cancel")}</button>:<button className="games-button games-button-primary" disabled={disabled||!source.trim()||(plan!==null&&(!parent||!name.trim()||bytes===0||insufficient||invalidPreparation))} onClick={()=>void(plan?start():inspect())}>{busy?<LoaderCircle size={17} className="games-torrent-spinner"/>:started.current?<Check size={17}/>:null}{t(started.current?"games.torrent.added":busy==="start"?"games.torrent.starting":plan?"games.torrent.start":"games.torrent.review")}{!busy&&!started.current&&<ArrowRight size={17}/>}</button>}</footer>
  </div></ModalShell>;
}
