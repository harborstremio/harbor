import {useId,useState} from "react";
import {ArrowUp,Square,X} from "lucide-react";
import {HoverTooltip} from "@/components/hover-tooltip";
import {ModalShell,useModalExit} from "@/components/modal-shell";
import {useT} from "@/lib/i18n";
import {useSectionBack} from "@/lib/section-back";
import {torrentSharing,type GameTorrent} from "@/lib/games/torrents";
import {transferBytes} from "@/lib/games/transfers";
import type {GameTorrents} from "@/hooks/use-game-torrents";
import {useAccountDialogFocus} from "./game-steam-account";
import "./game-torrent-sharing.css";

export function GameTorrentSharing({record,torrents,disabled}:{record:GameTorrent;torrents:GameTorrents;disabled:boolean}){
  const t=useT(),[open,setOpen]=useState(false),active=torrentSharing(record),sharing=record.sharing;
  return <div className="games-torrent-sharing">
    {sharing&&<div className="games-torrent-sharing-status"><span role="status">{t(`games.torrent.share.${sharing.status}`)}</span><small dir="ltr">{active?`${transferBytes(record.uploadPerSecond)}/s`:transferBytes(sharing.uploadedBytes)}</small></div>}
    <HoverTooltip label={t(active?"games.torrent.share.stop":"games.torrent.share.title")}><button className="games-icon-button" disabled={torrents.busy.includes(record.id)||(!active&&disabled)} aria-label={t(active?"games.torrent.share.stop":"games.torrent.share.title")} onClick={()=>{if(active)void torrents.action(record.id,"pause");else setOpen(true);}}>{active?<Square size={17}/>:<ArrowUp size={19}/>}</button></HoverTooltip>
    {open&&<SharingDialog record={record} torrents={torrents} onClose={()=>setOpen(false)}/>}
  </div>;
}
function SharingDialog({record,torrents,onClose}:{record:GameTorrent;torrents:GameTorrents;onClose:()=>void}){
  const t=useT(),id=useId(),root=useAccountDialogFocus(),{closing,close}=useModalExit(onClose),seed=record.sharing;
  const [upload,setUpload]=useState(String((seed?.policy.uploadBps??256*1024)/1024)),[ratio,setRatio]=useState(String((seed?.policy.ratioMilli??1000)/1000)),[minutes,setMinutes]=useState(String(Math.max(1,Math.ceil((seed?.policy.seconds??3600)/60))));
  const busy=torrents.busy.includes(record.id),dismiss=()=>{if(!busy)close();};useSectionBack(dismiss,true);
  const valid=[upload,ratio,minutes].every(value=>/^\d+$/.test(value))&&Number(upload)>=32&&Number(upload)<=1048576&&Number(ratio)>=1&&Number(ratio)<=10&&Number(minutes)>=1&&Number(minutes)<=1440;
  const resumable=seed&&(seed.status==="stopped"||seed.status==="failed")&&seed.elapsedSeconds<seed.policy.seconds&&seed.uploadedBytes*1000<record.totalBytes*seed.policy.ratioMilli;
  return <ModalShell closing={closing} onDismiss={dismiss} width={440} labelledBy={id} backdropClassName="games-match-backdrop"><div ref={root}><form className="games-download-form" onSubmit={event=>{event.preventDefault();if(valid)void torrents.seed(record.id,{uploadBps:Number(upload)*1024,ratioMilli:Number(ratio)*1000,seconds:Number(minutes)*60}).then(ok=>{if(ok)close();});}}>
    <header><h2 id={id}>{t("games.torrent.share.title")}</h2><button type="button" className="games-icon-button" disabled={busy} onClick={dismiss} aria-label={t("common.close")}><X size={19}/></button></header>
    <p>{record.game?.name??record.name}</p><p>{t("games.torrent.share.note")}</p>
    <label>{t("games.torrent.share.upload")}<input type="number" min={32} max={1048576} step={1} required value={upload} onChange={e=>setUpload(e.target.value)} disabled={busy}/></label>
    <label>{t("games.torrent.share.ratio")}<input type="number" min={1} max={10} step={1} required value={ratio} onChange={e=>setRatio(e.target.value)} disabled={busy}/></label>
    <label>{t("games.torrent.share.minutes")}<input type="number" min={1} max={1440} step={1} required value={minutes} onChange={e=>setMinutes(e.target.value)} disabled={busy}/></label>
    {seed&&<p>{t("games.torrent.share.stats",{uploaded:transferBytes(seed.uploadedBytes),minutes:Math.floor(seed.elapsedSeconds/60)})}</p>}
    {seed?.error&&<p role="status">{t("games.torrent.share.failed")}</p>}
    {torrents.error&&<p role="alert">{t(torrents.error)}</p>}
    <footer>{resumable&&<button type="button" className="games-button" disabled={busy} onClick={()=>void torrents.action(record.id,"resume").then(ok=>{if(ok)close();})}>{t("games.torrent.share.resume")}</button>}<button className="games-button games-button-primary" disabled={busy||!valid} type="submit"><ArrowUp size={17}/>{t(busy?"common.loading":"games.torrent.share.start")}</button></footer>
  </form></div></ModalShell>;
}
