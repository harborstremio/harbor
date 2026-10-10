import { GameNotesButton } from "./game-notes-launcher";
import { HydraOriginalSettings } from './game-hydra-settings';
import { GamePlayButton } from "./game-play-button";
import { GameExecutionPermission } from "./game-execution-permission";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Check, Eye, EyeOff, FolderOpen, Link, LoaderCircle, Monitor, Pin, Plus, Settings2, Trash2, X } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Dropdown } from "@/components/dropdown";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { GamesIcon } from "@/components/icons/games-icon";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";
import { useSectionBack } from "@/lib/section-back";
import { useGameLibraryPreferences } from "@/hooks/use-game-library-preferences";
import type { CustomGameLibrary } from "@/hooks/use-custom-game-library";
import { customGameName, customPlaytime, customGameSummary, customLinkedGame, emptyLaunchConfig, filterCustomGames, launchArguments, matchingCustomGames, type CustomGame, type LaunchConfig } from "@/lib/games/custom-library";
import { customCollectionGame } from "@/lib/games/personal-collection-library";
import type { PersonalCollectionGame } from "@/lib/games/personal-collections";
import type { GameSummary } from "@/lib/games/types";
import { saveDisplayPath } from "@/lib/games/saves";
import { GameArt } from "./game-art";
import { GameMatch } from "./game-match";
import { CustomGameArtwork } from "./game-custom-artwork";
import { GameSaveLauncher } from "./game-saves";
import { CustomLibraryStatusSetting } from "./game-library-status";
import { CustomPlaytimeEditor, CustomPlaytimeLabel } from "./game-custom-playtime";
import { CustomLaunchSetup, CustomLaunchStatus } from "./game-custom-launch-health";
import { customLaunchHealth, relocateCustomExecutable } from "@/lib/games/custom-launch-health";
import "./game-custom-library.css";

export function CustomPlayButton({ game, library, active = true, name = game.name }: { game: CustomGame; library: CustomGameLibrary; active?: boolean; name?: string }) {
  const t = useT(), running = library.running.some(p => p.id === game.id), busy = library.busy.includes(game.id);
  const [repair, setRepair] = useState(false), ready = customLaunchHealth(game, library.health)?.state === "ready";
  useEffect(() => setRepair(false), [library.profile, game.id, active]);
  return <><GamePlayButton className="games-custom-play" phase={running ? "running" : busy ? "launching" : ready ? "ready" : "repair"} unavailable={!library.available} onClick={() => ready ? void library.launch(game) : setRepair(true)} ariaLabel={t(running ? "games.custom.running" : busy ? "games.setup.launching" : ready ? "games.library.playGame" : "games.launchHealth.repairNamed", { name })} label={t(running ? "games.custom.running" : busy ? "games.setup.launching" : ready ? "games.library.play" : "games.launchHealth.repair")}/>{repair&&active&&<GameCustomManager key={`${library.profile}:${game.id}`} id={game.id} library={library} onClose={()=>setRepair(false)}/>}</>;
}
import { useLibrarySelection, LibrarySelectButton, LibrarySelectionBar, LibrarySelectionMark } from "./game-library-selection";

