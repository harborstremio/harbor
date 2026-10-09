import { GameFileIcon } from "./game-file-icon";
import { SourceFilesLoading } from "./game-source-loading";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowDown, ArrowUpRight, Check, Copy, Link2, Square, SquareCheck, X } from "lucide-react";
import { useSourceLinkMotion } from "./use-source-link-motion";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { openUrl } from "@/lib/window";
import { type CloudDownload, type CloudKeys } from "@/lib/games/cloud-files";
import { connectedSourceLinkProviders, SOURCE_LINK_PROVIDERS, SOURCE_LINK_SERVICES, sourceLinkError, type SourceLink, type SourceLinkProvider } from "@/lib/games/source-links";
import { transferBytes } from "@/lib/games/transfers";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import rdLogo from "@/assets/addon-logos/realdebrid.png";
import pmLogo from "@/assets/addon-logos/premiumize.png";
import tbLogo from "@/assets/addon-logos/torbox.png";
import adLogo from "@/assets/addon-logos/alldebrid.webp";
import {SourceAllDebrid} from "./game-source-ad";
import {SourceCloudTransfer} from "./game-source-web";
import { GameSourceHost } from "./game-source-host";
import { GameSourceIcon } from "./game-source-icon";
import {sourcePublicHost,PUBLIC_SOURCE_HOSTS} from '@/lib/games/source-public-files';
import {SourcePublicFiles} from './game-source-public';
import pixeldrainLogo from '@/assets/addon-logos/pixeldrain.png';
import archiveLogo from '@/assets/support/internet-archive.png';
import mediafireLogo from '@/assets/addon-logos/mediafire.svg';
import gofileLogo from '@/assets/addon-logos/gofile.png';
import fuckingfastLogo from '@/assets/addon-logos/fuckingfast.ico';
import {sourceBrowserHost,type BrowserSourceHost} from '@/lib/games/source-browser';
import {SourceBrowserFiles} from './game-source-browser';
import {GameDownloadDestination} from './game-download-destination';
import {GameDownloadRelink} from './game-download-relink';
import type {GameTransfer} from '@/lib/games/transfers';
import "./game-source-links.css";

const SourceTransfersContext = createContext<GameTransfers | undefined>(undefined);
export const useSourceTransfers = () => useContext(SourceTransfersContext);
const SourceLinkContext = createContext<((link: SourceLink) => void) | null>(null);
export const useSourceLink = () => useContext(SourceLinkContext);
const SourceDownloadContext = createContext<((id: string) => void) | undefined>(undefined);
export const useSourceDownload = () => useContext(SourceDownloadContext);
const SourceRelinkContext = createContext<((record:GameTransfer)=>void)|null>(null);
export const useSourceRelink = () => useContext(SourceRelinkContext);
const logos = { rd: rdLogo, pm: pmLogo, tb:tbLogo, ad:adLogo };
const publicLogos = {pixeldrain:pixeldrainLogo,archive:archiveLogo,mediafire:mediafireLogo};
const browserLogos: Partial<Record<BrowserSourceHost,string>> = {gofile:gofileLogo,fuckingfast:fuckingfastLogo};

