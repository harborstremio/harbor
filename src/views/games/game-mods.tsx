import { NavChevron } from "@/components/nav-arrow";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Check, ExternalLink, FolderOpen, Package, RefreshCw, X } from "lucide-react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useSectionBack } from "@/lib/section-back";
import { useT } from "@/lib/i18n";
import { MOD_LOADERS, parseModProject, modError, modFolders, modRequest, parseModGames, parseModProjects, parseModVersions, saveModFolder, type ModFolder, type ModLoader, type ModPackage, type ModPlan, type ModProgress, type ModProject, type ModVersion, type ModWorkspace } from "@/lib/games/mods";
import { transferBytes } from "@/lib/games/transfers";
import { GameMark } from "./game-ui";
import type { MinecraftModBinding, MinecraftContentState } from "@/lib/games/minecraft-content";
import { ModInstalledRow } from "./game-mod-installed";
import "./game-mods.css";

const folderName = (path: string) => path.replace(/^\\\\\?\\/, "").split(/[\\/]/).filter(Boolean).slice(-2).join(" / ");
const loaderName = (name: string) => name === "neoforge" ? "NeoForge" : name[0].toUpperCase() + name.slice(1);
async function external(url: string) { const { openUrl } = await import("@tauri-apps/plugin-opener"); await openUrl(url); }

function ModIcon({ src }: { src: string }) { const [failed, setFailed] = useState(false); useEffect(() => setFailed(false), [src]); return src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span className="games-mod-fallback"><GameMark kind="create" size={31} /></span>; }

