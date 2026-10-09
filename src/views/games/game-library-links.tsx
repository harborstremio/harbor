import { GameVideoSearchLinks } from "./game-video-search";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Link2, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT, useUiLanguage } from "@/lib/i18n";
import { isTauri } from "@tauri-apps/api/core";
import type { GameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import { knownGameLinks, orderedLibraryLinks, reviewLibraryLinks, type GameLink, type LibraryLinkItem } from "@/lib/games/library-links";
import { readLibraryLinks } from "@/lib/games/library-links-cache";
import type { GameSummary } from "@/lib/games/types";
import { DetailDisclosure } from "./game-detail-disclosure";
import "./game-library-titles.css";
import "./game-library-links.css";

function LinkList({ links }: { links: GameLink[] }) {
  const t=useT(),[error,setError]=useState(false);
  return <><ol className="games-library-link-list">{links.map((link,index)=><li key={`${link.url}:${link.name}:${index}`}><a href={link.url} target="_blank" rel="noreferrer" onClick={event=>{if(!isTauri())return;event.preventDefault();setError(false);void import("@tauri-apps/plugin-opener").then(({openUrl})=>openUrl(link.url)).catch(()=>setError(true));}}><span><strong dir="auto">{link.name}</strong><small dir="ltr">{link.url}</small></span><ArrowUpRight size={17}/></a></li>)}</ol>{error&&<p className="games-title-error" role="alert">{t("games.links.openError")}</p>}</>;
}

export function GameLinks({ game, records=[], preferences, active }: {game:GameSummary;records?:(GameSummary|null|undefined)[];preferences:GameLibraryPreferences;active:boolean}) {
  const t=useT(),[editing,setEditing]=useState(false),links=knownGameLinks(game.id,game,...records);
  useEffect(()=>setEditing(false),[active,game.id,preferences.profile]);

  return <><DetailDisclosure title={t("games.links.title")} icon={<Link2 size={22}/>}>
    <LinkList links={orderedLibraryLinks(links,preferences.data.entries[game.id]?.linkOrder)}/>
    <GameVideoSearchLinks name={game.name}/>
    {links.length>0&&<button className="games-button games-link-sort" disabled={!preferences.ready||preferences.busy} onClick={()=>{preferences.dismissError();setEditing(true);}}>{t("games.links.sort")}</button>}
  </DetailDisclosure>{editing&&active&&<GameLibraryLinks key={`${preferences.profile}:${game.id}`} preferences={preferences} items={[{id:game.id,name:game.name,game,links}]} selectedIds={[]} onClose={()=>setEditing(false)}/>}</>;
}

export function GameLibraryLinks({ preferences,items,selectedIds,onClose,onApplied }: {preferences:GameLibraryPreferences;items:LibraryLinkItem[];selectedIds:string[];onClose:()=>void;onApplied?:(count:number)=>void}) {
  const t=useT(),language=useUiLanguage(),title=useId(),root=useRef<HTMLDivElement>(null);
  const initial=useRef(preferences.data),source=useRef(items),selected=useRef(new Set(selectedIds)),pending=useRef(false),live=useRef(true);
  const [scope,setScope]=useState(selectedIds.length?"selected":"all"),[restore,setRestore]=useState(false),[loaded,setLoaded]=useState<LibraryLinkItem[]|null>(null),[progress,setProgress]=useState(0),[error,setError]=useState(false),[attempt,setAttempt]=useState(0),[limit,setLimit]=useState(40);
  const {closing,close}=useModalExit(onClose),dismiss=()=>{if(!pending.current&&!preferences.busy)close();};useSectionBack(dismiss,true);
  useEffect(()=>{
    live.current=true;const previous=document.activeElement as HTMLElement|null,frame=requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true}));
    const trap=(event:KeyboardEvent)=>{if(event.key!=="Tab"||event.defaultPrevented||!root.current)return;const targets=[...root.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary,a[href]')].filter(el=>el.getClientRects().length);if(!root.current.contains(document.activeElement)){event.preventDefault();(event.shiftKey?targets.at(-1):targets[0])?.focus();}else if(event.shiftKey&&document.activeElement===targets[0]){event.preventDefault();targets.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===targets.at(-1)){event.preventDefault();targets[0]?.focus();}};
    document.addEventListener("keydown",trap);return()=>{live.current=false;cancelAnimationFrame(frame);document.removeEventListener("keydown",trap);previous?.isConnected&&previous.focus({preventScroll:true});};
  },[]);
  useEffect(()=>{const abort=new AbortController();setLoaded(null);setProgress(0);setError(false);void readLibraryLinks(source.current,abort.signal,setProgress).then(items=>{if(!abort.signal.aborted)setLoaded(items);}).catch(()=>{if(!abort.signal.aborted)setError(true);});return()=>abort.abort();},[attempt]);
  const targets=useMemo(()=>scope==="selected"?(loaded??[]).filter(item=>selected.current.has(item.id)):loaded??[],[loaded,scope]);
  const rows=useMemo(()=>reviewLibraryLinks(targets,initial.current.entries,language,restore),[targets,language,restore]),changed=rows.filter(row=>row.changed);
  const save=async()=>{
    if(!loaded||pending.current||!preferences.ready||preferences.busy)return;
    pending.current=true;
    const changes=rows.filter(row=>row.changed||restore&&row.expectedOrder?.length).map(({id,order,expectedOrder})=>({id,order,expectedOrder}));
    try{if(await preferences.updateLinkOrders(changes)&&live.current){onApplied?.(changed.length);close();}}finally{pending.current=false;}
  };
  return <ModalShell closing={closing} onDismiss={dismiss} labelledBy={title} width={850} backdropClassName="games-library-personal-backdrop"><div className="games-library-titles games-library-links" ref={root}>
    <header><div><h2 id={title}>{t("games.links.sort")}</h2><p>{t("games.links.note")}</p></div><button type="button" className="games-icon-button" disabled={preferences.busy} aria-label={t("common.close")} onClick={dismiss}><X size={22}/></button></header>
    <div className="games-title-scroll">
      {source.current.length>1&&<div className="games-title-scope" role="group" aria-label={t("games.links.sort")}><button disabled={preferences.busy} aria-pressed={scope==="all"} onClick={()=>{setScope("all");setLimit(40);}}>{t("games.sidebar.allGames")} <span>{source.current.length.toLocaleString(language)}</span></button>{selectedIds.length>0&&<button disabled={preferences.busy} aria-pressed={scope==="selected"} onClick={()=>{setScope("selected");setLimit(40);}}>{t("games.selection.count",{count:selectedIds.length})}</button>}</div>}
      <p className="games-links-note">{t("games.links.available")}</p><label className="games-title-toggle"><input type="checkbox" checked={restore} disabled={preferences.busy} onChange={event=>setRestore(event.target.checked)}/>{t("games.links.original")}</label>
      {!loaded&&!error&&<p role="status">{t("games.links.loading",{count:progress,total:source.current.length})}</p>}
      {error&&<p role="alert">{t("games.links.error")} <button className="games-button" onClick={()=>setAttempt(value=>value+1)}>{t("common.retry")}</button></p>}
      <div className="games-links-review">{rows.slice(0,limit).map(row=><details key={row.id} data-link-id={row.id} open={source.current.length===1?true:undefined}>
        <summary><strong dir="auto">{row.name}</strong><span>{row.current.length.toLocaleString(language)}</span></summary>
        {row.current.length?<div className="games-links-comparison"><section><h3>{t("games.links.current")}</h3><LinkList links={row.current}/></section><section><h3>{t(restore?"games.links.original":"games.links.preview")}</h3><LinkList links={row.next}/></section></div>:<p>{t("games.links.noLinks")}</p>}
      </details>)}</div>{rows.length>limit&&<button className="games-button" onClick={()=>setLimit(value=>value+40)}>{t("games.library.showMore")}</button>}
      {loaded&&<p className="games-title-count" role="status">{t(changed.length?"games.links.changes":"games.links.unchanged",{count:changed.length})}</p>}
      {preferences.error&&<p role="alert" className="games-title-error">{t(preferences.error)}</p>}
    </div><footer><button className="games-button" disabled={preferences.busy} onClick={dismiss}>{t("common.cancel")}</button><button className="games-button games-button-primary" disabled={!loaded||!preferences.ready||preferences.busy} onClick={()=>void save()}>{t(preferences.busy?"common.loading":"common.save")}</button></footer>
  </div></ModalShell>;
}