export function GameSourceLinkScope({ children, downloads, keys, openSettings, openDownload, profile, active }: { children: ReactNode; downloads: GameTransfers; keys: CloudKeys; openSettings?: () => void; openDownload?: (id: string) => void; profile: string; active: boolean }) {
  const [draft, setDraft] = useState<{ link: SourceLink; profile: string } | null>(null);
  const [repair,setRepair]=useState<GameTransfer|null>(null);
  useEffect(()=>{if(!active||repair&&repair.profile!==profile)setRepair(null);},[active,profile,repair]);
  useEffect(() => { if (!active || draft && draft.profile !== profile) setDraft(null); }, [active, profile, draft]);
  return <SourceTransfersContext.Provider value={downloads}><SourceDownloadContext.Provider value={openDownload}><SourceLinkContext.Provider value={link => setDraft({link,profile})}><SourceRelinkContext.Provider value={setRepair}>{children}{active && draft?.profile === profile && <SourceLinkDialog key={draft.link.url} link={draft.link} downloads={downloads} keys={keys} openSettings={openSettings} onClose={() => setDraft(null)}/>}{active && downloads.destinationPrompt && <GameDownloadDestination prompt={downloads.destinationPrompt} records={downloads.records}/>}{active&&repair?.profile===profile&&<GameDownloadRelink key={repair.id} record={repair} downloads={downloads} canChooseSource={!!(sourceBrowserHost(repair.sourceLink??repair.sourcePage??"")||sourcePublicHost(repair.sourceLink??repair.sourcePage??"")||connectedSourceLinkProviders(keys).length)} onClose={()=>setRepair(null)} sourcePicker={(link,picker,close)=><SourceLinkDialog link={link} downloads={picker} keys={keys} openSettings={openSettings} onClose={close}/>}/>}</SourceRelinkContext.Provider></SourceLinkContext.Provider></SourceDownloadContext.Provider></SourceTransfersContext.Provider>;
}