export function GameCustomLibrary({ library, query, active, open, collect }: { library: CustomGameLibrary; query: string; active: boolean; open: (game: GameSummary) => void; collect?: (games: PersonalCollectionGame[]) => void }) {
  const t = useT(), [editing, setEditing] = useState<CustomGame | "new" | null>(null), [matching, setMatching] = useState<CustomGame | null>(null);
  const [visibility, setVisibility] = useState("visible"), [sort, setSort] = useState("recent"), [limit, setLimit] = useState(36);
  const [availability, setAvailability] = useState("all"), [playtime, setPlaytime] = useState("all"), [pinnedOnly, setPinnedOnly] = useState(false);
  const filtered = availability !== "all" || playtime !== "all" || pinnedOnly;
  const resetFilters = () => { setAvailability("all"); setPlaytime("all"); setPinnedOnly(false); };
  const preferences = useGameLibraryPreferences(library.profile,active);
  const title = (game: CustomGame) => preferences.title(`custom:${game.id}`,game.name);
  const artwork = (game: CustomGame) => game.artwork ? convertFileSrc(game.artwork) : preferences.cover(`custom:${game.id}`,game.linked??undefined) ?? game.linked?.capsule;
  const games = filterCustomGames(library.data, "", visibility, sort).filter(game => {
    const health = customLaunchHealth(game, library.health), running = library.running.some(process => process.id === game.id), seconds = customPlaytime(game);
    return (!pinnedOnly || game.pinned) && (availability === "all" || availability === "running" && running || availability === "ready" && health?.state === "ready" || availability === "attention" && health?.state === "attention") && (playtime === "all" || playtime === "zero" && seconds === 0 || playtime === "played" && seconds > 0);
  }).filter(game=>preferences.matchesTitle(`custom:${game.id}`,game.name,query)||game.linked?.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>sort==="name"?Number(b.pinned)-Number(a.pinned)||title(a).localeCompare(title(b)):0);
  const selection = useLibrarySelection({ items: games.map(game => ({ id: game.id, name: title(game), pinned: game.pinned, hidden: game.hidden, game: customCollectionGame(game) })), scope: JSON.stringify([library.profile, query, visibility, availability, playtime, pinnedOnly]), active, update: library.updateMany, collect });
  useEffect(() => setLimit(36), [query, visibility, sort, availability, playtime, pinnedOnly]);
  useEffect(() => { if (!active) { setEditing(null); setMatching(null); } }, [active]);
  useEffect(() => { setEditing(null); setMatching(null); resetFilters(); }, [library.profile]);
  return <section className="games-custom games-inset">
    <div className="games-section-heading"><div><h2>{t("games.custom.title")}</h2></div>{library.available && <button className="games-button games-button-primary games-custom-add" onClick={() => setEditing("new")}><Plus size={18} />{t("games.custom.add")}</button>}</div>
    {library.error && <div className="games-custom-error" role="alert"><span>{t(library.error)}</span><button className="games-icon-button" aria-label={t("common.close")} onClick={library.dismissError}><X size={16} /></button></div>}
    {!library.available ? <div className="games-custom-empty"><GamesIcon size={40} /><h3>{t("games.custom.desktopTitle")}</h3><p>{t("games.custom.desktopNote")}</p></div> : <>
      {library.data.games.length > 0 && <div className="games-custom-toolbar"><span role="status">{t(games.length === 1 ? "games.collections.one" : "games.collections.count", { count: games.length })}</span><div><LibrarySelectButton selection={selection} disabled={library.busy.length > 0 || !games.length}/><Dropdown size="sm" ariaLabel={t("games.custom.visibility")} value={visibility} onChange={setVisibility} options={[{ value: "visible", label: t("games.custom.visible") }, { value: "hidden", label: t("games.custom.hidden") }]} /><Dropdown size="sm" ariaLabel={t("games.library.sort")} value={sort} onChange={setSort} options={["recent", "name", "added"].map(value => ({ value, label: t(`games.custom.sort.${value}`) }))} /></div></div>}
      {library.data.games.length > 0 && <div className="games-custom-filters">
        <Dropdown size="sm" ariaLabel={t("games.unified.availability")} value={availability} onChange={setAvailability} options={[{value:"all",label:t("games.unified.anyState")},{value:"ready",label:t("games.unified.ready")},{value:"running",label:t("games.custom.running")},{value:"attention",label:t("games.unified.attention")}]}/>
        <Dropdown size="sm" ariaLabel={t("games.unified.playtime")} value={playtime} onChange={setPlaytime} options={["all","zero","played"].map(value=>({value,label:t(`games.unified.playtime.${value}`)}))}/>
        <button className="games-button games-custom-pinned-filter" aria-pressed={pinnedOnly} onClick={()=>setPinnedOnly(value=>!value)}><Pin size={15}/>{t("games.custom.pinned")}</button>
        {filtered && <button className="games-text-action" onClick={resetFilters}><X size={15}/>{t("games.catalog.reset")}</button>}
      </div>}
      <LibrarySelectionBar selection={selection}/>
      {games.length ? <div className="games-custom-grid" data-selection={selection.mode}>{games.slice(0, limit).map(game => <article className="games-custom-card" key={game.id} data-custom-game={game.id}>
        <button className="games-custom-art" aria-label={t(game.linked ? "games.library.gameDetails" : "games.custom.manageNamed", { name: title(game) })} {...selection.props(game.id, title(game), () => game.linked ? open({...game.linked,libraryEntryId:`custom:${game.id}`}) : setEditing(game))}>{artwork(game) ? <GameArt src={artwork(game)!} fallback={game.linked?.capsule} /> : <span className="games-custom-art-empty"><GamesIcon size={43} /><span>{title(game).slice(0, 1).toLocaleUpperCase()}</span></span>}{game.pinned && <span className="games-custom-pin" aria-label={t("games.custom.pinned")}><Pin size={15} fill="currentColor" /></span>}<LibrarySelectionMark selection={selection} id={game.id}/><span className="games-custom-enter"><ArrowUpRight size={20} /></span></button>
        <div className="games-custom-card-name"><h3>{title(game)}</h3><span>{game.launchPending ? t("games.hydra.imported") : game.config.mode === "native" ? t("games.custom.localFile") : game.config.mode === "wine" ? "Wine" : "Proton"}</span><CustomLaunchStatus game={game} library={library}/><CustomPlaytimeLabel game={game}/></div><div className="games-custom-card-actions"><CustomPlayButton game={game} name={title(game)} library={library} active={active} /><button className="games-icon-button" aria-label={t("games.custom.manageNamed", { name: title(game) })} onClick={() => setEditing(game)}><Settings2 size={19} /></button></div>
      </article>)}</div> : <div className="games-custom-empty"><GamesIcon size={40} /><h3>{t(query || filtered ? "games.noResults" : visibility === "hidden" ? "games.custom.noHidden" : "games.custom.empty")}</h3><p>{t(filtered ? "games.dock.tryFilters" : query ? "games.trySearch" : visibility === "hidden" ? "games.custom.hiddenNote" : "games.custom.emptyNote")}</p>{filtered && <button className="games-button" onClick={resetFilters}>{t("games.catalog.reset")}</button>}{!filtered && !query && visibility !== "hidden" && <button className="games-button" onClick={() => setEditing("new")}><Plus size={17} />{t("games.custom.add")}</button>}</div>}
      {games.length > limit && <button className="games-button games-library-more" onClick={() => setLimit(value => value + 36)}>{t("games.library.showMore")}</button>}
    </>}
    {editing && active && <CustomGameEditor key={editing === "new" ? "new" : editing.id} game={editing === "new" ? undefined : library.data.games.find(g => g.id === editing.id) ?? editing} library={library} onClose={() => setEditing(null)} onMatch={game => { setMatching(game); }} />}
    {matching && active && <GameMatch localCover={!!matching.artwork||!!preferences.get(`custom:${matching.id}`).cover} game={{ name: matching.name, path: matching.config.executable, system: 6, linked: matching.linked ?? undefined }} platform={osClass() === "macos" ? { id: 14, name: "Mac", short: "Mac" } : osClass() === "linux" && matching.config.mode === "native" ? { id: 3, name: "Linux", short: "Linux" } : { id: 6, name: "PC (Windows)", short: "PC" }} onMatch={value => library.update(matching.id, { linked: customLinkedGame(value) })} onClose={() => setMatching(null)} />}
  </section>;
}

