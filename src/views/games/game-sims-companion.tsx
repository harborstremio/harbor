import { ModSimsSetup } from "./mod-sims-setup";
import { ModProviderLogo } from "./mod-identity";
import { ModsIcon, ModsTabs } from "./mod-workspace-parts";
import type { SimsMtsProject } from "@/lib/games/sims";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, FolderOpen, LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import { openUrl } from "@/lib/window";
import { transferBytes } from "@/lib/games/transfers";
import { readSimsFolder, rememberSimsFolder, simsDisplayPath, simsCreatorName, simsError, simsFolders, simsInspect, simsKeptFolder, simsWorkspace, type SimsFile, type SimsFolder, type SimsMetadataTarget, type SimsWorkspace } from "@/lib/games/sims";
import packageIcon from "@/assets/settings-icons/package.svg";
import { GameSimsReview, type SimsSelection } from "./game-sims-review";
import { GameSimsTroubleshoot } from "./game-sims-troubleshoot";
import { GameSimsInformation } from "./game-sims-information";
import { GameSimsDependencies } from "./game-sims-dependencies";
import { GameSimsDuplicates } from "./game-sims-duplicates";
import { GameSimsTray } from "./game-sims-tray";
import { GameSimsLot51 } from "./game-sims-lot51";
import { GameSimsMts, type SimsCreatorRequest } from "./game-sims-mts";
import { GameSimsCurseForge } from "./game-sims-curseforge";
import { SimsPackProvider, GameSimsPacks } from "./game-sims-packs";
import type { SimsInstallation } from "@/lib/games/sims-installations";
import { GameSimsCatalog } from "./game-sims-catalog";
import { GameSimsSets } from "./game-sims-sets";
import { GameSaveLauncher } from "./game-saves";
import "./game-sims-companion.css";

const SimsFileIcon = () => <span className="games-sims-file-icon" style={{ maskImage: `url("${packageIcon}")` }} aria-hidden="true"/>;
const simsSaveGame = { id: "steam:1222670", name: "The Sims 4", capsule: "", platforms: ["Windows"] };

function SimsPreview({ path, file, active }: { path: string; file?: string; active: boolean }) {
  const t = useT(), root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false), [src, setSrc] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!active || !root.current || !file?.toLowerCase().endsWith(".package")) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "100px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active, file]);
  useEffect(() => {
    if (!active || !visible || !file) return;
    const controller = new AbortController(); setBusy(true);
    void simsInspect(path, file, controller.signal).then(value => { if (!controller.signal.aborted) setSrc(value.thumbnail ?? ""); }, () => {}).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [path, file, active, visible]);
  return <div ref={root} className={`games-sims-preview${src ? " has-image" : ""}`}>
    {src ? <img src={src} alt={t("games.sims.preview")} onError={() => setSrc("")}/> : <SimsFileIcon/>}
    {busy && <span className="games-sims-preview-loading" role="status" aria-label={t("common.loading")}><LoaderCircle size={22}/></span>}
  </div>;
}

