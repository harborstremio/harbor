import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link2, RefreshCw, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";
import { openUrl } from "@/lib/window";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import type { SourceLink } from "@/lib/games/source-links";
import { transferBytes, transferError, type GameTransfer, type DownloadRequest } from "@/lib/games/transfers";
import { replacementFile, transferFilename, type ReplacementFile } from "@/lib/games/transfer-relink";
import { GameFileIcon } from "./game-file-icon";
import "./game-download-relink.css";

export function GameDownloadRelink({record, downloads, sourcePicker, onClose, canChooseSource=true}: {
  record: GameTransfer; downloads: GameTransfers; onClose: () => void;
  canChooseSource?:boolean;
  sourcePicker: (link: SourceLink, picker: GameTransfers, close: () => void) => ReactNode;
}) {
  const t=useT(), id=useId(), root=useRef<HTMLDivElement>(null), live=useRef(true), pending=useRef(false);
  const {closing,close}=useModalExit(onClose);
  const [url,setUrl]=useState(""), [candidate,setCandidate]=useState<ReplacementFile|null>(null);
  const [picking,setPicking]=useState(false), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const origin=record.sourceLink??record.sourcePage, filename=transferFilename(record);
  const dismiss=()=>{if(!pending.current&&!picking)close();};
  useSectionBack(dismiss,!picking);
  useEffect(()=>{
    live.current=true; const previous=document.activeElement as HTMLElement|null;
    root.current?.querySelector<HTMLElement>('button')?.focus({preventScroll:true});
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=="Tab"||[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1)!==root.current?.closest('[role="dialog"]'))return;
      const items=[...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary')??[])].filter(item=>item.getClientRects().length);
      const index=items.indexOf(document.activeElement as HTMLElement);
      if(items.length&&(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===items.length-1)){event.preventDefault();(event.shiftKey?items.at(-1):items[0])?.focus();}
    };
    document.addEventListener('keydown',trap);
    return()=>{live.current=false;document.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  const choose=async(request:DownloadRequest,name=filename)=>{
    if(!live.current||pending.current)return false;
    try{setCandidate(replacementFile(record,{...request,sourceLink:record.sourceLink},name,osClass()==="windows"));setError("");return true;}
    catch(reason){setError(transferError(reason));return false;}
  };
  const picker:GameTransfers={...downloads,selectionOnly:true,error,busy:[],dismissError:()=>setError(""),start:choose,startBatch:async files=>{
    if(files.length!==1){setError("games.download.relink.single");return false;}
    return choose(files[0],files[0].filename);
  }};
  const apply=async()=>{
    if(!candidate||pending.current||closing)return;
    pending.current=true;setBusy(true);setError("");
    try{await downloads.relink(record,candidate);if(live.current)close();}
    catch(reason){if(live.current)setError(String(reason).includes('games_relink_transfer')?'games.download.relink.native':transferError(reason));}
    finally{pending.current=false;if(live.current)setBusy(false);}
  };
  return <><ModalShell closing={closing} onDismiss={dismiss} width={560} labelledBy={id} backdropClassName="games-source-link-backdrop">
    <div ref={root} className="games-source-link-dialog games-relink-dialog" inert={closing||picking} aria-hidden={picking||undefined}>
      <header><div><span className="games-section-kicker">{record.game?.name??record.name}</span><h2 id={id}>{t('games.download.relink.title')}</h2></div><button className="games-icon-button" disabled={busy} onClick={dismiss} aria-label={t('common.close')}><X size={19}/></button></header>
      <div className="games-source-link-body">
        <div className="games-relink-file"><GameFileIcon name={filename}/><span><strong>{filename}</strong><small>{t('games.download.relink.saved',{size:transferBytes(record.received)})}</small></span></div>
        <p className="games-relink-path"><bdi>{record.destination}</bdi></p>
        <p>{t('games.download.relink.intro')}</p>
        {origin&&<button className="games-button" disabled={busy} onClick={()=>{setError("");if(canChooseSource)setPicking(true);else void openUrl(origin);}}><Link2 size={16}/>{t(canChooseSource?'games.download.relink.source':'games.sources.openLink')}</button>}
        <details className="games-relink-manual" open={!origin||!canChooseSource||undefined}><summary>{t('games.download.relink.manual')}</summary>
          <form onSubmit={event=>{event.preventDefault();void choose({url,sourceLink:record.sourceLink});}}>
            <label htmlFor={`${id}-url`}>{t('games.download.relink.url')}</label>
            <input id={`${id}-url`} type="url" dir="ltr" value={url} onChange={event=>{setUrl(event.target.value);setCandidate(null);setError("");}} disabled={busy} required placeholder="https://" autoComplete="off" spellCheck={false}/>
            <button className="games-button" disabled={busy||!url.trim()}>{t('games.download.relink.review')}</button>
          </form>
        </details>
        {candidate&&<div className="games-relink-review" role="status"><strong>{candidate.filename}</strong><span>{new URL(candidate.url).hostname}{candidate.expectedBytes!=null&&<> · {transferBytes(candidate.expectedBytes)}</>}</span><p>{t('games.download.relink.note')}</p></div>}
        {error&&<p className="games-relink-error" role="alert">{t(error)}</p>}
      </div>
      <footer><button className="games-button" disabled={busy} onClick={dismiss}>{t('common.cancel')}</button><button className="games-button games-button-primary" disabled={!candidate||busy} aria-busy={busy} onClick={()=>void apply()}><RefreshCw size={16}/>{t(busy?'games.download.relink.working':'games.download.relink.apply')}</button></footer>
    </div>
  </ModalShell>{picking&&origin&&sourcePicker({url:origin,title:record.game?.name??record.name,game:record.game},picker,()=>setPicking(false))}</>;
}