export function GameCustomManager({id,library,onClose}:{id:string;library:CustomGameLibrary;onClose:()=>void}) {
  const [matching,setMatching]=useState(false), preferences=useGameLibraryPreferences(library.profile,true);
  const game=library.data.games.find(game=>game.id===id);
  useEffect(()=>{if(!game)onClose();},[!!game]);
  if(!game)return null;
  return <><CustomGameEditor game={game} library={library} onClose={onClose} onMatch={()=>setMatching(true)}/>{matching&&<GameMatch localCover={!!game.artwork||!!preferences.get(`custom:${game.id}`).cover} game={{name:game.name,path:game.config.executable,system:6,linked:game.linked??undefined}} platform={osClass()==="macos"?{id:14,name:"Mac",short:"Mac"}:osClass()==="linux"&&game.config.mode==="native"?{id:3,name:"Linux",short:"Linux"}:{id:6,name:"PC (Windows)",short:"PC"}} onMatch={value=>library.update(game.id,{linked:customLinkedGame(value)})} onClose={()=>setMatching(false)}/>}</>;
}

function CustomGameEditor({ game, library, onClose, onMatch }: { game?: CustomGame; library: CustomGameLibrary; onClose: () => void; onMatch: (game: CustomGame) => void }) {
  const t = useT(), titleId = useId(), root = useRef<HTMLDivElement>(null), live = useRef(true);
  const [playtimeEditing, setPlaytimeEditing] = useState(false);
  const playtimeBack = useRef<(() => void) | null>(null), setPlaytimeBack = useCallback((handler: (() => void) | null) => { playtimeBack.current = handler; setPlaytimeEditing(!!handler); }, []);
  const closeHandler = useRef(onClose); closeHandler.current = onClose;
  const finishClose = useCallback(() => closeHandler.current(), []);
  const { closing, close } = useModalExit(finishClose);
  const [id] = useState(() => game?.id ?? crypto.randomUUID()), [name, setName] = useState(game?.name ?? "");
  const [config, setConfig] = useState<LaunchConfig>(game?.config ?? emptyLaunchConfig()), [args, setArgs] = useState(game?.config.arguments.join("\n") ?? "");
  const [choosing, setChoosing] = useState(false), [saving, setSaving] = useState(false), [remove, setRemove] = useState(false), [error, setError] = useState("");
  const busy = choosing || saving || library.busy.includes(id), running = library.running.some(p => p.id === id);
  const dismiss = () => { if (playtimeBack.current) playtimeBack.current(); else if (!saving) close(); };
  useSectionBack(dismiss, true);
  useEffect(() => {
    live.current = true; const previous = document.activeElement as HTMLElement | null, dialog = root.current?.closest<HTMLElement>('[role="dialog"]');
    dialog?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => { if (event.key !== "Tab" || !dialog || [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1) !== dialog || (document.activeElement as Element)?.closest('[data-dropdown-menu]')) return; const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary')].filter(e => e.getClientRects().length); const first = items[0], last = items[items.length - 1]; if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); } };
    document.addEventListener("keydown", trap); return () => { live.current = false; document.removeEventListener("keydown", trap); (previous?.isConnected ? previous : document.querySelector<HTMLElement>(".games-custom-add, .games-unified-filters button"))?.focus({ preventScroll: true }); };
  }, []);
  const choose = async (field: "executable" | "workingDirectory" | "runner" | "prefix" | "steamDirectory") => {
    if (busy) return; setChoosing(true); setError("");
    try { const { open } = await import("@tauri-apps/plugin-dialog"); const path = await open({ multiple: false, directory: ["workingDirectory", "prefix", "steamDirectory"].includes(field), title: t(`games.custom.choose.${field}`), ...(field === "executable" && (osClass() === "windows" || config.mode !== "native") ? { filters: [{ name: t("games.custom.executable"), extensions: ["exe"] }] } : {}) }); if (typeof path === "string" && live.current) { setConfig(previous => field === "executable" ? relocateCustomExecutable(previous, path) : ({ ...previous, [field]: path })); if (field === "executable" && !name.trim()) setName(customGameName(path)); } } catch { if (live.current) setError("games.custom.launch_path"); } finally { if (live.current) setChoosing(false); }
  };
  const save = async () => {
    if (busy || !name.trim()) return; setSaving(true); setError("");
    try { const value: CustomGame = { id, name: name.trim(), config: { ...config, arguments: launchArguments(args) }, linked: game?.linked ?? null, artwork: game?.artwork ?? null, pinned: game?.pinned ?? false, hidden: game?.hidden ?? false, addedAt: game?.addedAt ?? Date.now(), lastPlayed: game?.lastPlayed ?? 0, measuredSeconds: game?.measuredSeconds ?? 0 }; if (await library.save(value)) close(); } catch { setError("games.custom.launch_arguments"); } finally { if (live.current) setSaving(false); }
  };
  const pathField = (field: "executable" | "workingDirectory" | "runner" | "prefix" | "steamDirectory", optional = false) => <div className="games-custom-path-field"><span>{t(`games.custom.field.${field}`)}</span><button type="button" disabled={busy} onClick={() => void choose(field)}><span title={config[field] ?? ""}>{config[field] ? saveDisplayPath(config[field]!) : t(`games.custom.choose.${field}`)}</span><FolderOpen size={17} /></button>{optional && config[field] && <button type="button" className="games-custom-reset" disabled={busy} onClick={() => setConfig(value => ({ ...value, [field]: null }))}>{t("games.custom.useDefault")}</button>}</div>;
  return <ModalShell closing={closing} onDismiss={dismiss} width={640} labelledBy={titleId} backdropClassName="games-custom-backdrop"><div className="games-custom-editor" ref={root}>
    <header><div><span className="games-section-kicker">{t("games.custom.localFile")}</span><h2 id={titleId}>{t(game ? "games.custom.manage" : "games.custom.add")}</h2></div><button className="games-icon-button" disabled={saving} onClick={dismiss} aria-label={t("common.close")}><X size={19} /></button></header>
    <div className="games-custom-editor-scroll">{game&&<CustomLaunchSetup game={game} library={library} draft={{...config,arguments:args.split(/\r?\n/).filter(Boolean)}}/>}<label className="games-custom-name"><span>{t("games.custom.name")}</span><input value={name} maxLength={160} onChange={event => setName(event.target.value)} disabled={busy} placeholder={t("games.custom.nameHint")} /></label>{game?.hydra&&<section className="games-hydra-repair"><HydraOriginalSettings game={game.hydra.original} pending={game.launchPending} expanded={game.launchPending}/>{game.launchPending&&game.hydra.original.executable&&<button className="games-button" disabled={busy} onClick={()=>setConfig(value=>relocateCustomExecutable(value,game.hydra!.original.executable!))}>{t("games.hydra.useFile")}</button>}</section>}{pathField("executable")}{((error || library.error) === "games.custom.launch_permission" || game && game.config.executable === config.executable && customLaunchHealth(game, library.health)?.issue === "permission") && <GameExecutionPermission path={config.executable} disabled={busy} onFixed={() => { setError(""); library.dismissError(); library.recheck(); }}/>}
      {osClass() === "linux" && <div className="games-custom-mode"><span>{t("games.custom.compatibility")}</span><Dropdown value={config.mode} onChange={value => setConfig(old => ({ ...old, mode: value as LaunchConfig["mode"] }))} ariaLabel={t("games.custom.compatibility")} options={[{ value: "native", label: t("games.custom.native") }, { value: "wine", label: "Wine" }, { value: "proton", label: "Proton" }]} /></div>}
      {config.mode !== "native" && <div className="games-custom-compat"><p>{t("games.custom.compatNote")}</p>{pathField("runner")}{pathField("prefix")}{config.mode === "proton" && pathField("steamDirectory", true)}</div>}
      <details className="games-custom-advanced"><summary>{t("games.custom.advanced")}</summary>{pathField("workingDirectory", true)}<label><span>{t("games.custom.arguments")}</span><textarea aria-label={t("games.custom.arguments")} aria-describedby={`${titleId}-arguments-note`} rows={4} value={args} maxLength={16512} onChange={event => setArgs(event.target.value)} disabled={busy} placeholder={"--windowed\n--profile\nMy profile"} spellCheck={false} /><small id={`${titleId}-arguments-note`}>{t("games.custom.argumentsNote")}</small></label></details>
      {game && <><div className="games-custom-toggles"><button className="games-button" aria-pressed={game.pinned} disabled={busy} onClick={() => void library.update(id, { pinned: !game.pinned })}><Pin size={16} />{t(game.pinned ? "games.custom.pinned" : "games.custom.pin")}</button><button className="games-button" aria-pressed={game.hidden} disabled={busy} onClick={() => void library.update(id, { hidden: !game.hidden })}>{game.hidden ? <EyeOff size={16} /> : <Eye size={16} />}{t(game.hidden ? "games.custom.hidden" : "games.custom.hide")}</button></div>
        <section className="games-custom-personalize"><div><strong>{game.linked?.name ?? t("games.custom.detailsTitle")}</strong><span>{t(game.linked ? "games.custom.detailsLinked" : "games.custom.detailsNote")}</span></div><button className="games-button" disabled={busy} onClick={() => onMatch(game)}><Link size={16} />{t(game.linked ? "games.custom.changeMatch" : "games.custom.match")}</button></section>
        <CustomGameArtwork game={game} library={library} disabled={busy}/>
        <div className="games-custom-saves"><GameSaveLauncher profile={library.profile} game={{ ...customGameSummary(game), id: `local:${game.id}`, name: game.name }} active={!closing} /></div>
        {game.lastPlayed > 0 && <div className="games-custom-history"><span>{t("games.custom.lastLaunch")}<strong>{new Date(game.lastPlayed).toLocaleString()}</strong></span><p>{t("games.custom.historyNote")}</p></div>}
        <CustomLibraryStatusSetting id={game.id} profile={library.profile}/>
        <GameNotesButton profile={library.profile} gameId={`custom:${game.id}`} name={game.name}/>
        <CustomPlaytimeEditor key={game.id} game={game} library={library} onBackChange={setPlaytimeBack} />
        <div className="games-custom-remove">{remove ? <><p>{t("games.custom.removeNote", { name: game.name })}</p><button className="games-button" disabled={busy} onClick={() => setRemove(false)}>{t("common.cancel")}</button><button className="games-button" disabled={busy || running} onClick={() => void library.remove(id).then(ok => { if (ok) close(); })}><Trash2 size={15} />{t("games.custom.remove")}</button></> : <button className="games-button" disabled={busy || running} onClick={() => setRemove(true)}><Trash2 size={15} />{t("games.custom.remove")}</button>}</div>
      </>}
    </div><footer>{(error || library.error) && <p className="games-custom-error" role="alert">{t(error || library.error)}</p>}<div><span>{t(playtimeEditing ? "games.playtime.finishEdit" : "games.custom.saveNote")}</span><button className="games-button games-button-primary" disabled={busy || playtimeEditing || !name.trim() || !config.executable} onClick={() => void save()}>{saving ? <LoaderCircle size={16} className="games-custom-working" /> : <Check size={16} />}{t(game ? "games.custom.saveChanges" : "games.custom.addLibrary")}</button></div></footer>
  </div></ModalShell>;
}

export function GameCustomPlay({ game, library, showError = true }: { game: GameSummary; library: CustomGameLibrary; showError?: boolean }) {
  const t=useT();
  const copies = matchingCustomGames(library.data.games, game);
  return <>{copies.map(copy => <CustomPlayButton key={copy.id} game={copy} library={library} />)}{showError&&copies.length>0&&library.error&&<span className="games-custom-detail-error" role="alert">{t(library.error)}</span>}</>;
}

export function GameCustomInstalledStatus({ game, library }: { game: CustomGame; library: CustomGameLibrary }) {
  const t = useT(), health = customLaunchHealth(game, library.health), running = library.running.some(process => process.id === game.id);
  const label = running ? "games.custom.running" : health?.state === "ready" ? "games.setup.phase.ready" : `games.launchHealth.${!health && library.checking ? "checking" : health?.state ?? "unchecked"}`;
  return <div className="games-detail-installed" role="status"><Monitor size={16} aria-hidden="true"/><span>{t(label)}</span></div>;
}
