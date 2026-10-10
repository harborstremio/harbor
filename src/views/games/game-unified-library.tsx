import { launcherSessionBusy, launcherSessionLabel } from "@/lib/games/launcher-sessions";
import { useLibraryShuffle } from "@/hooks/use-library-shuffle";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { ArrowUpRight, Dices, Download, LayoutGrid, Library, List, MoreHorizontal, RefreshCw, Trash2, X } from "lucide-react";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadGameArtwork } from "@/lib/games/catalog";
import { loadAtlasGame } from "@/lib/games/atlas";
import { LAUNCHER_NAMES } from "@/lib/games/launchers";
import { launcherCatalogLookup } from "@/lib/games/launcher-catalog";
import { UNIFIED_SOURCES, changeUnifiedLibrarySelection, filterUnifiedLibrary, pickUnifiedGame, unifiedLibrary, unifiedLibraryDefaults, type UnifiedLibraryFilters, type UnifiedLibraryGame, type UnifiedSource } from "@/lib/games/unified-library";
import { customCollectionGame, romCollectionGame } from "@/lib/games/personal-collection-library";
import type { PersonalCollectionGame } from "@/lib/games/personal-collections";
import type { GameArtwork, GameSummary } from "@/lib/games/types";
import type { SteamAccount } from "@/hooks/use-steam-account";
import { useGameAccess, type LibraryDestination } from "./game-access";
import { GameSteamImport } from "./game-steam-import";
import { GameLibraryTitles } from "./game-library-titles";
import { GameLibraryLinks } from "./game-library-links";
import { GameLibraryMetadata } from "./game-library-metadata";
import { GameArt } from "./game-art";
import { SteamShortcutIcon } from "./game-steam-shortcut-icon";
import { GameCustomManager } from "./game-custom-library";
import { LibraryStatusFilter } from "./game-library-status";
import { LibraryPlaytimeFilter, LibraryPlaytimeLabel } from "./game-library-playtime";
import { CustomLaunchStatus } from "./game-custom-launch-health";
import { libraryDrives } from "@/lib/games/library-drives";
import { GameLibraryNews } from "./game-library-news";
import { LibrarySourceMark } from "./game-library-marks";
import { GameSteamAccountControl } from "./game-steam-account";
import { GameBattleNetAccountControl } from "./game-battlenet-account";
import { LibraryManageButton, LibraryPreferenceError, LibraryVisibilityFilter } from "./game-library-personal";
import { useLibrarySelection, LibrarySelectButton, LibrarySelectionBar, LibrarySelectionMark } from "./game-library-selection";
import "./game-unified-library.css";