export function GameMods({ profile, query, active, embedded = false, requestedProject, onProjectOpened, bound, onDialogChange }: { profile: string; query: string; active: boolean; embedded?: boolean; requestedProject?: ModProject | null; onProjectOpened?: () => void; bound?: MinecraftModBinding; onDialogChange?: (open: boolean) => void }) {
  const t = useT(), available = isTauri(), section = useRef<HTMLElement>(null), mounted = useRef(true), pending = useRef(false);
  const [folders, setFolders] = useState(() => modFolders(profile)), initial = folders[0];
  const [path, setPath] = useState(bound ? "" : initial?.path ?? ""), [loader, setLoader] = useState<ModLoader>(bound?.loader ?? initial?.loader ?? "fabric"), [game, setGame] = useState(bound?.gameVersion ?? initial?.game ?? "");
  const [games, setGames] = useState<string[]>([]), [mode, setMode] = useState<"browse" | "installed">(bound ? "installed" : "browse"), [sort, setSort] = useState("downloads"), [page, setPage] = useState(0), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ hits: ModProject[]; total: number } | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState("");
  const [workspace, setWorkspace] = useState<ModWorkspace | null>(null), [selected, setSelected] = useState<ModProject | null>(null), [notice, setNotice] = useState("");
  useEffect(() => { onDialogChange?.(!!selected); return () => onDialogChange?.(false); }, [!!selected, onDialogChange]);
  const revision = useRef(0);
  const [workspaceError, setWorkspaceError] = useState("");
  const [externalFiles, setExternalFiles] = useState<MinecraftContentState["external"]>([]), [connecting, setConnecting] = useState(!!bound);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; revision.current++; }; }, []);
  useEffect(() => { if (!active) setSelected(null); }, [active]);
  useEffect(() => { if (active && requestedProject && game) { setSelected(requestedProject); onProjectOpened?.(); } }, [active, requestedProject, game, onProjectOpened]);
  useEffect(() => { if (!active || bound) return; const controller = new AbortController(); void modRequest({ kind: "games" }, controller.signal).then(parseModGames).then(value => { setGames(value); setGame(previous => previous || value[0] || ""); }).catch(reason => { if (!controller.signal.aborted) setError(modError(reason)); }); return () => controller.abort(); }, [active, retry]);
  useEffect(() => { setPage(0); }, [query, loader, game, sort]);
  useEffect(() => {
    if (!active || !game || mode !== "browse") return;
    const controller = new AbortController(); setLoading(true); setResult(null); setError("");
    const timer = setTimeout(() => { void modRequest({ kind: "search", query: query.trim(), loader, game, offset: page * 24, sort }, controller.signal).then(parseModProjects).then(value => { setResult(value); setLoading(false); }).catch(reason => { if (!controller.signal.aborted) { setError(modError(reason)); setLoading(false); } }); }, query.trim() ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [active, query, loader, game, page, sort, retry, mode]);
  const refresh = async (target = path) => {
    const request = ++revision.current; if (!available || (!target && !bound)) { setWorkspace(null); return; }
    if (bound) setConnecting(true);
    try {
      if (bound) {
        const value = await invoke<MinecraftContentState>("games_minecraft_content", { profile, path: bound.libraryPath, id: bound.id });
        if (mounted.current && request === revision.current) { setPath(value.path); setWorkspace(value.workspace); setExternalFiles(value.external); setWorkspaceError(""); }
      } else { const value = await invoke<ModWorkspace>("games_mod_workspace", { profile, path: target, loader: null, game: null }); if (mounted.current && request === revision.current) { setWorkspace(value); setWorkspaceError(""); } }
    }
    catch (reason) { if (mounted.current && request === revision.current) { setWorkspace(null); setWorkspaceError(modError(reason)); } }
    finally { if (mounted.current && request === revision.current) setConnecting(false); }
  };
  useEffect(() => { let disposed = false; queueMicrotask(() => { if (active && !disposed) void refresh(); }); return () => { disposed = true; revision.current++; }; }, [active, bound ? bound.id : path]);
  const choose = async () => {
    if (pending.current || !game) return; pending.current = true; setBusy("folder"); setError("");
    try { const { open } = await import("@tauri-apps/plugin-dialog"); const folder = await open({ directory: true, multiple: false, title: t("games.mods.chooseFolder") }); if (typeof folder !== "string" || !mounted.current) return;
      const value = await invoke<ModWorkspace>("games_mod_workspace", { profile, path: folder, loader, game }); if (!mounted.current) return;
      setFolders(saveModFolder(profile, { path: folder, loader, game })); setWorkspace(value); setPath(folder);
    } catch (reason) { if (mounted.current) setError(modError(reason)); } finally { pending.current = false; if (mounted.current) setBusy(""); }
  };
  const action = async (p: ModPackage, action: "enable" | "disable" | "remove" | "rollback") => {
    if (pending.current) return false; pending.current = true; setBusy(p.project); setError(""); setNotice("");
    try { const value = await invoke<ModWorkspace>("games_mod_action", { profile, path, project: p.project, action, revision: workspace?.revision }); if (mounted.current) { setWorkspace(value); if (action === "rollback") setNotice(t("games.mods.restored")); if (action === "remove") requestAnimationFrame(() => section.current?.querySelector<HTMLButtonElement>('.games-mods-toolbar button[aria-pressed="true"]')?.focus({ preventScroll: true })); } return true; } catch (reason) { if (mounted.current) setError(modError(reason)); return false; } finally { pending.current = false; if (mounted.current) setBusy(""); }
  };
  const environment = (next: Partial<ModFolder>) => { revision.current++; setPath(""); setWorkspace(null); setError(""); if (next.loader) setLoader(next.loader); if (next.game) setGame(next.game); };
  const readonlyFiles = externalFiles.filter(p => p.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const installed = workspace?.packages.filter(p => `${p.name} ${p.filename}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];
  return <section ref={section} className={`games-mods games-inset${embedded ? " is-embedded" : ""}`}>
    {!embedded && <header className="games-mods-hero"><div><span className="games-section-kicker"><GameMark kind="create" />{t("games.mods.kicker")}</span><h2>{t("games.mods.title")}</h2><span className="games-mods-edition">Minecraft Java <i /> Modrinth</span></div><img src="/games/publisher/minecraft-java.jpg" alt="" /></header>}
    {!bound && <><div className="games-mods-environment"><label>{t("games.mods.gameVersion")}<select aria-label={t("games.mods.gameVersion")} value={game} disabled={!!busy || !games.length} onChange={e => environment({ game: e.target.value })}>{game && !games.includes(game) && <option>{game}</option>}{games.map(v => <option key={v}>{v}</option>)}</select></label><label>{t("games.mods.loader")}<select aria-label={t("games.mods.loader")} value={loader} disabled={!!busy} onChange={e => environment({ loader: e.target.value as ModLoader })}>{MOD_LOADERS.map(v => <option key={v} value={v}>{loaderName(v)}</option>)}</select></label>
      <div className="games-mods-folder">{folders.length > 0 && <select aria-label={t("games.mods.workspace")} disabled={!!busy} value={path} onChange={e => { const value = folders.find(v => v.path === e.target.value); if (value) { setPath(value.path); setLoader(value.loader); setGame(value.game); setWorkspace(null); } }}><option value="">{t("games.mods.selectFolder")}</option>{folders.map(v => <option key={v.path} value={v.path}>{folderName(v.path)} · {loaderName(v.loader)} {v.game}</option>)}</select>}<button className="games-button" disabled={!available || loader !== "fabric" || !game || !!busy} onClick={() => void choose()}><FolderOpen size={17} />{t(path ? "games.mods.otherFolder" : "games.mods.chooseFolder")}</button></div>
    </div>
    <p className="games-mods-setup-note">{t(!available ? "games.mods.desktopNote" : loader !== "fabric" ? "games.mods.fabricOnly" : "games.mods.setupNote")}</p></>}
    <div className="games-mods-toolbar"><div role="group" aria-label={t("games.mods.view")}><button aria-pressed={mode === "browse"} onClick={() => setMode("browse")}>{t("games.mods.browse")}</button><button aria-pressed={mode === "installed"} onClick={() => setMode("installed")}>{t("games.mods.installed")}<span>{(workspace?.packages.length ?? 0) + (bound ? externalFiles.length : 0)}</span></button></div>{mode === "browse" ? <label><GameMark kind="filter" size={17} /><select aria-label={t("games.mods.sort")} value={sort} onChange={e => setSort(e.target.value)}>{["downloads", "relevance", "updated", "newest"].map(v => <option key={v} value={v}>{t(`games.mods.sort.${v}`)}</option>)}</select></label> : <button className="games-icon-button" aria-label={t("common.refresh")} disabled={(!path && !bound) || !!busy || connecting} onClick={() => void refresh()}><RefreshCw size={17} /></button>}</div>
    {notice && <p className="games-mods-owned-note" role="status">{notice}</p>}
    {(workspaceError || error) && <div className="games-mods-error" role="alert"><span>{t(workspaceError || error)}</span><button className="games-button" onClick={() => { setRetry(v => v + 1); if (path || bound) void refresh(); }}>{t("common.retry")}</button></div>}
    {mode === "browse" ? <><div className="games-mods-results" aria-busy={loading}>{loading ? Array.from({ length: 8 }, (_, i) => <div className="games-mod-card games-mod-skeleton" key={i} aria-hidden="true"><i /><div><b /><span /><span /></div></div>) : result?.hits.map(p => <button className="games-mod-card" key={p.id} onClick={() => setSelected(p)}><ModIcon src={p.icon} /><div><h3>{p.title}</h3><small>{p.author}</small><p>{p.description}</p><footer><span><ArrowDown size={12} />{new Intl.NumberFormat(undefined, { notation: "compact" }).format(p.downloads)}</span>{workspace?.packages.some(v => v.project === p.id) ? <span className="games-mod-owned"><Check size={12} />{t("games.mods.added")}</span> : <span>{p.categories.filter(v => !MOD_LOADERS.includes(v as ModLoader)).slice(0, 2).join(" · ")}</span>}</footer></div><ArrowRight className="games-mod-enter" size={16} /></button>)}</div>
      {!loading && result && !result.hits.length && <div className="games-state"><Package size={30} /><h3>{t("games.mods.empty")}</h3><p>{t("games.mods.emptyNote")}</p></div>}
      {result && result.total > 24 && <div className="games-mods-pages"><span>{t("games.mods.results", { count: result.total.toLocaleString() })}</span><button className="games-icon-button" aria-label={t("common.previous")} disabled={!page || loading} onClick={() => setPage(v => v - 1)}><NavChevron dir="left" size={19} /></button><span>{page + 1} / {Math.ceil(Math.min(10024, result.total) / 24)}</span><button className="games-icon-button" aria-label={t("common.next")} disabled={(page + 1) * 24 >= result.total || page >= 416 || loading} onClick={() => setPage(v => v + 1)}><NavChevron dir="right" size={19} /></button></div>}
    </> : <>{!bound && <p className="games-mods-owned-note">{path ? folderName(path) : t("games.mods.selectFolder")}</p>}{connecting ? <div className="mc-content-loading" aria-busy="true"><i /><i /><i /></div> : bound && !workspace ? null : installed.length ? <div className="games-mods-installed">{installed.map(p => <ModInstalledRow key={p.project} item={p} backup={workspace?.backups?.find(b => b.package.project === p.project)?.package} busy={!!busy} action={action} versions={setSelected}/>)}</div> : !readonlyFiles.length && <div className="games-state"><GameMark kind="create" size={32} /><h3>{t(query.trim() ? "games.mods.noMatches" : "games.mods.noneInstalled")}</h3>{!query.trim() && <><p>{t(bound ? "games.minecraft.content.empty" : "games.mods.managedNote")}</p><button className="games-button" onClick={() => setMode("browse")}>{t("games.mods.browse")}</button></>}</div>}{bound && !connecting && workspace && readonlyFiles.length > 0 && <div className="mc-content-external"><header><h3>{t("games.minecraft.content.packFiles")}</h3><span>{readonlyFiles.length}</span></header><p>{t("games.minecraft.content.packFilesNote")}</p>{readonlyFiles.map(file => <div key={file.name}><Package size={18} /><span dir="auto">{file.name}</span><small>{transferBytes(file.bytes)}</small></div>)}</div>}</>}
    {selected && <ModDialog unavailable={workspaceError} instanceName={bound?.name} project={selected} profile={profile} path={workspace ? path : ""} loader={loader} game={game} installed={workspace?.packages.find(v => v.project === selected.id)} close={() => setSelected(null)} changed={value => setWorkspace(value)} />}
  </section>;
}

function ModDialog({ project, profile, path, loader, game, installed, close: onClose, changed, instanceName, unavailable }: { unavailable?: string; instanceName?: string; project: ModProject; profile: string; path: string; loader: string; game: string; installed?: ModPackage; close: () => void; changed: (value: ModWorkspace) => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), { closing, close } = useModalExit(onClose), mounted = useRef(true), pending = useRef(false), operation = useRef(""), token = useRef("");
  const [versions, setVersions] = useState<ModVersion[]>([]), [version, setVersion] = useState(""), [busy, setBusy] = useState("versions"), [error, setError] = useState(""), [plan, setPlan] = useState<ModPlan | null>(null), [progress, setProgress] = useState<ModProgress | null>(null), [done, setDone] = useState(false), [attempt, setAttempt] = useState(0);
  const [details, setDetails] = useState(project);
  useEffect(() => {
    const controller = new AbortController();
    void modRequest({ kind: "project", query: project.id }, controller.signal).then(value => parseModProject(value, project.id))
      .then(value => { if (!controller.signal.aborted) setDetails({ ...value, author: value.author || project.author }); }).catch(() => {});
    return () => controller.abort();
  }, [project.id]);
  const cancel = () => { if (operation.current) void invoke("games_cancel_mods", { profile, operationId: operation.current }).catch(() => {}); };
  const discard = () => { if (token.current) void invoke("games_discard_mods", { profile, token: token.current }).catch(() => {}); token.current = ""; };
  useSectionBack(close, true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; root.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true }); mounted.current = true;
    const trap = (event: KeyboardEvent) => { if (event.key !== "Tab") return; const items = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href]') ?? [])].filter(v => v.getClientRects().length); if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); } };
    document.addEventListener("keydown", trap); const stop = listen<ModProgress>("games:mod-progress", ({ payload }) => { if (mounted.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {});
    return () => { mounted.current = false; cancel(); discard(); document.removeEventListener("keydown", trap); void stop.then(fn => fn()); previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (closing) { cancel(); discard(); } }, [closing]);
  useEffect(() => {
    const controller = new AbortController(); setBusy("versions"); setError("");
    void modRequest({ kind: "versions", query: project.id, loader, game }, controller.signal).then(parseModVersions).then(value => { setVersions(value); setVersion((value.find(v => v.type === "release") ?? value[0])?.id ?? ""); setBusy(""); }).catch(reason => { if (!controller.signal.aborted) { setError(modError(reason)); setBusy(""); } }); return () => controller.abort();
  }, [project.id, loader, game, attempt]);
  const run = async () => {
    if (pending.current) return; pending.current = true; operation.current = crypto.randomUUID(); setBusy(plan ? "install" : "review"); setError("");
    try { if (plan) { const held = token.current; token.current = ""; const value = await invoke<ModWorkspace>("games_install_mods", { profile, token: held, operationId: operation.current }); if (mounted.current) { changed(value); setDone(true); setPlan(null); } }
      else { const value = await invoke<ModPlan>("games_review_mods", { profile, path, version, operationId: operation.current }); if (mounted.current && !closing) { token.current = value.token; setPlan(value); } else void invoke("games_discard_mods", { profile, token: value.token }).catch(() => {}); }
    } catch (reason) { if (mounted.current) { setError(modError(reason)); if (!token.current) setPlan(null); } } finally { pending.current = false; operation.current = ""; if (mounted.current) { setBusy(""); setProgress(null); } }
  };
  useEffect(() => { if (error) root.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: "nearest" }); }, [error]);
  return <ModalShell closing={closing} onDismiss={close} width={690} labelledBy={id} backdropClassName="games-mod-backdrop"><div className="games-mod-dialog" ref={root}><header><ModIcon src={details.icon} /><div><p className="games-eyebrow">Modrinth · {loaderName(loader)} {game}</p><h2 id={id}>{details.title}</h2></div><button className="games-icon-button" aria-label={t("common.close")} onClick={close}><X size={20} /></button></header>
    <div className="games-mod-dialog-scroll"><p className="games-mod-description">{details.description}</p><div className="games-mod-credit"><span>{details.author}</span>{isTauri() ? <button onClick={() => void external(`https://modrinth.com/mod/${details.slug}`).catch(reason => setError(modError(reason)))}>{t("games.mods.projectPage")}<ExternalLink size={13} /></button> : <a href={`https://modrinth.com/mod/${details.slug}`} target="_blank" rel="noreferrer">{t("games.mods.projectPage")}<ExternalLink size={13} /></a>}</div>
      {done ? <div className="games-mod-success"><Check size={30} /><h3>{t("games.mods.ready")}</h3><p>{t(instanceName ? "games.minecraft.content.ready" : "games.mods.readyNote", { name: instanceName ?? "" })}</p></div> : plan ? <><div className="games-mod-review-heading"><h3>{t(plan.replaced?.length ? "games.mods.changeTitle" : "games.mods.reviewTitle")}</h3><span>{transferBytes(plan.bytes)}</span></div><ul className="games-mod-plan">{plan.packages.map(p => <li key={p.project}><Package size={18} /><div><strong>{p.name}</strong><small>{plan.replaced?.find(old => old.project === p.project)?.number ? `${plan.replaced.find(old => old.project === p.project)!.number} → ${p.number}` : p.number}</small><small>{p.filename}</small></div><span>{transferBytes(p.bytes)}</span></li>)}</ul><p className="games-mod-review-note">{t("games.mods.verifiedNote")}</p>{!!plan.replaced?.length && <p className="games-mod-review-note">{t("games.mods.backupNote")}</p>}{plan.optional > 0 && <p className="games-mod-review-note">{t("games.mods.optionalNote", { count: plan.optional })}</p>}<div className="games-mod-target"><FolderOpen size={17} /><span>{path.replace(/^\\\\\?\\/, "")}</span></div></> : <>{installed && <p className="games-mod-current">{t("games.mods.currentVersion", {version:installed.number})}</p>}<label className="games-mod-version">{t("games.mods.version")}<select aria-label={t("games.mods.version")} disabled={!!busy} value={version} onChange={e => setVersion(e.target.value)}>{versions.map(v => <option key={v.id} value={v.id}>{v.number}{v.id === installed?.version ? ` · ${t("games.mods.current")}` : ""}{v.type !== "release" ? ` · ${v.type}` : ""}</option>)}</select></label>{!busy && !versions.length && <p>{t("games.mods.noVersion")}</p>}<p className="games-mod-review-note">{t(!isTauri() ? "games.mods.desktopNote" : !path ? (unavailable || "games.mods.needFolder") : instanceName ? "games.minecraft.content.compatible" : installed ? "games.mods.versionNote" : "games.mods.reviewNote", { version: game })}</p></>}
      {busy === "review" && <div className="games-mod-working" role="status"><GameMark kind="create" size={24} /><span>{t("games.mods.resolving")}</span></div>}{busy === "install" && <div className="games-mod-progress" role="status"><span>{progress?.name || t("games.mods.installing")}</span><progress max={progress?.totalBytes || 1} value={progress?.bytes || 0} /><small>{transferBytes(progress?.bytes || 0)} / {transferBytes(progress?.totalBytes || plan?.bytes || 0)}</small></div>}
      {error && <div className="games-mods-error" role="alert"><span>{t(error)}</span>{!versions.length && <button className="games-button" onClick={() => setAttempt(v => v + 1)}>{t("common.retry")}</button>}</div>}
    </div><footer><span>{t(instanceName ? "games.minecraft.content.reviewNote" : "games.mods.footer")}</span>{done ? <button className="games-button games-button-primary" onClick={close}>{t("common.done")}</button> : busy === "review" || busy === "install" ? <button className="games-button" onClick={cancel}>{t("common.cancel")}</button> : <button className="games-button games-button-primary" disabled={!!busy || !isTauri() || !path || !version || version === installed?.version} onClick={() => void run()}>{t(plan ? (plan.replaced?.length ? "games.mods.applyChanges" : "games.mods.install") : installed ? "games.mods.reviewChanges" : "games.mods.review")}<ArrowRight size={16} /></button>}</footer></div></ModalShell>;
}