export function GameSimsCompanion({ active, profile, installations = [], workspace = false, requested, globalQuery = "" }: { active: boolean; profile: string; installations?: SimsInstallation[]; workspace?: boolean; requested?: SimsMtsProject; globalQuery?: string }) {
  return <SimsPackProvider key={profile} profile={profile} active={active && isWindowsDesktop()} installations={installations}><SimsCompanionBody active={active} profile={profile} workspace={workspace} requested={requested} globalQuery={globalQuery}/></SimsPackProvider>;
}
function SimsCompanionBody({ active, profile, workspace, requested, globalQuery }: { active: boolean; profile: string; workspace: boolean; requested?: SimsMtsProject; globalQuery: string }) {
  const [browseControls, setBrowseControls] = useState<HTMLSpanElement | null>(null);
  const t = useT(), language = useUiLanguage(), label = (key: string) => t(`games.sims.${key}`), root = useRef<HTMLElement>(null), generation = useRef(0);
  const desktop = isWindowsDesktop();
  const [page, setPage] = useState("browse"), [source, setSource] = useState("mts");
  const lastRequest = useRef<SimsMtsProject | undefined>(undefined);
  const [visible, setVisible] = useState(false), [path, setPath] = useState(() => readSimsFolder(profile)), [folders, setFolders] = useState<SimsFolder[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [data, setData] = useState<SimsWorkspace | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState("managed"), [query, setQuery] = useState(""), [kind, setKind] = useState("all"), [limit, setLimit] = useState(24), [picking, setPicking] = useState(false);
  useEffect(() => { if (workspace) { setQuery(globalQuery); setLimit(24); } }, [globalQuery, workspace]);
  const [editingSet, setEditingSet] = useState(false);
  const [selection, setSelection] = useState<SimsSelection | null>(null);
  const [information, setInformation] = useState<{ target: SimsMetadataTarget; title: string } | null>(null);
  const [creatorRequest, setCreatorRequest] = useState<SimsCreatorRequest | null>(null);
  const openCreator = (project: string, trigger: HTMLElement) => { setPage("browse"); setSource("mts"); setCreatorRequest({ id: crypto.randomUUID(), page: `https://modthesims.info/d/${project}/`, trigger }); };
  useEffect(() => { setCreatorRequest(null); }, [active, path, profile]);
  useEffect(() => { if (requested && active && lastRequest.current !== requested) { lastRequest.current = requested; setPage("browse"); setSource("mts"); setCreatorRequest({ id: crypto.randomUUID(), page: requested.page, project: requested, trigger: document.activeElement as HTMLElement }); } }, [requested, active]);
  const trigger = useRef<HTMLElement | null>(null);
  const chooseInformation = (target: SimsMetadataTarget, title: string) => { trigger.current = document.activeElement as HTMLElement | null; setInformation({ target, title }); };
  useEffect(() => { setInformation(null); }, [active, path, profile]);
  const chooseAction = (value: SimsSelection) => { trigger.current = document.activeElement as HTMLElement | null; setSelection(value); };
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: "200px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active]);
  useEffect(() => { if (!active) setSelection(null); }, [active]);
  useEffect(() => {
    const own = ++generation.current;
    if (!active || !visible || !desktop) return;
    setLoading(true); setError("");
    const load = async () => {
      if (path) {
        const value = await simsWorkspace(path);
        if (own === generation.current) { setData(value); rememberSimsFolder(profile, value.folder.path); }
      } else {
        const found = await simsFolders();
        if (own === generation.current) { setFolders(found); if (found.length === 1) setPath(found[0].path); }
      }
    };
    void load().catch(reason => { if (own === generation.current) { setData(null); setError(simsError(reason)); } }).finally(() => { if (own === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [active, visible, desktop, path, profile, attempt]);
  useEffect(() => { if (data || !active) setSetupOpen(false); }, [data, active]);
  const chooseFolder = async () => {
    if (picking) return; setPicking(true); const own = generation.current;
    try { const chosen = await open({ directory: true, multiple: false, title: label("choose") }); if (chosen && own === generation.current) { setData(null); setPath(chosen); setAttempt(n => n + 1); } }
    catch (reason) { if (own === generation.current) setError(simsError(reason)); }
    finally { setPicking(false); }
  };
  const importFiles = async (id?: string, title = "", adopt = false, tray = false) => {
    if (picking || !data || loading) return;
    // The system file picker and disabled busy button can both move focus to
    // the document before the review opens. Keep the original trigger now.
    trigger.current = document.activeElement as HTMLElement | null;
    setPicking(true); const own = generation.current;
    try {
      const selected = await open({ multiple: true, title: label(tray ? "trayImport" : adopt ? "adopt" : id ? "update" : "install"), defaultPath: adopt ? `${simsDisplayPath(data.folder.path)}/Mods/` : undefined, filters: [{ name: "The Sims 4", extensions: tray ? ["zip", "trayitem", "blueprint", "bpi", "householdbinary", "hhi", "sgi", "room", "rmi", "package", "ts4script", "cfg", "json"] : adopt ? ["package", "ts4script", "cfg", "json"] : ["zip", "package", "ts4script", "cfg", "json"] }] });
      const sources = selected ? Array.isArray(selected) ? selected : [selected] : [];
      if (sources.length && own === generation.current) setSelection({ action: id ? { kind: "update", id } : { kind: tray ? "trayImport" : adopt ? "adopt" : "install", title: "" }, title: title || sources[0].split(/[\\/]/).at(-1)!.replace(/\.(zip|package|ts4script)$/i, ""), sources });
    } catch (reason) { if (own === generation.current) setError(simsError(reason)); }
    finally { setPicking(false); }
  };
  const changed = (value: SimsWorkspace) => { setData(value); setError(""); };
  const needle = query.trim().toLocaleLowerCase(), matches = (value: string) => value.toLocaleLowerCase().includes(needle);
  const groups = data?.state.groups.filter(g => matches(g.title) || g.files.some(f => matches(f.name))) ?? [];
  const files = data?.folder.files.filter(f => matches(f.path) && (kind === "all" || f.kind === kind)) ?? [];
  const backups = [...(data?.state.backups ?? [])].reverse().filter(b => matches(b.group.title));
  const trayItems = data?.tray?.items.filter(item => matches(item.title)) ?? [];
  const count = tab === "managed" ? groups.length : tab === "files" ? files.length : tab === "tray" ? trayItems.length : backups.length;
  const workspaceBusy = loading || picking || !data || data.recoveryNeeded || data.folder.saveRecovery;
  const unavailable = workspaceBusy || !!data?.troubleshooting;
  const date = (at: number) => new Date(at * 1000).toLocaleDateString(language, { dateStyle: "medium" });
  const fileCard = (file: SimsFile) => <article key={file.path} className="games-sims-file"><SimsPreview key={`${path}:${attempt}:${data?.state.revision}:${file.path}`} path={path} file={file.kind === "package" ? file.path : undefined} active={active}/><div><strong dir="auto">{file.path.split('/').at(-1)}</strong><small dir="auto">{file.path.includes('/') ? data?.state.groups.find(g => file.path.startsWith(`Harbor-${g.id}/`))?.title || file.path.slice(0, file.path.lastIndexOf('/')) : "Mods"}</small><p>{label(file.kind)} · {transferBytes(file.bytes)}</p>{file.scriptTooDeep && <p className="games-sims-warning">{label("tooDeep")}</p>}{file.kind !== "settings" && <button className="games-detail-text-button games-sims-info-button" disabled={workspaceBusy || !!selection} onClick={() => chooseInformation({ kind: "file", file: file.path }, file.path.split("/").at(-1)!)}>{label("info")}</button>}</div></article>;
  return <section className={`games-sims${workspace ? " games-inset" : ""}`} ref={root} aria-label={label("title")}>
    {workspace && <ModsTabs label="The Sims 4">{(["browse", "library", "tools"] as const).map(value => <button key={value} aria-current={page === value ? "page" : undefined} onClick={() => setPage(value)}><ModsIcon name={value} size={24}/>{t(`games.modHub.${value}`)}</button>)}<span className="sims-browse-controls" ref={setBrowseControls} hidden={page !== "browse" || (source !== "mts" && source !== "curseforge")}/>{page === "browse" && <span className="sims-source-picker"><Dropdown ariaLabel={t("games.modHub.source")} value={source} options={[{ value: "mts", label: "Mod The Sims", left: <ModProviderLogo source="Mod The Sims" iconOnly/> }, { value: "curseforge", label: "CurseForge", left: <ModProviderLogo source="CurseForge" iconOnly/> }, { value: "lot51", label: "Lot 51" }, { value: "mccc", label: "MC Command Center" }]} onChange={setSource}/></span>}</ModsTabs>}
    <header hidden={workspace && page === "browse"} className={workspace ? "games-sims-header-actions" : undefined}><div><small hidden={workspace}>The Sims 4</small><h2>{workspace ? t(`games.modHub.${page}`) : label("title")}</h2>{!workspace && <p>{label("intro")}</p>}</div>{desktop && <div className="games-sims-actions"><button className="games-button" disabled={picking || loading} onClick={() => void chooseFolder()}><FolderOpen size={17}/>{label(path ? "changeFolder" : "choose")}</button>{data && <button className="games-button games-button-primary" disabled={unavailable} onClick={() => void importFiles(undefined, "", false, tab === "tray")}><Plus size={18}/>{label(tab === "tray" ? "trayImport" : "install")}</button>}</div>}</header>
    {desktop && (!workspace || page === "tools") && <GameSimsPacks/>}
    <div hidden={workspace && (page !== "browse" || source !== "mccc")}>{desktop && <GameSimsCatalog workspace={workspace} setup={() => setSetupOpen(true)} close={() => setSource("mts")} active={active && visible && (!workspace || (page === "browse" && source === "mccc"))} data={data} disabled={unavailable || !!selection} choose={chooseAction} manageExisting={() => void importFiles(undefined, "MC Command Center", true)}/>}</div>
    <div hidden={workspace && (page !== "browse" || source !== "lot51")}>{desktop && <GameSimsLot51 workspace={workspace} setup={() => setSetupOpen(true)} active={active && visible && (!workspace || (page === "browse" && source === "lot51"))} data={data} disabled={unavailable || !!selection} choose={chooseAction} importDownload={(title, target) => void importFiles(target, title)}/>}</div>
    {workspace && <div hidden={page !== "browse" || source !== "curseforge"}><GameSimsCurseForge game={4} active={active && visible && page === "browse" && source === "curseforge"} query={globalQuery} toolbarTarget={browseControls}/></div>}
    <div hidden={workspace && (page !== "browse" || source !== "mts")}>{desktop && <GameSimsMts query={globalQuery} toolbarTarget={source === "mts" ? browseControls : null} workspace={workspace} setup={() => setSetupOpen(true)} key={`mts:${profile}`} request={creatorRequest} profile={profile} active={active && visible && (!workspace || (page === "browse" && source === "mts"))} data={data} disabled={unavailable || !!selection} choose={chooseAction}/>}</div>
    {!desktop ? <p className="games-sims-notice">{label("desktop")}</p> : <>
      {error && <p className="games-sims-notice" role="alert">{t(error)} <button className="games-button" onClick={() => setAttempt(n => n + 1)}>{t("common.retry")}</button></p>}
      {loading && <p className="games-sims-pending" role="status"><LoaderCircle size={20}/>{t("common.loading")}</p>}
      {!data && !loading && !error && (!workspace || page !== "browse") && <div className="games-sims-empty"><SimsFileIcon/><div><h3>{label("connect")}</h3><p>{label("folderNote")}</p>{folders.map(folder => <button className="games-button games-sims-path" key={folder.path} onClick={() => setPath(folder.path)} dir="auto">{simsDisplayPath(folder.path)}</button>)}</div></div>}
      {data && (!workspace || page !== "browse") && <>
        <div className="games-sims-workspace"><div><strong>{t("games.sims.version", { version: data.folder.gameVersion })}</strong><small className="games-sims-path" dir="auto">{simsDisplayPath(data.folder.path)}</small></div><div className="games-sims-actions"><GameSaveLauncher profile={profile} game={simsSaveGame} active={active && !selection && !information && !picking && !editingSet} simsPath={data.folder.path} onChanged={() => setAttempt(n => n + 1)}/><button className="games-icon-button" disabled={loading || !!selection} aria-label={label("refresh")} title={label("refresh")} onClick={() => setAttempt(n => n + 1)}><RefreshCw size={17}/></button></div></div>
        {(data.folder.modsEnabled !== true || data.folder.scriptsEnabled !== true || !data.folder.resourceReady || data.folder.partial) && <details className="games-sims-guidance" open><summary>{label("checkSettings")}<ChevronDown size={16}/></summary><div>
          {(data.folder.modsEnabled !== true || data.folder.scriptsEnabled !== true) && <p>{label("settingsNote")}</p>}
          {!data.folder.resourceReady && <p>{label("resourceNote")}</p>}{data.folder.partial && <p>{label("partial")}</p>}
          <button className="games-detail-text-button" onClick={() => void openUrl("https://help.ea.com/en/articles/the-sims/the-sims-4/mods-and-the-sims-4-game-updates/")}>{label("eaHelp")}<ArrowUpRight size={14}/></button>
        </div></details>}
        {data.folder.saveRecovery && <p className="games-sims-notice" role="status">{t("games.backups.recoveryPrompt")}</p>}
        {data.recoveryNeeded && <p className="games-sims-notice" role="status">{label("recovery")} <button className="games-button" onClick={() => chooseAction({ action: { kind: "recover" }, title: label("recover"), sources: [] })}>{label("recover")}</button></p>}
        {!!data.keptFiles?.length && <details className="games-sims-guidance games-sims-kept-files"><summary><span>{label("keptFiles")}</span><ChevronDown size={16}/></summary><p>{label("keptNote")}</p><div className="games-sims-backups">{data.keptFiles.map(item => <article key={item.id}><div><strong dir="auto">{item.title}</strong><small>{date(item.createdAt)}</small></div><button className="games-button" onClick={() => void (async () => { const own = generation.current; try { const folder = await simsKeptFolder(data.folder.path, item.id); const { openPath } = await import("@tauri-apps/plugin-opener"); if (own === generation.current) await openPath(folder); } catch (reason) { if (own === generation.current) setError(simsError(reason)); } })()}><FolderOpen size={17}/>{t("games.setup.openFolder")}</button></article>)}</div></details>}
        {(!workspace || page === "tools") && <div className="games-sims-tools-only"><GameSimsSets key={`${profile}:${data.folder.path}`} profile={profile} data={data} active={active} disabled={unavailable || !!selection} refreshKey={attempt} choose={chooseAction} editing={setEditingSet}/>
        <GameSimsTroubleshoot data={data} disabled={workspaceBusy || !!selection} choose={chooseAction}/>
        <GameSimsDependencies key={`dependencies:${profile}:${data.folder.path}:${data.state.revision}:${attempt}`} data={data} profile={profile} active={active} disabled={unavailable || !!selection}/>
        <GameSimsDuplicates key={`${profile}:${data.folder.path}:${data.state.revision}:${attempt}`} data={data} profile={profile} active={active} disabled={unavailable || !!selection} choose={chooseAction}/>
        </div>}
        <div hidden={workspace && page !== "library"}><div className="games-sims-tools"><div className="games-sims-tabs">{["managed", "files", "tray", "backups"].map(value => <button key={value} className="games-button" aria-pressed={tab === value} onClick={() => { setTab(value); setLimit(24); }}>{label(value)}</button>)}</div><label className="games-sims-search" data-tv-focus-container><Search size={17}/><input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(24); }} placeholder={t("common.search")} aria-label={t("common.search")} maxLength={120}/></label>{tab === "files" && <Dropdown ariaLabel={label("fileType")} value={kind} options={["all", "package", "script", "settings"].map(value => ({ value, label: label(value) }))} onChange={value => { setKind(value); setLimit(24); }}/>}</div>
        <div className="games-sims-caption-bar"><p className="games-sims-caption">{label(tab === "managed" ? "managedNote" : tab === "files" ? "filesNote" : tab === "tray" ? "trayNote" : "backupsNote")}</p>{tab !== "backups" && tab !== "tray" && <button className="games-detail-text-button" disabled={unavailable} onClick={() => void importFiles(undefined, "", true)}><FolderOpen size={16}/>{label("adopt")}</button>}</div>
        {tab === "managed" ? <div className="games-sims-groups">{groups.slice(0, limit).map(group => <article key={group.id}><SimsPreview key={`${path}:${attempt}:${data.state.revision}:${group.id}`} path={path} file={group.enabled ? group.files.find(f => f.name.toLowerCase().endsWith(".package"))?.name && `Harbor-${group.id}/${group.files.find(f => f.name.toLowerCase().endsWith(".package"))!.name}` : undefined} active={active}/><div className="games-sims-group-main"><h3 dir="auto">{group.title}</h3>{group.source && <small>{simsCreatorName(group.source)}{group.source.provider !== "mts" && <> · {group.source.version}</>}</small>}<p>{t(group.enabled ? "games.mods.enabled" : "games.mods.disabled")} · {`${t("games.sims.setFiles", { count: group.files.length })} · ${transferBytes(group.files.reduce((n, f) => n + f.bytes, 0))}`}</p><small>{date(group.installedAt)}{group.gameVersion !== data.folder.gameVersion && ` · ${label("patchChanged")}`}</small><button className="games-detail-text-button games-sims-info-button" disabled={workspaceBusy || !!selection} onClick={() => chooseInformation({ kind: "group", id: group.id }, group.title)}>{label("info")}</button><div className="games-sims-actions"><button className="games-button" disabled={unavailable} onClick={() => chooseAction({ action: { kind: group.enabled ? "disable" : "enable", id: group.id }, title: group.title, sources: [] })}>{label(group.enabled ? "disable" : "enable")}</button><button className="games-button" disabled={unavailable} onClick={() => void importFiles(group.id, group.title)}>{label("update")}</button><button className="games-detail-text-button" disabled={unavailable} onClick={() => chooseAction({ action: { kind: "remove", id: group.id }, title: group.title, sources: [] })}>{t("common.remove")}</button></div></div></article>)}</div> : tab === "files" ? <><div className="games-sims-gallery">{files.slice(0, limit).filter(f => f.kind === "package").map(fileCard)}</div><div className="games-sims-file-list">{files.slice(0, limit).filter(f => f.kind !== "package").map(fileCard)}</div></> : tab === "tray" ? <GameSimsTray openCreator={openCreator} profile={profile} path={data.folder.path} active={active} revision={`${attempt}:${data.state.revision}`} items={trayItems.slice(0, limit)} disabled={unavailable} choose={chooseAction}/> : <div className="games-sims-backups">{backups.slice(0, limit).map(backup => <article key={backup.id}><div><strong dir="auto">{backup.group.title}</strong><small>{date(backup.createdAt)} · {t("games.sims.version", { version: backup.group.gameVersion })}</small></div><button className="games-button" disabled={unavailable} onClick={() => chooseAction({ action: { kind: "restore", backup: backup.id }, title: backup.group.title, sources: [] })}>{t("games.mods.restore")}</button></article>)}</div>}
        {!count && <p className="games-sims-empty-note">{label(query ? "noMatches" : tab === "managed" ? "emptyManaged" : tab === "backups" ? "emptyBackups" : tab === "tray" ? "trayEmpty" : "emptyFiles")}</p>}
        {count > limit && <button className="games-button" onClick={() => setLimit(n => n + 24)}>{t("games.wow.addons.more")}</button>}</div>
      </>}
    </>}
    {!workspace && <footer><p>{label("compatibility")}</p><button className="games-detail-text-button" onClick={() => void openUrl("https://deaderpool-mccc.com/downloads.html")}>MC Command Center<ArrowUpRight size={14}/></button></footer>}
    {active && setupOpen && <ModSimsSetup folders={folders} loading={loading || picking} error={error} choose={() => void chooseFolder()} scan={() => { setFolders([]); setData(null); setPath(""); setAttempt(n => n + 1); }} select={folder => { setData(null); setPath(folder); setAttempt(n => n + 1); }} close={() => setSetupOpen(false)}/>}
    {active && information && <GameSimsInformation profile={profile} path={data?.folder.path ?? path} target={information.target} title={information.title} trigger={trigger.current} onClose={() => setInformation(null)}/>}
    {active && selection && <GameSimsReview key={`${path}:${selection.action.kind}:${selection.title}`} profile={profile} path={data?.folder.path ?? path} selection={selection} trigger={trigger.current} fallback={root.current?.querySelector<HTMLElement>(".games-sims-test h3")} changed={changed} onClose={() => setSelection(null)}/>} 
  </section>;
}