type UnifiedLibraryProps = {requestedSource?:{source:UnifiedSource;revision:number};account:SteamAccount;query:string;active:boolean;open:(game:GameSummary,origin?:HTMLElement)=>void;manage:(mode:LibraryDestination,query?:string)=>void;collect?:(games:PersonalCollectionGame[])=>void};
export function GameUnifiedLibrary(props:UnifiedLibraryProps) {
  return <GameUnifiedLibraryView {...props} access={useGameAccess()}/>;
}
export function GameUnifiedLibraryView({account,query,active,open,manage,collect,access,requestedSource}: UnifiedLibraryProps & {access:Pick<ReturnType<typeof useGameAccess>,"profile"|"library"|"launchers"|"customLibrary"|"emulation"|"libraryPreferences"> & Partial<Pick<ReturnType<typeof useGameAccess>,"shortcuts"|"openShortcut"|"steamImports">>}) {
  const t=useT(),language=useUiLanguage(),shuffle=useLibraryShuffle(access.profile);
  const {library,shortcuts,launchers,customLibrary:custom,emulation,libraryPreferences:prefs}=access;
  const [filters,setFilters]=useState(unifiedLibraryDefaults),[view,setView]=useState<"grid"|"list">("grid"),[limit,setLimit]=useState(36),[art,setArt]=useState<Record<number,GameArtwork>>({});
  const [catalogArt,setCatalogArt]=useState<Record<string,Pick<GameSummary,"capsule"|"portrait"|"igdbId">>>({});
  const catalogArtKey=(game:GameSummary)=>`${game.id}:${game.catalogSteamId??""}:${game.igdbId??""}`;
  const [importOpen,setImportOpen]=useState(false),[importError,setImportError]=useState("");
  const [linksOpen,setLinksOpen]=useState(false),[linksNotice,setLinksNotice]=useState<number|null>(null);
  const [metadataOpen,setMetadataOpen]=useState(false);
  useEffect(()=>{setMetadataOpen(false);},[access.profile,active]);
  useEffect(()=>{setLinksOpen(false);setLinksNotice(null);},[access.profile,active]);
  const [titlesOpen,setTitlesOpen]=useState(false),[titlesNotice,setTitlesNotice]=useState<number|null>(null);
  useEffect(()=>{setTitlesOpen(false);setTitlesNotice(null);},[access.profile,active]);
  useEffect(()=>{setImportOpen(false);setImportError("");},[access.profile,active]);
  const [editingCustom,setEditingCustom]=useState<string|null>(null);
  useEffect(()=>{setEditingCustom(null);},[access.profile,active]);
  const lastSourceRequest=useRef(0);
  const lastPick=useRef<string|undefined>(undefined),controls=useRef<HTMLDivElement>(null);
  const all=useMemo(()=>unifiedLibrary({installed:library.scan?.games??[],steamKnown:!!library.scan&&!library.error,steamComplete:!library.scan?.warnings.length,account:account.status.snapshot,
    steamImports:access.steamImports?.data.games,shortcuts:shortcuts?.games,custom:custom.data.games,customHealth:custom.health,retro:emulation.data,launchers:launchers.scan,launchersKnown:!!launchers.scan&&!launchers.error,preferences:prefs.data}),
    [access.steamImports?.data.games,library.scan,library.error,shortcuts?.games,account.status,custom.data.games,custom.health,emulation.data,launchers.scan,launchers.error,prefs.data]);
  const games=useMemo(()=>filterUnifiedLibrary(all,{...filters,query,...(shuffle.enabled?{sort:"shuffle",shuffleSeed:shuffle.seed} as const:{})}),[all,filters,query,shuffle.enabled,shuffle.seed]),shown=games.slice(0,limit);
  const drives=useMemo(()=>libraryDrives(all,filters.drive),[all,filters.drive]);
  const ids=shown.flatMap(item=>item.game?.steamId?[item.game.steamId]:[]).join(",");
  const missingArt=shown.flatMap(item=>item.game&&(item.game.igdbId||launcherCatalogLookup(item.game.id,item.game.catalogSteamId))&&!item.game.steamId&&!item.game.capsule?[item.game]:[]),missingArtKey=missingArt.map(catalogArtKey).join(",");
  useEffect(()=>{setFilters(unifiedLibraryDefaults());setLimit(36);lastPick.current=undefined;lastSourceRequest.current=0;},[access.profile,account.status.snapshot?.steamId]);
  useEffect(()=>{
    if(!active||!requestedSource||lastSourceRequest.current===requestedSource.revision)return;
    lastSourceRequest.current=requestedSource.revision;
    setFilters({...unifiedLibraryDefaults(),source:requestedSource.source});
  },[active,requestedSource,access.profile,account.status.snapshot?.steamId]);
  useEffect(()=>setLimit(36),[query,filters]);
  useEffect(()=>{if(!active||!ids)return;let current=true;void loadGameArtwork([...new Set(ids.split(",").map(Number))]).then(value=>{if(current)setArt(previous=>({...previous,...value}));},()=>{});return()=>{current=false;};},[active,ids]);
  useEffect(()=>{
    if(!active||!missingArtKey)return;
    const controller=new AbortController();
    // Resolve visible exact catalog/provider IDs, never an edition guessed from its title.
    void (async()=>{for(const game of missingArt){if(controller.signal.aborted)break;const key=catalogArtKey(game);if(catalogArt[key])continue;try{const value=await loadAtlasGame(game,controller.signal);if(value&&!controller.signal.aborted)setCatalogArt(previous=>({...previous,[key]:{igdbId:value.igdbId,capsule:value.capsule,portrait:value.portrait}}));}catch{/* Keep the readable local fallback. */}}})();
    return()=>controller.abort();
  },[active,missingArtKey]);
  const sourceName=(source:UnifiedSource)=>source==="steam"?"Steam":source==="shortcut"?t("games.dock.shortcut"):source in LAUNCHER_NAMES?LAUNCHER_NAMES[source as keyof typeof LAUNCHER_NAMES]:t(source==="custom"?"games.custom.nav":"games.emulation.library");
  const sourceMark=(source:UnifiedSource)=> <LibrarySourceMark source={source} size={18}/>;
  const summary=(item:UnifiedLibraryGame):GameSummary|undefined=>item.game?{...item.game,...catalogArt[catalogArtKey(item.game)],...(item.game.steamId?art[item.game.steamId]:{}),...(item.quick?.source==="steam"?item.quick.install.artwork:{})}:undefined;
  const selection=useLibrarySelection({items:games.map(item=>({id:item.id,name:item.name,pinned:item.favorite,hidden:item.hidden,game:item.quick?.source==="custom"?customCollectionGame(item.quick.custom):item.quick?.source==="retro"?romCollectionGame(item.quick.local):summary(item)})),
    scope:JSON.stringify([access.profile,account.status.snapshot?.steamId,query,filters]),active,
    update:(ids,patch)=>changeUnifiedLibrarySelection(all,ids,patch,{preferences:prefs.update,custom:custom.updateMany}),collect});
  const image=(item:UnifiedLibraryGame)=>item.quick?.source==="custom"&&item.quick.custom.artwork&&isTauri()?convertFileSrc(item.quick.custom.artwork):prefs.cover(item.id,item.game)??(item.quick?.source==="shortcut"?(view==="grid"?item.quick.shortcut.artwork.portrait??item.quick.art:item.quick.art):undefined)??(view==="grid"?summary(item)?.portrait??summary(item)?.capsule:summary(item)?.capsule);
  const destination=(item:UnifiedLibraryGame):LibraryDestination=>item.source==="steam"?"steam":item.source==="retro"?"retro":"custom";
  const choose=(item:UnifiedLibraryGame,origin:HTMLElement)=>{const game=summary(item);if(item.quick?.source==="shortcut"&&!prefs.get(item.id).metadata){access.openShortcut?.(item.id,origin);return;}if(game)open({...game,libraryEntryId:item.id},origin);else if(item.quick?.source==="custom")setEditingCustom(item.quick.custom.id);else manage(destination(item),item.name);};
  const favorite=(item:UnifiedLibraryGame)=>item.quick?.source==="custom"?custom.update(item.quick.custom.id,{pinned:!item.favorite}):prefs.update([item.id],{pinned:!item.favorite});
  const native=(item:UnifiedLibraryGame)=>item.source==="shortcut"?!!shortcuts?.available:item.source==="steam"?library.available:item.source==="custom"?custom.available:item.source==="retro"?emulation.available:launchers.available;
  const busy=(item:UnifiedLibraryGame)=>{const quick=item.quick;return quick?.source==="shortcut"?!!shortcuts?.launching||!!shortcuts?.running.some(process=>process.id===quick.id):quick?.source==="steam"?library.launching!==null:quick?.source==="launcher"?launchers.launching!==null||launcherSessionBusy(quick.install):quick?.source==="custom"?custom.busy.includes(quick.custom.id)||custom.running.some(p=>p.id===quick.custom.id):quick?.source==="retro"?!!emulation.busy||emulation.running.some(p=>p.path===quick.local.path):account.installing!==null;};
  const launch=(item:UnifiedLibraryGame)=>{
    if(!native(item))return;const quick=item.quick;
    if(item.state==="notInstalled"&&item.owned){void account.install(item.owned.appId);return;}
    if(!["ready","client"].includes(item.state))return;
    if(quick?.source==="steam")void library.launch(quick.install.appId);
    else if(quick?.source==="shortcut")void shortcuts?.launch(quick.shortcut);
    else if(quick?.source==="custom")void custom.launch(quick.custom);
    else if(quick?.source==="retro")void emulation.launch(quick.local);
    else if(quick?.source==="launcher")void launchers.launch(quick.install.id);
  };
  const refreshing=!!shortcuts?.loading||custom.checking||library.loading||launchers.loading||emulation.busy==="scan";
  const refresh=()=>{void shortcuts?.refresh();void library.refresh();void launchers.refresh();void custom.refresh();void emulation.refresh();};
  const clear=()=>{if(shuffle.enabled&&!shuffle.save(false))return;setFilters(unifiedLibraryDefaults());requestAnimationFrame(()=>controls.current?.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')?.focus({preventScroll:true}));};
  const error=[shortcuts?.error,library.launchError?"games.dock.launchError":"",launchers.launchError?"games.dock.launchError":"",launchers.sessionError?"games.launcherSession.error":"",custom.error,emulation.error].find(Boolean);
  const scanError=library.error||launchers.error||Object.values(custom.health).some(value=>value.state==="unknown")||emulation.data.folders.some(folder=>folder.unavailable),partial=!!library.scan?.warnings.length||!!launchers.scan?.warnings.length;
  const hasFilters=filters.source!=="all"||filters.availability!=="all"||filters.visibility!=="visible"||(filters.playtime??"all")!=="all"||(filters.playStatus??"all")!=="all"||(filters.drive??"all")!=="all";
  const showPlaytime=(filters.playtime??"all")!=="all"||filters.sort==="leastTime"||filters.sort==="mostTime";
  return <section className="games-unified-library games-inset">
    <div className="games-section-heading"><div><h2>{t("games.sidebar.allGames")}</h2></div><div className="games-unified-header-actions">{access.steamImports&&<button className="games-button" disabled={!access.steamImports.ready} onClick={()=>setImportOpen(true)}>{t("games.steamImport.title")}</button>}<HoverTooltip label={t("games.unified.refresh")}><button className="games-icon-button" disabled={refreshing||!library.available&&!launchers.available&&!custom.available&&!emulation.available} aria-label={t("games.unified.refresh")} onClick={refresh}><RefreshCw size={18} className={refreshing?"is-scanning":""}/></button></HoverTooltip><button className="games-button" onClick={()=>manage("custom")}>{t("games.custom.add")}</button></div></div>
    <div className="games-library-accounts"><GameSteamAccountControl account={account} active={active}/>{launchers.battlenet&&<GameBattleNetAccountControl account={launchers.battlenet} active={active}/>}</div>{(access.steamImports?.error||importError)&&<div className="games-unified-notice" role="alert"><span>{t(access.steamImports?.error||importError)}</span><button onClick={()=>{access.steamImports?.refresh();setImportError("");}}>{t("common.retry")}</button></div>}<LibraryPreferenceError preferences={prefs}/>{titlesNotice!==null&&<p className="games-unified-notice" role="status">{t("games.titles.applied",{count:titlesNotice})}</p>}
    {account.status.snapshot&&!account.status.snapshot.libraryVisible&&<div className="games-unified-notice" role="status"><span>{t("games.account.privateTitle")}</span><button onClick={()=>manage("steam")}>{t("games.unified.steam")}</button></div>}
    {!library.available&&<p className="games-unified-notice">{t("games.unified.browser")}</p>}
    {(scanError||partial)&&<div className="games-unified-notice" role="status"><span>{t(scanError?"games.unified.scanNote":"games.unified.partial")}</span><button disabled={refreshing} onClick={refresh}>{t("common.retry")}</button></div>}
    {error&&<div className="games-unified-notice" role="alert"><span>{t(error)}</span><button aria-label={t("common.close")} onClick={()=>{shortcuts?.dismissError();library.dismissLaunchError();launchers.dismissLaunchError();custom.dismissError();emulation.dismissError();}}><X size={16}/></button></div>}
    <div className="games-unified-tools" ref={controls}>
      {shuffle.error&&<p role="alert">{t("games.shuffle.error")} <button className="games-button" onClick={()=>shuffle.save(true,true)}>{t("games.shuffle.again")}</button></p>}
      <div className="games-unified-result"><span role="status">{t("games.unified.results",{count:games.length.toLocaleString(language),total:all.length.toLocaleString(language)})}</span><div className="games-unified-result-actions"><button className="games-button" disabled={!all.length||!prefs.ready||prefs.busy||selection.busy} onClick={()=>{prefs.dismissError();setMetadataOpen(true);}}>{t("games.metadataImport.title")}</button><button className="games-button" disabled={!prefs.ready||prefs.busy||selection.busy} onClick={()=>{prefs.dismissError();setTitlesOpen(true);}}>{t("games.titles.title")}</button><button className="games-button" disabled={!prefs.ready||prefs.busy||selection.busy} onClick={()=>{prefs.dismissError();setLinksOpen(true);}}>{t("games.links.sort")}</button><LibrarySelectButton selection={selection} disabled={!games.length||prefs.busy||custom.busy.length>0}/><HoverTooltip label={t("games.owned.pickHint")}><button className="games-button" disabled={selection.mode||!games.some(item=>!!item.game||!!item.quick)} onClick={event=>{const item=pickUnifiedGame(games,lastPick.current);if(item){lastPick.current=item.id;choose(item,event.currentTarget);}}}><Dices size={17}/>{t("games.owned.pick")}</button></HoverTooltip></div></div>
      <div className="games-unified-filters"><Dropdown value={filters.source} onChange={value=>setFilters({...filters,source:value as UnifiedLibraryFilters["source"]})} ariaLabel={t("games.dock.source")} size="sm" options={[{value:"all",label:t("games.unified.allSources")},...UNIFIED_SOURCES.map(source=>({value:source,label:sourceName(source),left:sourceMark(source)}))]}/>
        <Dropdown value={filters.availability} onChange={value=>setFilters({...filters,availability:value as UnifiedLibraryFilters["availability"]})} ariaLabel={t("games.unified.availability")} size="sm" options={[{value:"all",label:t("games.unified.anyState")},{value:"ready",label:t("games.unified.ready")},{value:"notInstalled",label:t("games.unified.state.notInstalled")},{value:"attention",label:t("games.unified.attention")}]}/>
        {(drives.length>0||(filters.drive??"all")!=="all")&&<Dropdown className="games-unified-drive" value={filters.drive??"all"} onChange={drive=>setFilters({...filters,drive})} ariaLabel={t("games.unified.drive.label")} size="sm" options={[{value:"all",label:t("games.unified.drive.all")},...drives.map(drive=>({value:drive.id,label:drive.label,dir:"ltr" as const})),{value:"unassigned",label:t("games.unified.drive.unknown")} ]}/>}
        <LibraryStatusFilter value={filters.playStatus} onChange={playStatus=>setFilters({...filters,playStatus})}/><LibraryPlaytimeFilter value={filters.playtime} onChange={playtime=>setFilters({...filters,playtime})}/><LibraryVisibilityFilter value={filters.visibility} setValue={visibility=>setFilters({...filters,visibility})}/><Dropdown value={shuffle.enabled?"shuffle":filters.sort} onChange={value=>{if(value==="shuffle"){shuffle.save(true);return;}if(shuffle.enabled&&!shuffle.save(false))return;setFilters({...filters,sort:value as UnifiedLibraryFilters["sort"]});}} ariaLabel={t("games.dock.sort")} size="sm" options={[{value:"recent",label:t("games.dock.recentSort")},{value:"name",label:t("games.dock.nameSort")},{value:"leastTime",label:t("games.unified.playtime.least")},{value:"mostTime",label:t("games.unified.playtime.most")},{value:"shuffle",label:t("games.shuffle.sort")}]}/>{shuffle.enabled&&<button className="games-button" onClick={()=>shuffle.save(true,true)}><Dices size={17}/>{t("games.shuffle.again")}</button>}
        <div className="games-library-view"><button className="games-icon-button" aria-label={t("games.library.grid")} aria-pressed={view==="grid"} onClick={()=>setView("grid")}><LayoutGrid size={17}/></button><button className="games-icon-button" aria-label={t("games.library.list")} aria-pressed={view==="list"} onClick={()=>setView("list")}><List size={18}/></button></div>{hasFilters&&<button className="games-unified-clear" onClick={clear}>{t("games.unified.clear")}</button>}
      </div>
    </div>
    {linksNotice!==null&&<p className="games-unified-notice" role="status">{t("games.links.applied",{count:linksNotice})}</p>}
    {showPlaytime&&<p className="games-unified-playtime-note">{t("games.unified.playtime.note")}</p>}
    <LibrarySelectionBar selection={selection}/>
    <div hidden={selection.mode}><GameLibraryNews profile={access.profile} games={games} active={active&&!selection.mode} open={open}/></div>
    {!all.length&&refreshing?<div className="games-library-grid" aria-busy="true">{Array.from({length:6},(_,i)=><div key={i} className="games-library-card-skeleton"/>)}</div>:games.length?<div className={`games-library-${view}`} data-selection={selection.mode}>{shown.map(item=>{const quick=item.quick,canAct=["ready","client"].includes(item.state)||(item.state==="notInstalled"&&!!item.owned),action=item.state==="notInstalled"?"games.account.install":item.state==="client"?"games.dock.client":"games.library.play";return <article key={item.id} data-unified={item.id} className="games-library-card">
      <div className="games-unified-cover"><button className="games-library-card-art" data-game={item.game?.id} aria-label={t("games.dock.details",{name:item.name})} {...selection.props(item.id,item.name,event=>choose(item,event.currentTarget))}>{image(item)?<GameArt src={image(item)??""} fallback={summary(item)?.capsule}/>:<span className="games-unified-no-art">{item.quick?.source==="shortcut"&&shortcuts?<SteamShortcutIcon game={item.quick.shortcut} library={shortcuts} active={active}/>:<LibrarySourceMark source={item.source} size={38}/>}<strong dir="auto">{item.name}</strong></span>}<LibrarySelectionMark selection={selection} id={item.id}/><span className="games-library-card-open"><ArrowUpRight size={20}/></span></button><button className="games-unified-favorite games-icon-button" aria-label={t(item.favorite?"games.dock.unfavoriteGame":"games.dock.favoriteGame",{name:item.name})} aria-pressed={item.favorite} disabled={prefs.busy||custom.busy.length>0} onClick={()=>void favorite(item)}><MusicGlyph name={item.favorite?"heart-filled":"heart"} size={15}/></button></div>
      <div className="games-library-card-copy"><button dir="auto" title={item.name} {...selection.props(item.id,item.name,event=>choose(item,event.currentTarget))}>{item.name}</button><p>{sourceMark(item.source)}<span>{sourceName(item.source)}{item.imported&&!item.owned&&!item.quick?` · ${t("games.steamImport.manual")}`:""}</span></p>{quick?.source==="custom"?<CustomLaunchStatus game={quick.custom} library={custom}/>:<span className="games-unified-state" data-state={quick?.source==="launcher"&&quick.install.activity?.state||item.state}>{item.state==="ready"&&(!quick||quick.source!=="launcher"||!quick.install.activity?.state||quick.install.activity.state==="running")&&<i/>}{t(quick?.source==="launcher"&&launcherSessionLabel(quick.install)|| (quick?.source==="shortcut"?`games.shortcuts.state.${quick.shortcut.state}`:`games.unified.state.${item.state}`))}</span>}{item.lastPlayed>0&&<small className="games-unified-last-played">{t("games.unified.lastPlayed",{date:new Date(item.lastPlayed).toLocaleDateString(language,{month:"short",day:"numeric",year:"numeric"})})}</small>}<LibraryPlaytimeLabel game={item} showUnknown={showPlaytime}/>{item.playStatus&&item.playStatus!=="unset"&&<small className="games-unified-play-status">{t(`games.libraryStatus.${item.playStatus}`)}</small>}</div>
      <div className="games-unified-actions">{item.imported&&access.steamImports&&<button className="games-icon-button" title={t("games.steamImport.remove",{name:item.name})} aria-label={t("games.steamImport.remove",{name:item.name})} onClick={()=>{void access.steamImports!.update([], [item.imported!.game.steamId!]).catch(()=>setImportError("games.steamImport.writeError"));}}><Trash2 size={18}/></button>}{canAct?<button className="games-button games-launch" disabled={!native(item)||busy(item)||(item.state==="notInstalled"&&!account.status.connected)} onClick={()=>launch(item)} aria-label={item.state==="notInstalled"?t("games.account.installNamed",{name:item.name}):item.state==="client"?t("games.dock.openClient",{name:item.name,launcher:sourceName(item.source)}):t("games.library.playGame",{name:item.name})}>{item.state==="notInstalled"?<Download size={15}/>:item.state==="client"?<ArrowUpRight size={15}/>:<Play size={14}/>}{t(quick?.source==="launcher"&&launcherSessionBusy(quick.install)&&launcherSessionLabel(quick.install)|| (busy(item)?(quick?.source==="custom"&&custom.running.some(process=>process.id===quick.custom.id)||quick?.source==="shortcut"&&shortcuts?.running.some(process=>process.id===quick.id))?"games.custom.running":item.source==="steam"?"games.library.opening":"common.loading":action),{launcher:sourceName(item.source)})}</button>:<button className="games-button games-launch" onClick={event=>quick?.source==="custom"?setEditingCustom(quick.custom.id):choose(item,event.currentTarget)}>{t(quick?.source==="custom"?"games.launchHealth.repair":"games.library.details")}</button>}{quick?.source==="custom"?<button className="games-icon-button" aria-label={t("games.unified.manage",{name:item.name})} onClick={()=>setEditingCustom(quick.custom.id)}><MoreHorizontal size={18}/></button>:<LibraryManageButton preferences={prefs} item={{id:item.id,name:item.name,cover:summary(item)?.portrait??summary(item)?.capsule,game:item.game}}/>}</div>
    </article>;})}</div>:<div className="games-state"><Library size={30}/><h3>{t(all.length?"games.noResults":"games.unified.empty")}</h3><p>{t(all.length?"games.library.changeFilters":"games.unified.emptyNote")}</p>{hasFilters&&<button className="games-button" onClick={clear}>{t("games.unified.clear")}</button>}</div>}
    {shown.length<games.length&&<button className="games-button games-library-more" onClick={()=>setLimit(value=>value+36)}>{t("games.library.showMore")}</button>}
    <footer className="games-unified-manage"><button onClick={()=>manage("steam")}>{t("games.unified.steam")}</button><button onClick={()=>manage("custom")}>{t("games.unified.pcGames")}</button><button onClick={()=>manage("retro")}>{t("games.unified.roms")}</button></footer>
    {linksOpen&&active&&<GameLibraryLinks key={access.profile} preferences={prefs} items={all.map(item=>({id:item.id,name:item.name,game:item.game}))} selectedIds={selection.selected} onClose={()=>setLinksOpen(false)} onApplied={count=>setLinksNotice(count)}/>}
    {titlesOpen&&active&&<GameLibraryTitles key={access.profile} preferences={prefs} items={all.map(item=>({id:item.id,name:item.name,original:item.originalName??item.name}))} selectedIds={selection.selected} onClose={()=>setTitlesOpen(false)} onApplied={count=>setTitlesNotice(count)}/>}
    {metadataOpen&&active&&<GameLibraryMetadata key={access.profile} access={access} items={all} selectedIds={selection.selected} onClose={()=>setMetadataOpen(false)}/>}
    {importOpen&&active&&access.steamImports&&<GameSteamImport key={access.profile} library={access.steamImports} existing={new Set(all.filter(item=>item.source==="steam").flatMap(item=>item.game?.steamId?[item.game.steamId]:[]))} onClose={()=>setImportOpen(false)}/>}
    {editingCustom&&active&&<GameCustomManager key={`${access.profile}:${editingCustom}`} id={editingCustom} library={custom} onClose={()=>setEditingCustom(null)}/>}
  </section>;
}
