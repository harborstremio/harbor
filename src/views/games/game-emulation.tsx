import { Play } from "@/components/icons/play-filled";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, FolderOpen, ImagePlus, LayoutGrid, List, Monitor, Plus, RefreshCw, Settings2, X } from "lucide-react";
import { GameDestinationIcon } from "@/components/icons/game-destination-icon";
import { useSectionBack } from "@/lib/section-back";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { EMULATION_SYSTEMS, EMULATORS, localGames, type EmulatorKind, type LocalGame } from "@/lib/games/emulation";
import type { EmulationLibrary } from "@/hooks/use-emulation-library";
import { gameSize } from "@/lib/games/installed";
import { fileName } from "@/lib/games/patching";
import { romCollectionGame } from "@/lib/games/personal-collection-library";
import type { PersonalCollectionGame } from "@/lib/games/personal-collections";
import type { GameSummary } from "@/lib/games/types";
import { GameMatch } from "./game-match";
import { GameArt } from "./game-art";
import { GamePatchLauncher } from "./game-patch";
import type { GameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import { romPreferenceId, type LibraryVisibility } from "@/lib/games/library-preferences";
import { LibraryManageButton, LibraryPin, LibraryPreferenceError, LibraryVisibilityFilter, libraryPreferenceVisible } from "./game-library-personal";
import "./game-emulation.css";
import { romPlayerMode } from '@/lib/games/embedded-emulation';

import { useLibrarySelection, LibrarySelectButton, LibrarySelectionBar, LibrarySelectionMark } from "./game-library-selection";

export function GameEmulation({ library, systemId, setSystem, query, changeQuery, open, preferences, active = true, collect }: { library:EmulationLibrary; systemId:number; setSystem:(id:number)=>void; query:string; changeQuery:(value:string)=>void; open:(game:GameSummary)=>void; preferences:GameLibraryPreferences; active?:boolean; collect?:(games:PersonalCollectionGame[])=>void }) {
  const t=useT();
  const [tool,setTool]=useState<"import"|"setup"|null>(null);
  const [toolSystem,setToolSystem]=useState(systemId||24);
  const system=EMULATION_SYSTEMS.find(s=>s.id===toolSystem)??EMULATION_SYSTEMS[0];
  const [kind,setKind]=useState<EmulatorKind>(system.emulators[0]);
  const setup=useRef<HTMLDivElement>(null), toolTrigger=useRef<HTMLElement|null>(null), more=useRef<HTMLButtonElement>(null);
  const pendingImport=useRef<typeof library.data.folders|null>(null);
  const [matching,setMatching]=useState<LocalGame|null>(null);
  const [view,setView]=useState<"covers"|"list">("covers");
  const [sort,setSort]=useState("recent");
  const [limit,setLimit]=useState(48);
  const [visibility,setVisibility]=useState<LibraryVisibility>("visible");
  const profile=library.data.profiles[system.id];
  const folders=library.data.folders.filter(f=>!systemId||f.system===systemId);
  const allGames=localGames(library.data);
  const title=(game: ReturnType<typeof localGames>[number])=>preferences.title(romPreferenceId(game.system,game.path),game.linked?.name??game.name);
  const visibleGames=allGames.filter(game=>libraryPreferenceVisible(preferences.data.entries[romPreferenceId(game.system,game.path)],visibility));
  const games=visibleGames.filter(game=>!systemId||game.system===systemId).filter(game=>preferences.matchesTitle(romPreferenceId(game.system,game.path),game.linked?.name??game.name,query)||game.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>Number(preferences.get(romPreferenceId(b.system,b.path)).pinned)-Number(preferences.get(romPreferenceId(a.system,a.path)).pinned)||(sort==="title"?title(a).localeCompare(title(b)):(library.data.lastPlayed[b.path]??0)-(library.data.lastPlayed[a.path]??0)||title(a).localeCompare(title(b))));
  const selection = useLibrarySelection({ items: games.map(game => ({ id: romPreferenceId(game.system, game.path), name: title(game), ...preferences.get(romPreferenceId(game.system, game.path)), game: romCollectionGame(game) })), scope: JSON.stringify([preferences.profile, systemId, query, visibility]), active:active&&!tool, update: preferences.update, collect });
  const configured=profile&&profile.kind===kind;
  useEffect(()=>{setKind(profile?.kind??system.emulators[0]);},[system.id,profile?.kind]);
  useEffect(()=>setLimit(48),[systemId,query,sort,visibility]);
  useEffect(()=>{if(!active)setTool(null);},[active]);
  useEffect(()=>{pendingImport.current=null;setTool(null);},[preferences.profile]);
  useEffect(()=>{if(tool)setup.current?.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')?.focus({preventScroll:true});},[tool]);
  useEffect(()=>{
    if(!active||games.length<=limit||!more.current)return;
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))setLimit(n=>n+48);},{rootMargin:"240px"});
    observer.observe(more.current);return()=>observer.disconnect();
  },[active,games.length,limit]);
  const selected=t("games.emulation.platform",{name:system.name});
  const closeTool=()=>{setTool(null);requestAnimationFrame(()=>toolTrigger.current?.focus({preventScroll:true}));};
  useEffect(()=>{
    if(!pendingImport.current||library.busy)return;
    const imported=pendingImport.current!==library.data.folders;
    pendingImport.current=null;
    if(imported){setTool(null);setSystem(0);changeQuery("");setVisibility("visible");requestAnimationFrame(()=>toolTrigger.current?.focus({preventScroll:true}));}
  },[library.busy,library.data.folders]);
  useSectionBack(closeTool,active&&!!tool&&!matching,true);
  const showTool=(value:"import"|"setup",id=systemId||24)=>{toolTrigger.current=document.activeElement as HTMLElement;setToolSystem(id);setTool(value);requestAnimationFrame(()=>setup.current?.scrollIntoView({block:"nearest",behavior:"instant"}));};
  const filtered=!!query.trim()||visibility!=="visible"||allGames.length>0;
  const loading=!games.length&&(library.busy==="scan"||library.busy==="import");
  const fileSize=(bytes:number)=>bytes<1024?`${bytes} B`:bytes<1024*1024?`${Math.round(bytes/1024).toLocaleString()} KB`:gameSize(bytes);
  return <section className="games-emulation games-inset">
    <header className="games-retro-heading"><div><h2 tabIndex={-1}>{t("games.emulation.title")}</h2><p role="status">{t(loading?"games.emulation.importing":"games.emulation.gameCount",{count:games.length})}</p></div>{library.available&&<div className="games-retro-heading-actions"><button className="games-icon-button" onClick={()=>tool==="setup"?closeTool():showTool("setup")} aria-label={t("games.emulation.setup")} title={t("games.emulation.setup")} aria-expanded={tool==="setup"}><Settings2 size={19}/></button><button className="games-button games-button-primary" disabled={!!library.busy} onClick={()=>tool==="import"?closeTool():showTool("import")} aria-expanded={tool==="import"}><Plus size={17}/>{t("games.emulation.addGames")}</button></div>}</header>
    {!library.available?<div className="games-retro-desktop"><Monitor size={32}/><h3>{t("games.emulation.desktopTitle")}</h3><p>{t("games.emulation.desktopNote")}</p></div>:<>
      <LibraryPreferenceError preferences={preferences}/><div className="games-retro-workspace">
        {tool&&<div className="games-retro-setup" ref={setup} role="region" aria-label={tool==="import"?t("games.emulation.addGames"):selected}><header><h3>{t(tool==="import"?"games.emulation.addGames":"games.emulation.setup")}</h3><button className="games-icon-button" onClick={closeTool} aria-label={t("common.close")}><X size={18}/></button></header><p>{t(tool==="import"?"games.emulation.importNote":"games.emulation.setupNote")}</p><div className="games-retro-setup-controls"><Dropdown ariaLabel={t("games.platforms")} value={String(system.id)} onChange={value=>setToolSystem(Number(value))} options={EMULATION_SYSTEMS.map(value=>({value:String(value.id),label:value.name}))}/>{tool==="import"?<button className="games-button games-button-primary" disabled={!!library.busy} onClick={()=>{pendingImport.current=library.data.folders;void library.addFolder(system.id);}}><FolderOpen size={17}/>{t(library.busy==="import"?"games.emulation.importing":"games.emulation.addFolder")}</button>:<Dropdown ariaLabel={t("games.emulation.emulator")} value={kind} onChange={value=>setKind(value as EmulatorKind)} options={system.emulators.map(value=>({value,label:EMULATORS[value].name}))}/>}</div>
          {tool==="import"?<p className="games-retro-formats">{system.extensions}</p>:<>
          <div className="games-retro-app"><span>{t("games.emulation.application")}</span><strong>{configured?fileName(profile.path):t("games.emulation.noApp")}</strong>{configured&&<small>{profile.path}</small>}<button className="games-button" disabled={!!library.busy} onClick={()=>void library.chooseApp(system.id,kind,configured?profile.corePath:null)}><FolderOpen size={16}/>{t(configured?"games.emulation.changeApp":"games.emulation.chooseApp")}</button></div>
          {kind==="retroarch"&&<div className="games-retro-app"><span>{t("games.emulation.core")}</span><strong>{configured&&profile.corePath?fileName(profile.corePath):t("games.emulation.chooseCoreNote",{name:system.short})}</strong><button className="games-button" disabled={!!library.busy||!configured} onClick={()=>void library.chooseCore(system.id)}><Plus size={16}/>{t("games.emulation.chooseCore")}</button></div>}
          <button className="games-retro-detect" disabled={!!library.busy} onClick={()=>void library.discover()}><RefreshCw size={14}/>{t(library.busy==="detect"?"games.emulation.detecting":"games.emulation.findInstalled")}</button>
          {library.detected.filter(e=>e.kind===kind).map(emulator=><button className="games-retro-detected" key={emulator.path} disabled={!!library.busy} onClick={()=>void library.configure(system.id,emulator)}><Check size={16}/><span>{EMULATORS[emulator.kind].name}<small>{emulator.path}</small></span><ArrowUpRight size={14}/></button>)}
          {library.searched&&!library.detected.some(e=>e.kind===kind)&&<p>{t("games.emulation.notDetected",{name:EMULATORS[kind].name})}</p>}
          <a className="games-retro-official" href={EMULATORS[kind].url} onClick={event=>{event.preventDefault();openUrl(EMULATORS[kind].url);}}>{t("games.emulation.official",{name:EMULATORS[kind].name})}<ArrowUpRight size={14}/></a><p className="games-retro-firmware">{t(kind==="mgba"?"games.emulation.mgbaFirmware":"games.emulation.firmware")}</p>
          </>}
        </div>}
        <div className="games-retro-content">
          <div className="games-retro-toolbar"><div className="games-retro-filters"><Dropdown ariaLabel={t("games.platforms")} value={String(systemId)} onChange={id=>setSystem(Number(id))} options={[{value:"0",label:t("games.hub.allSystems")},...EMULATION_SYSTEMS.map(s=>({value:String(s.id),label:`${s.name} · ${visibleGames.filter(game=>game.system===s.id).length}`}))]}/><LibraryVisibilityFilter value={visibility} setValue={setVisibility}/></div><div className="games-retro-sort">{!!games.length&&<LibrarySelectButton selection={selection} disabled={!preferences.ready || preferences.busy}/>}<Dropdown ariaLabel={t("games.catalog.sort")} value={sort} onChange={setSort} options={[{value:"recent",label:t("games.emulation.recent")},{value:"title",label:t("games.catalog.sort.Name_ASC")}]}/><div className="games-retro-view" aria-label={t("games.library.view")}><button aria-label={t("games.library.grid")} title={t("games.library.grid")} aria-pressed={view==="covers"} onClick={()=>setView("covers")}><LayoutGrid size={17}/></button><button aria-label={t("games.library.list")} title={t("games.library.list")} aria-pressed={view==="list"} onClick={()=>setView("list")}><List size={18}/></button></div></div></div>
          <LibrarySelectionBar selection={selection}/>
          {loading&&<div className="games-retro-loading" aria-busy="true" aria-label={t("games.emulation.importing")}>{Array.from({length:6},(_,index)=><div key={index}><span/><i/></div>)}</div>}
          {!games.length&&!loading&&!tool&&<div className="games-retro-empty"><GameDestinationIcon name="roms" size={42}/><h3>{t(filtered?"games.noResults":"games.emulation.empty")}</h3><p>{t(filtered?"games.emulation.noMatches":"games.emulation.emptyNote")}</p>{filtered?<button className="games-button" onClick={()=>{setSystem(0);changeQuery("");setVisibility("visible");}}>{t("games.emulation.clearFilters")}</button>:<button className="games-button" onClick={()=>showTool("import")}><FolderOpen size={16}/>{t("games.emulation.addGames")}</button>}</div>}
          {!!games.length&&<div className={`games-retro-games is-${view}`} data-selection={selection.mode}>{games.slice(0,limit).map(game=>{
            const player=library.data.profiles[game.system], platform=EMULATION_SYSTEMS.find(value=>value.id===game.system);
            const ready = romPlayerMode(game, player) !== 'setup';
            const running=library.running.some(v=>v.path===game.path),busy=library.busy===game.path,name=title(game),id=romPreferenceId(game.system,game.path),cover=preferences.cover(id,game.linked)??game.linked?.portrait;
            return <article className="games-retro-game" key={id} data-rom={game.path}>
              <div className="games-retro-media">
              <button className="games-retro-cover" data-game={game.linked?.id} aria-label={t(game.linked?"games.match.details":"games.match.findFor",{name})} {...selection.props(id, name, () => game.linked ? open({...game.linked,libraryEntryId:id}) : setMatching(game))}>
                {cover?<GameArt src={cover}/>:<span className="games-retro-file"><GameDestinationIcon name="roms" size={36}/><small>{game.format}</small></span>}
                <LibraryPin id={id} preferences={preferences}/><LibrarySelectionMark selection={selection} id={id}/>
              </button>
              </div>
              <div className="games-retro-game-info"><h4>{name}</h4><span>{platform?.short} · {fileSize(game.sizeBytes)}{game.discs>1&&<> · {t("games.emulation.discs",{count:game.discs})}</>}</span>{!game.available&&<small>{t("games.emulation.unavailableGame")}</small>}</div>
              <div className="games-retro-game-actions"><LibraryManageButton preferences={preferences} item={{id,name,cover:game.linked?.portrait,game:game.linked}}/><button className="games-icon-button" onClick={()=>setMatching(game)} aria-label={t("games.match.findFor",{name})} title={t(game.linked?"games.match.change":"games.match.title")}><ImagePlus size={16}/></button>
                <button className="games-icon-button games-retro-play" disabled={!!library.busy||!game.available||running} aria-label={t(running?"games.emulation.runningGame":ready?"games.library.playGame":"games.emulation.setupGame",{name})} title={t(running?"games.emulation.running":ready?"games.library.play":"games.emulation.setup")} onClick={()=>ready?void library.launch(game):showTool("setup",game.system)}>{busy?<span className="games-launch-dots"><i/><i/><i/></span>:running?<span className="games-retro-running"/>:ready?<Play size={16}/>:<Settings2 size={17}/>}</button>
              </div>
            </article>;
          })}</div>}
          {games.length>limit&&<button ref={more} className="games-button games-catalog-more" onClick={()=>setLimit(n=>n+48)}>{t("games.catalog.more")}</button>}
          {!!folders.length&&<details className="games-retro-folders"><summary>{t("games.emulation.folders",{count:folders.length})}</summary>{folders.map(folder=><div key={folder.id}><FolderOpen size={16}/><span><strong>{fileName(folder.root)}</strong><small>{folder.root}</small>{folder.unavailable&&<span>{t("games.emulation.unavailableFolder")}</span>}{folder.limited&&<span>{t("games.emulation.scanLimited")}</span>}{folder.skipped>0&&<span>{t("games.emulation.skipped",{count:folder.skipped})}</span>}</span><button className="games-icon-button" disabled={!!library.busy} aria-label={t("games.emulation.removeFolder",{name:fileName(folder.root)})} title={t("games.emulation.removeNote")} onClick={()=>library.removeFolder(folder.id)}><X size={16}/></button></div>)}<p>{t("games.emulation.removeNote")}</p></details>}
        </div>

      </div>
      <div className="games-retro-maintenance"><button className="games-retro-rescan" disabled={!!library.busy||!library.data.folders.length} onClick={()=>void library.refresh()}><RefreshCw size={15} className={library.busy==="scan"?"games-patch-working":""}/>{t("games.library.refresh")}</button><GamePatchLauncher/></div>
    </>}
    {matching&&<GameMatch localCover={!!preferences.get(romPreferenceId(matching.system,matching.path)).cover} game={matching} onMatch={value=>library.matchGame(matching,value)} onClose={()=>setMatching(null)}/>}
    {library.error&&<div className="games-retro-error" role="alert"><span>{t(library.error)}</span><button className="games-icon-button" onClick={library.dismissError} aria-label={t("common.close")}><X size={17}/></button></div>}
  </section>;
}
