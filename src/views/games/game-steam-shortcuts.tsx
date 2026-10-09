import { useEffect, useId, useRef, useState } from "react";
import { Check, FolderOpen, History, RefreshCw, X } from "lucide-react";
import { open as chooseDirectory } from "@tauri-apps/plugin-dialog";
import { Play } from "@/components/icons/play-filled";
import { Dropdown } from "@/components/dropdown";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import type { SteamShortcutsLibrary } from "@/hooks/use-steam-shortcuts";
import type { GameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import type { SteamShortcut } from "@/lib/games/steam-shortcuts";
import { GameArt } from "./game-art";
import { LibraryManageButton } from "./game-library-personal";
import { SteamShortcutIcon } from "./game-steam-shortcut-icon";
import { GameSteamShortcutActivity } from "./game-steam-shortcut-activity";
import "./game-steam-shortcuts.css";

function ShortcutPlay({game,library,explicit=false,name=game.name}:{game:SteamShortcut;library:SteamShortcutsLibrary;explicit?:boolean;name?:string}) {
  const t=useT(),busy=library.launching===game.id&&library.directLaunching!==game.id,launched=library.launched===game.id,running=library.running.some(process=>process.id===game.id);
  return <button className="games-button games-button-primary games-launch" disabled={!library.available||game.appId===null||game.state!=="ready"||library.launching!==null||running} onClick={()=>void library.launch(game)} aria-label={t("games.library.playGame",{name})}>{launched?<Check size={18}/>:<Play size={18}/>}<span>{t(running&&!explicit?"games.custom.running":busy?"games.library.opening":launched?"games.library.opened":explicit?"games.shortcuts.viaSteam":"games.library.play")}</span></button>;
}

export function GameSteamShortcuts({library,preferences,query,open}:{library:SteamShortcutsLibrary;preferences:GameLibraryPreferences;query:string;open:(id:string,origin?:HTMLElement)=>void}) {
  const t=useT(),[picking,setPicking]=useState(false),[pickerError,setPickerError]=useState(false),[limit,setLimit]=useState(24);
  const [activityProfile,setActivityProfile]=useState<string|null>(null);
  useEffect(()=>setActivityProfile(null),[library.profile]);
  const profile=useRef(library.profile);profile.current=library.profile;
  const title=(game:SteamShortcut)=>preferences.title(game.id,game.name);
  const games=library.games.filter(game=>!preferences.get(game.id).hidden&&preferences.matchesTitle(game.id,game.name,query));
  useEffect(()=>setLimit(24),[query,library.accountId,library.profile]);
  const choose=async()=>{
    const owner=library.profile;setPicking(true);setPickerError(false);
    try {const path=await chooseDirectory({directory:true,multiple:false,title:t("games.shortcuts.chooseFolder")});if(profile.current===owner&&typeof path==="string")library.configure({root:path,accountId:null});}
    catch {if(profile.current===owner)setPickerError(true);}
    finally {if(profile.current===owner)setPicking(false);}
  };
  const accounts=[...new Set([...(library.scan?.accounts??[]),...(library.accountId?[library.accountId]:[])])];
  return <section className="games-steam-shortcuts" aria-label={t("games.dock.shortcut")}>
    <div className="games-section-heading"><div><h3>{t("games.dock.shortcut")}</h3><p>{t("games.shortcuts.note")}</p></div><button className="games-icon-button" aria-label={t("games.library.refresh")} disabled={!library.available||library.loading||picking} onClick={()=>void library.refresh()}><RefreshCw size={20} className={library.loading?"is-scanning":""}/></button></div>
    <div className="games-shortcut-tools">{accounts.length>0&&<Dropdown value={String(library.accountId??"")} ariaLabel={t("games.shortcuts.account")} onChange={value=>library.configure({...library.settings,accountId:Number(value)})} options={accounts.map(id=>({value:String(id),label:t("games.shortcuts.accountNumber",{id})}))}/>}
      <button className="games-button" disabled={!library.available||picking} onClick={()=>void choose()}><FolderOpen size={18}/>{t("games.shortcuts.chooseFolder")}</button>{library.settings.root&&<button className="games-button" disabled={picking} onClick={()=>library.configure({root:null,accountId:null})}>{t("games.shortcuts.automatic")}</button>}
      <button className="games-button" onClick={()=>setActivityProfile(library.profile)}><History size={18}/>{t("games.shortcuts.activity.open")}</button>
    </div>
    {library.settings.root&&<p className="games-shortcut-path" dir="auto">{library.settings.root}</p>}
    {(library.error||pickerError)&&<p className="games-library-notice" role="alert">{t(library.error||"games.shortcuts.pickerError")}</p>}
    {!!library.scan?.warnings.length&&<p className="games-library-warning" role="status">{t("games.shortcuts.partial")}</p>}
    {!games.length?<p className="games-shortcut-empty" role="status">{t(library.loading?"games.library.scanning":query?"games.noResults":"games.shortcuts.empty")}</p>:<div className="games-shortcut-list">{games.slice(0,limit).map(game=><article key={game.id}>
      <button className="games-shortcut-open" aria-label={t("games.dock.details",{name:title(game)})} onClick={event=>open(game.id,event.currentTarget)}><span className="games-shortcut-art">{preferences.cover(game.id)||game.artwork.capsule||game.artwork.icon?<GameArt src={preferences.cover(game.id)||game.artwork.capsule||game.artwork.icon||""}/>:<SteamShortcutIcon game={game} library={library}/>}</span><span><strong dir="auto">{title(game)}</strong><small>{t(`games.shortcuts.state.${game.state}`)}</small></span></button>
      {game.appId===null?<button className="games-button" onClick={event=>open(game.id,event.currentTarget)}>{t("games.shortcuts.reviewLaunch")}</button>:<ShortcutPlay game={game} name={title(game)} library={library}/>}<LibraryManageButton preferences={preferences} item={{id:game.id,name:title(game),cover:game.artwork.portrait||game.artwork.capsule}}/>
    </article>)}</div>}
    {games.length>limit&&<button className="games-button games-library-more" onClick={()=>setLimit(value=>value+24)}>{t("games.library.showMore")}</button>}
    {activityProfile===library.profile&&<GameSteamShortcutActivity library={library} onClose={()=>setActivityProfile(null)}/>}
  </section>;
}

export function GameSteamShortcutDetails({id,library,onClose}:{id:string;library:SteamShortcutsLibrary;onClose:()=>void}) {
  const t=useT(),title=useId(),root=useRef<HTMLDivElement>(null),{closing,close}=useModalExit(onClose);
  const game=library.games.find(item=>item.id===id);
  useSectionBack(close,true);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;root.current?.querySelector<HTMLButtonElement>("button")?.focus({preventScroll:true});
    const trap=(event:KeyboardEvent)=>{if(event.key!=="Tab")return;const buttons=[...root.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")].filter(button=>button.getClientRects().length);if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0]?.focus();}};
    document.addEventListener("keydown",trap);return()=>{document.removeEventListener("keydown",trap);if(previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return <ModalShell closing={closing} onDismiss={close} labelledBy={title} width={620} backdropClassName="games-library-personal-backdrop"><div className="games-shortcut-detail" ref={root}>
    <header><div><span className="games-section-kicker">{t("games.dock.shortcut")}</span><h2 id={title} dir="auto">{game?.name||t("games.shortcuts.unavailable")}</h2></div><button className="games-icon-button" onClick={close} aria-label={t("common.close")}><X size={20}/></button></header>
    <div className="games-shortcut-detail-scroll">{game?<>{game.artwork.hero&&<GameArt className="games-shortcut-detail-hero" src={game.artwork.hero}/>}<p>{t(`games.shortcuts.state.${game.state}`)}</p>{game.appId===null&&<p>{t("games.shortcuts.shortcut_identity")}</p>}{game.state==="account"&&<p>{t("games.shortcuts.shortcut_account")}</p>}
      <dl><dt>{t("games.shortcuts.account")}</dt><dd>{game.accountId}</dd><dt>{t("games.custom.executable")}</dt><dd dir="auto">{game.executable}</dd>{game.startDirectory&&<><dt>{t("games.shortcuts.directory")}</dt><dd dir="auto">{game.startDirectory}</dd></>}{game.launchOptions&&<><dt>{t("games.shortcuts.options")}</dt><dd dir="auto">{game.launchOptions}</dd></>}{game.tags.length>0&&<><dt>{t("games.shortcuts.tags")}</dt><dd dir="auto">{game.tags.join(" · ")}</dd></>}</dl>
    </>:<p role="status">{t("games.shortcuts.removed")}</p>}{library.error&&<p role="alert">{t(library.error)}</p>}</div>
    {game&&library.directAvailable&&<p className="games-shortcut-direct-note">{t("games.shortcuts.directNote")}</p>}
    <footer><button className="games-button" onClick={()=>void library.refresh()} disabled={library.loading}><RefreshCw size={17}/>{t("games.library.refresh")}</button>{game&&<div className="games-shortcut-launch-actions">{library.directAvailable&&<button className={`games-button${game.appId===null?" games-button-primary":""}`} disabled={game.state==="missing"||library.launching!==null||library.running.some(process=>process.id===game.id)} onClick={()=>library.launchDirect(game)}><Play size={18}/>{t(library.directLaunching===game.id?"games.library.opening":library.running.some(process=>process.id===game.id)?"games.custom.running":"games.shortcuts.launchDirect")}</button>}{game.appId!==null&&<ShortcutPlay game={game} library={library} explicit/>}</div>}</footer>
  </div></ModalShell>;
}