function SourceLinkDialog({ link, downloads, keys, openSettings, onClose }: { link: SourceLink; downloads: GameTransfers; keys: CloudKeys; openSettings?: () => void; onClose: () => void }) {
  const t = useT(), id = useId(), { closing, close } = useModalExit(onClose), root = useRef<HTMLDivElement>(null);
  useSourceLinkMotion(root, closing);
  const [copyState,setCopyState]=useState<"idle"|"copied"|"failed">("idle");
  useEffect(()=>{if(copyState!=="copied")return;const timer=setTimeout(()=>setCopyState("idle"),2200);return()=>clearTimeout(timer);},[copyState]);
  const copyLink=async()=>{try{await navigator.clipboard.writeText(link.url);setCopyState("copied");}catch{setCopyState("failed");}};
  const publicHost=sourcePublicHost(link.url),browserHost=sourceBrowserHost(link.url),directHost=publicHost||browserHost,[publicMode,setPublicMode]=useState(!!directHost);
  const [provider, setProvider] = useState<SourceLinkProvider>(() => connectedSourceLinkProviders(keys)[0] ?? "rd");
  const [pmMode,setPmMode]=useState<'direct'|'cloud'>('direct');
  const cloudJob=provider==='tb'||provider==='pm'&&pmMode==='cloud', separateFlow=cloudJob||provider==='ad';
  const [files, setFiles] = useState<CloudDownload[] | null>(null), [selected, setSelected] = useState<number[]>([0]), [limit, setLimit] = useState(50), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const alive = useRef(true), revision = useRef(0), pending = useRef(false);
  const key = keys[provider]?.trim() ?? "", service = SOURCE_LINK_SERVICES.find(item => item.id === provider)!, saving = downloads.busy.includes("new");
  const dismiss = () => { if (!saving) close(); };
  useSectionBack(dismiss, true);
  useEffect(() => {
    alive.current = true; const previous = document.activeElement as HTMLElement | null;
    root.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({preventScroll:true});
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== root.current?.closest('[role="dialog"]')) return;
      const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]') ?? [])].filter(item => item.getClientRects().length);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (items.length && (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === items.length - 1)) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0])?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { alive.current = false; revision.current++; document.removeEventListener("keydown",trap); if (previous?.isConnected) previous.focus({preventScroll:true}); };
  }, []);
  useEffect(() => { revision.current++; pending.current = false; setFiles(null); setError(""); setLoading(false); setSelected([0]); setLimit(50); }, [provider,key,pmMode,publicMode]);
  const prepare = async () => {
    if (separateFlow || pending.current || saving || !key || !downloads.available) return;
    pending.current = true; const current = revision.current; setLoading(true); setError(""); downloads.dismissError();
    try {
      const result = await invoke<CloudDownload[]>("games_cloud_resolve_link", { args: { provider, key, url: link.url } });
      if (alive.current && current === revision.current) { setFiles(result); setSelected([0]); setError(result.length ? "" : "games.sources.links.empty"); }
    } catch (reason) { if (alive.current && current === revision.current) setError(sourceLinkError(reason)); }
    finally { if (alive.current && current === revision.current) { pending.current = false; setLoading(false); } }
  };
  const chosen=files?.filter((_,index)=>selected.includes(index))??[],multiple=(files?.length??0)>1&&!downloads.selectionOnly;
  const download=async()=>{
    if(closing||pending.current||saving||!chosen.length)return;
    pending.current=true;const current=revision.current;
    try{
      const started=chosen.length===1?await downloads.start({url:chosen[0].url,sourceLink:link.url,name:link.title,game:link.game,expectedBytes:chosen[0].expectedBytes??undefined},chosen[0].name)
        :await downloads.startBatch(chosen.map(file=>({url:file.url,sourceLink:link.url,filename:file.name,name:file.name,game:link.game,expectedBytes:file.expectedBytes??undefined})));
      if(started&&alive.current&&current===revision.current)close();
    }finally{if(current===revision.current)pending.current=false}
  };
  return <ModalShell closing={closing} onDismiss={dismiss} width={600} labelledBy={id} backdropClassName="games-source-link-backdrop"><div className="games-source-link-dialog" ref={root} inert={closing}>
    <header><div><span className="games-section-kicker">{t(downloads.selectionOnly?"games.download.relink.title":"games.sources.links.title")}</span><h2 id={id}>{link.title}</h2><div className="games-source-link-address"><button className="games-source-link-origin" onClick={() => void openUrl(link.url)}><Link2 size={14}/>{new URL(link.url).hostname}<ArrowUpRight size={13}/></button><button className="games-source-link-copy" onClick={()=>void copyLink()}>{copyState==="copied"?<Check size={15}/>:<Copy size={15}/>}<span aria-live="polite">{t(copyState==="copied"?"games.sources.links.copied":"games.sources.links.copy")}</span></button></div>{copyState==="failed"&&<div role="alert"><p>{t("games.sources.copyError")}</p><input className="games-source-copy-fallback" value={link.url} readOnly aria-label={t("games.sources.links.copy")} onFocus={event=>event.currentTarget.select()}/></div>}</div><button className="games-icon-button" disabled={saving} onClick={dismiss} aria-label={t("common.close")}><X size={19}/></button></header>
    {directHost&&<div className="games-source-link-modes"><button aria-pressed={publicMode} disabled={saving} onClick={()=>setPublicMode(true)}>{publicHost||browserLogos[browserHost!]?<img src={publicHost?publicLogos[publicHost]:browserLogos[browserHost!]} alt=""/>:<GameSourceIcon url={link.url} fallback={<ArrowDown size={18}/>}/>} {publicHost?PUBLIC_SOURCE_HOSTS[publicHost]:t('games.sources.browser.direct')}</button><button aria-pressed={!publicMode} disabled={saving} onClick={()=>setPublicMode(false)}>{t('games.sources.public.services')}</button></div>}
    <div className="games-source-link-content" key={directHost&&publicMode?"public":`${provider}:${pmMode}`} >{directHost&&publicMode?(browserHost?<SourceBrowserFiles link={link} downloads={downloads} onDone={close} closing={closing}/>:<SourcePublicFiles link={link} downloads={downloads} onDone={close} closing={closing}/>):<><div className={`games-source-link-body${separateFlow?" games-source-link-options":""}`}>
      <p>{t("games.sources.links.intro")}</p>
      <div className="games-source-link-providers" aria-label={t("games.sources.links.service")}>{SOURCE_LINK_PROVIDERS.map(item => <button key={item} aria-pressed={provider === item} disabled={saving} onClick={() => setProvider(item)}><img src={logos[item]} alt=""/><span>{SOURCE_LINK_SERVICES.find(value => value.id === item)!.name}</span>{keys[item]?.trim() && <Check size={15} aria-label={t("games.sources.links.connected")}/>}</button>)}</div>
      <GameSourceHost provider={provider} apiKey={key} url={link.url} available={downloads.available}/>
      {provider==='pm'&&<div className="games-web-scope games-pm-mode">{(['direct','cloud'] as const).map(mode=><button key={mode} aria-pressed={pmMode===mode} disabled={saving} onClick={()=>setPmMode(mode)}>{t(`games.sources.pm.${mode}`)}</button>)}</div>}
      {!separateFlow&&(!downloads.available ? <p>{t("games.sources.links.desktop")}</p> : !key ? <div className="games-source-link-connect"><p>{t("games.sources.links.connect",{name:service.name})}</p>{openSettings && <button className="games-button" onClick={() => {close();openSettings();}}>{t("games.sources.links.settings")}</button>}</div> : <>
        {loading && <SourceFilesLoading rows={files?.length ? Math.min(files.length, 3) : 1}/>}
        {files && !loading && <>{multiple&&<div className="games-source-file-selection"><span>{t('games.sources.batch.selected',{count:chosen.length.toLocaleString()})}</span><button disabled={saving} onClick={()=>{setSelected(chosen.length===files.length?[]:files.map((_,index)=>index));downloads.dismissError()}}>{t(chosen.length===files.length?'games.sources.batch.clear':'games.sources.batch.all')}</button></div>}<div className="games-source-link-files" role="group" aria-label={t("games.sources.links.files")}>{files.slice(0,limit).map((item,index) => <button key={`${item.url}:${index}`} role={multiple?'checkbox':undefined} aria-checked={multiple?selected.includes(index):undefined} aria-pressed={!multiple?selected.includes(index):undefined} disabled={saving} onClick={() => {setSelected(previous=>downloads.selectionOnly?[index]:previous.includes(index)?previous.filter(value=>value!==index):[...previous,index]);downloads.dismissError()}}><GameFileIcon name={item.name}/><span><strong>{item.name}</strong><small><bdi>{item.expectedBytes ? transferBytes(item.expectedBytes) : t("games.sources.links.unknownSize")}</bdi></small></span>{multiple?(selected.includes(index)?<SquareCheck size={20}/>:<Square size={20}/>):selected.includes(index)&&<Check size={17}/>}</button>)}{files.length > limit && <button className="games-button" disabled={saving} onClick={() => setLimit(value => value+50)}>{t("games.sources.links.more")}</button>}</div></>}
      </>)}
    </div>{!separateFlow&&(error||downloads.error)&&<div className="games-source-batch-error" role="alert">{t(error||downloads.error)}</div>}
    {provider==='ad'?<SourceAllDebrid link={link} downloads={downloads} apiKey={key} openSettings={openSettings} onDone={close}/>:cloudJob?<SourceCloudTransfer key={provider} provider={provider==='pm'?'pm':'tb'} link={link} downloads={downloads} keys={keys} openSettings={openSettings} onDone={close}/>:<footer><span>{t(downloads.selectionOnly?"games.download.relink.intro":chosen.length>1?'games.sources.batch.note':"games.sources.links.note")}</span>{downloads.available && key && (files?.length && !loading ? <button className="games-button games-button-primary" disabled={saving||!chosen.length} onClick={() => void download()}><ArrowDown size={16}/>{t(downloads.selectionOnly?"games.download.relink.review":chosen.length>1?'games.sources.batch.destination':"games.sources.links.destination")}</button> : <button className="games-button games-button-primary" aria-disabled={loading} onClick={() => void prepare()}>{t(loading ? "games.sources.links.preparing" : error ? "common.retry" : "games.sources.links.prepare")}</button>)}</footer>}
  </>}</div></div></ModalShell>;
}
