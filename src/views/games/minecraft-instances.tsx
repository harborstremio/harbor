import { MinecraftStorageChoice } from "./minecraft-storage-choice";
import { useEffect, useId, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowDownToLine, ArrowRight, Box, Check, FolderOpen, Layers, Plus, RefreshCw, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { minecraftCatalogRequest } from "@/lib/games/minecraft-catalog";
import { parseModGames } from "@/lib/games/mods";
import { minecraftInstanceError, minecraftInstanceFolder, minecraftPackBytes, saveMinecraftInstanceFolder, type MinecraftInstance, type MinecraftInstanceLibrary, type MinecraftPackPlan, type MinecraftPackProgress, type MinecraftPackRequest } from "@/lib/games/minecraft-instances";
import { transferBytes } from "@/lib/games/transfers";
import { minecraftRuntimeError } from "@/lib/games/minecraft-runtime";
import { GameArt } from "./game-art";
import { MinecraftRuntimeDialog } from "./minecraft-runtime";
import type { MinecraftAccountController } from "@/hooks/use-minecraft-account";
import { MinecraftContentDialog } from "./minecraft-content";
import { MinecraftLoaderChoice, type MinecraftCreation } from "./minecraft-loader-choice";
import { MinecraftPackUpdates } from "./minecraft-pack-updates";
import { MinecraftInstanceCard, useMinecraftInstanceArtwork } from "./minecraft-instance-card";
import { MinecraftLifecycle } from "./minecraft-lifecycle";
import type { MinecraftLifecycleAction } from "@/lib/games/minecraft-lifecycle";
import "./minecraft-instances.css";

const k = (key: string) => `games.minecraft.instances.${key}`;
const loaderName = (value: string) => value === "neoforge" ? "NeoForge" : value[0].toUpperCase() + value.slice(1);
type Action = { kind: "create" } | { kind: "rename"; instance: MinecraftInstance } | { kind: "pack"; source: string; remote: boolean; name: string; icon: string };
type PageAction = Action | { kind: "lifecycle"; action: MinecraftLifecycleAction; instance: MinecraftInstance } | { kind: "updates"; instance: MinecraftInstance } | { kind: "content"; instance: MinecraftInstance } | { kind: "runtime"; instance: MinecraftInstance };

export function MinecraftInstances({ profile, active, requested, consumed, browse, account }: { profile: string; active: boolean; requested: MinecraftPackRequest | null; consumed: () => void; browse: () => void; account: MinecraftAccountController }) {
  const t = useT(), available = isTauri(), [path, setPath] = useState(() => minecraftInstanceFolder(profile));
  const [library, setLibrary] = useState<MinecraftInstanceLibrary | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState(""), [action, setAction] = useState<PageAction | null>(null), [choosing, setChoosing] = useState(false);
  const mounted = useRef(true), opener = useRef<HTMLElement | null>(null), section = useRef<HTMLElement>(null);
  const show = (value: PageAction) => { opener.current = document.activeElement as HTMLElement; setAction(value); };
  const dismiss = () => { setAction(null); requestAnimationFrame(() => { const target = opener.current; if (target?.isConnected && target.getClientRects().length && !target.matches(":disabled")) target.focus({ preventScroll: true }); else section.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true }); }); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!active) setAction(null); }, [active]);
  useEffect(() => {
    if (!active || !requested) return;
    setAction({ kind: "pack", source: requested.version, name: requested.name, icon: requested.icon, remote: true }); consumed();
  }, [active, requested]);
  useEffect(() => {
    if (!active || !available || !path) return; let disposed = false; setLoading(true); setError("");
    void invoke<MinecraftInstanceLibrary>("games_minecraft_instances", { profile, path }).then(value => { if (!disposed) setLibrary(value); }).catch(reason => { if (!disposed) setError(minecraftInstanceError(reason)); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [active, available, path, profile, retry]);
  const chooseFolder = async (suggested?: string) => {
    if (!available || choosing) return; setChoosing(true); setError("");
    try {
      const { open } = await import("@tauri-apps/plugin-dialog"); const selected = suggested || await open({ directory: true, multiple: false, title: t(k("chooseFolder")), defaultPath: path || undefined });
      if (typeof selected !== "string" || !mounted.current) return;
      // Verify and enumerate before replacing the previously selected library.
      const value = await invoke<MinecraftInstanceLibrary>("games_minecraft_instances", { profile, path: selected });
      if (!mounted.current) return; saveMinecraftInstanceFolder(profile, selected); setLibrary(value); setPath(selected);
    } catch (reason) { if (mounted.current) setError(minecraftInstanceError(reason)); } finally { if (mounted.current) setChoosing(false); }
  };
  const importPack = async () => {
    if (!available || choosing) return; opener.current = document.activeElement as HTMLElement; setChoosing(true); setError("");
    try { const { open } = await import("@tauri-apps/plugin-dialog"); const selected = await open({ multiple: false, filters: [{ name: "Modrinth modpack", extensions: ["mrpack"] }], title: t(k("import")) }); if (typeof selected === "string" && mounted.current) setAction({ kind: "pack", source: selected, remote: false, name: selected.split(/[\\/]/).at(-1) ?? "", icon: "" }); }
    catch (reason) { if (mounted.current) setError(minecraftInstanceError(reason)); } finally { if (mounted.current) setChoosing(false); }
  };
  const openFolder = async (instance: MinecraftInstance) => {
    setError(""); try { const folder = await invoke<string>("games_minecraft_instance_folder", { profile, path, id: instance.id }); const { openPath } = await import("@tauri-apps/plugin-opener"); await openPath(folder); } catch (reason) { if (mounted.current) setError(minecraftInstanceError(reason)); }
  };
  const changed = (instance: MinecraftInstance) => { setLibrary(value => ({ path, unreadable: value?.unreadable ?? 0, instances: [instance, ...(value?.instances ?? []).filter(v => v.id !== instance.id)] })); };
  const visible = (library?.instances ?? []).filter(v => `${v.name} ${v.gameVersion} ${v.loader} ${v.pack?.name ?? ""}`.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  const artwork = useMinecraftInstanceArtwork(section, active, JSON.stringify(visible.map(v => [v.id, v.pack?.project])), retry);
  return <section className="mc-instances games-inset" ref={section}>
    <header className="mc-instances-heading"><div><h2>{t(k("tab"))}</h2><p>{t(k("note"))}</p></div><div><button className="games-button" disabled={!available || choosing} onClick={() => void importPack()}><ArrowDownToLine size={17} />{t(k("import"))}</button><button className="games-button games-button-primary" disabled={!available} onClick={() => show({ kind: "create" })}><Plus size={17} />{t(k("create"))}</button></div></header>
    {!available && <p className="mc-instance-notice">{t(k("desktop"))}</p>}
    <div className="mc-instances-toolbar"><label><Search size={17} /><input value={filter} onChange={e => setFilter(e.target.value)} placeholder={t(k("search"))} aria-label={t(k("search"))} /></label><button className="games-button mc-instance-folder" title={path || undefined} disabled={!available || choosing || !!action} onClick={() => void chooseFolder()}><FolderOpen size={17} /><span>{path ? t(k("storage")) : t(k("chooseFolder"))}</span></button><button className="games-icon-button" aria-label={t("games.feed.refresh")} disabled={!path || loading} onClick={() => setRetry(v => v + 1)}><RefreshCw size={17} className={loading ? "mc-instance-spinning" : undefined} /></button></div>
    {error && <div className="mc-instance-error" role="alert"><span>{t(error)}</span><button className="games-button" onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button></div>}
    {!!library?.unreadable && <p role="status" className="mc-instance-notice">{t(k("unreadable"), { count: library.unreadable })}</p>}
    {loading && !library ? <div className="mc-instance-skeleton" aria-busy="true">{[0, 1, 2].map(v => <div key={v} />)}</div> : visible.length ? <div className="mc-instance-grid">{visible.map(instance => <MinecraftInstanceCard key={instance.id} instance={instance} artwork={artwork[instance.pack?.project ?? ""]} openFolder={() => void openFolder(instance)} choose={kind => show(kind === "runtime" || kind === "content" || kind === "updates" || kind === "rename" ? { kind, instance } : { kind: "lifecycle", action: kind, instance })} />)}</div> : <div className={`mc-instances-empty${filter ? " is-search" : ""}`}>{filter ? <Search size={30} aria-hidden="true" /> : <div className="mc-instances-empty-art"><img src="/games/publisher/minecraft-java.jpg" alt="" /></div>}<div><h3>{t(k(filter ? "noMatches" : "empty"))}</h3><p>{t(k(filter ? "noMatchesNote" : "emptyNote"))}</p><button className="games-button" onClick={filter ? () => { setFilter(""); section.current?.querySelector<HTMLInputElement>(".mc-instances-toolbar input")?.focus({ preventScroll: true }); } : browse}>{t(k(filter ? "clear" : "browse"))}<ArrowRight size={17} /></button></div></div>}
    {action?.kind === "lifecycle" ? <MinecraftLifecycle profile={profile} path={path} instance={action.instance} action={action.action} close={dismiss} refresh={() => { if (mounted.current) setRetry(v => v + 1); }} /> : action?.kind === "updates" ? <MinecraftPackUpdates profile={profile} path={path} instance={action.instance} close={dismiss} changed={changed} setup={instance => setAction({ kind: "runtime", instance })} /> : action?.kind === "content" ? <MinecraftContentDialog profile={profile} path={path} instance={action.instance} close={dismiss} /> : action?.kind === "runtime" ? <MinecraftRuntimeDialog profile={profile} path={path} instance={action.instance} close={dismiss} account={account} /> : action && <InstanceDialog key={action.kind === "pack" ? action.source : action.kind} profile={profile} path={path} action={action} chooseFolder={chooseFolder} choosing={choosing} folderError={error} selectFolder={folder => void chooseFolder(folder)} close={dismiss} changed={changed} continueWith={(kind, instance) => setAction({ kind, instance })} />}
  </section>;
}

function InstanceDialog({ profile, path, action, choosing, chooseFolder, selectFolder, folderError, close: onClose, changed, continueWith }: { continueWith: (kind: "content" | "runtime", instance: MinecraftInstance) => void; profile: string; path: string; action: Action; choosing: boolean; chooseFolder: () => Promise<void>; selectFolder: (path: string) => void; folderError: string; close: () => void; changed: (instance: MinecraftInstance) => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), { closing, close } = useModalExit(onClose);
  const [name, setName] = useState(action.kind === "rename" ? action.instance.name : action.kind === "pack" ? action.name : ""), [games, setGames] = useState<string[]>([]), [game, setGame] = useState("");
  const [plan, setPlan] = useState<MinecraftPackPlan | null>(null), [optional, setOptional] = useState<Set<string>>(new Set()), [progress, setProgress] = useState<MinecraftPackProgress | null>(null), [busy, setBusy] = useState(""), [error, setError] = useState(""), [retry, setRetry] = useState(0), [done, setDone] = useState(false), [cancelling, setCancelling] = useState(false), [fileFilter, setFileFilter] = useState("");
  const [creation, setCreation] = useState<MinecraftCreation>({ loader: "vanilla", version: "", ready: false, game: "" }), [created, setCreated] = useState<MinecraftInstance | null>(null);
  const cancelCommand = action.kind === "create" ? "games_minecraft_runtime_cancel" : "games_minecraft_pack_cancel";
  const mounted = useRef(true), pending = useRef(false), token = useRef(""), operation = useRef(""), generation = useRef(0);
  const cancel = () => { if (operation.current) { setCancelling(true); void invoke(cancelCommand, { profile, operationId: operation.current }).catch(() => {}); } };
  const discard = () => { if (token.current) void invoke("games_minecraft_pack_discard", { profile, token: token.current }).catch(() => {}); token.current = ""; };
  useSectionBack(close, true);
  useEffect(() => {
    mounted.current = true; const previous = document.activeElement as HTMLElement; root.current?.querySelector<HTMLElement>(".mc-instance-close")?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => { if (e.key !== "Tab") return; const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)') ?? [])].filter(v => v.getClientRects().length); if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); } };
    document.addEventListener("keydown", trap);
    const unlisten = listen<MinecraftPackProgress>("games:minecraft-progress", ({ payload }) => { if (mounted.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {});
    return () => { mounted.current = false; generation.current++; if (operation.current) void invoke(cancelCommand, { profile, operationId: operation.current }).catch(() => {}); discard(); document.removeEventListener("keydown", trap); void unlisten.then(fn => fn()).catch(() => {}); previous?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (closing) { cancel(); discard(); generation.current++; } }, [closing]);
  useEffect(() => {
    if (action.kind !== "create") return; const controller = new AbortController(); setBusy("versions"); setError("");
    void minecraftCatalogRequest({ kind: "games" }, controller.signal).then(parseModGames).then(values => { setGames(values); setGame(current => values.includes(current) ? current : values[0] ?? ""); setBusy(""); }).catch(reason => { if (!controller.signal.aborted) { setError(minecraftInstanceError(reason)); setBusy(""); } });
    return () => controller.abort();
  }, [action.kind, retry]);
  useEffect(() => {
    if (action.kind !== "pack" || !path) return;
    let disposed = false;
    queueMicrotask(() => {
    if (disposed || pending.current) return;
    pending.current = true; operation.current = crypto.randomUUID(); const ticket = ++generation.current; setBusy("review"); setError(""); setCancelling(false); setProgress(null); discard(); setPlan(null);
    void invoke<MinecraftPackPlan>("games_minecraft_pack_review", { profile, path, source: action.source, remoteVersion: action.remote, operationId: operation.current }).then(value => {
      if (!mounted.current || ticket !== generation.current) { void invoke("games_minecraft_pack_discard", { profile, token: value.token }).catch(() => {}); return; }
      token.current = value.token; setPlan(value); setName(value.name); setOptional(new Set(value.files.filter(v => v.optional).map(v => v.path)));
    }).catch(reason => { if (mounted.current && ticket === generation.current) setError(minecraftInstanceError(reason)); }).finally(() => { if (mounted.current && ticket === generation.current) { pending.current = false; operation.current = ""; setBusy(""); setProgress(null); setCancelling(false); } });
    });
    return () => { disposed = true; };
  }, [path, action, retry]);
  const submit = async () => {
    if (pending.current || !name.trim() || !path || (action.kind === "create" && (!creation.ready || creation.game !== game))) return; pending.current = true; setBusy(action.kind === "create" ? "create" : "install"); setError(""); setCancelling(false); const ticket = generation.current; operation.current = crypto.randomUUID();
    try {
      let result: MinecraftInstance;
      if (action.kind === "pack") { if (!plan || !token.current) return; const held = token.current; token.current = ""; result = await invoke("games_minecraft_pack_install", { profile, token: held, name: name.trim(), optional: [...optional], operationId: operation.current }); }
      else if (action.kind === "rename") result = await invoke("games_minecraft_instance_rename", { profile, path, id: action.instance.id, name: name.trim() });
      else result = await invoke("games_minecraft_instance_create", { profile, path, name: name.trim(), game, loader: creation.loader, loaderVersion: creation.version, operationId: operation.current });
      if (mounted.current && ticket === generation.current) { changed(result); if (action.kind === "rename") close(); else { setCreated(result); setDone(true); } }
    } catch (reason) { if (mounted.current && ticket === generation.current) { setError(action.kind === "create" ? minecraftRuntimeError(reason) : minecraftInstanceError(reason)); if (action.kind === "pack") setPlan(null); } }
    finally { if (mounted.current && ticket === generation.current) { pending.current = false; operation.current = ""; setBusy(""); setProgress(null); setCancelling(false); } }
  };
  const title = action.kind === "rename" ? "rename" : action.kind === "create" ? "create" : "review";
  const visible = plan?.files.filter(v => v.path.toLowerCase().includes(fileFilter.toLowerCase())) ?? [];
  return <ModalShell closing={closing} onDismiss={close} width={760} labelledBy={id} backdropClassName="mc-instance-scrim"><div className="mc-instance-dialog" ref={root}>
    <header>{action.kind === "pack" && action.icon ? <GameArt src={action.icon} /> : <Layers size={30} />}<div><span className="games-section-kicker">Minecraft</span><h2 id={id}>{t(k(title))}</h2></div><button className="games-icon-button mc-instance-close" aria-label={t("common.close")} onClick={close}><X size={20} /></button></header>
    <div className="mc-instance-dialog-scroll">{done ? <div className="mc-instance-done"><Check size={32} /><h3>{t(k("added"))}</h3>{created && <div className="mc-creation-summary"><GameArt src={created.pack?.icon || "/games/publisher/minecraft-java.jpg"} eager /><div><strong dir="auto">{created.name}</strong><span dir="ltr">{created.gameVersion} · {loaderName(created.loader)}{created.loaderVersion ? ` ${created.loaderVersion}` : ""}</span></div></div>}<p>{t(k("runtimeNeeded"))}</p>{created && <div className="mc-creation-next">{created.loader === "fabric" && <button className="games-button" onClick={() => continueWith("content", created)}><Box size={17} />{t("games.minecraft.content.title")}</button>}<button className="games-button games-button-primary" onClick={() => continueWith("runtime", created)}>{t("games.minecraft.runtime.setup")}<ArrowRight size={17} /></button></div>}</div> : <>
      {!path ? <MinecraftStorageChoice busy={choosing} select={selectFolder} browse={() => void chooseFolder()}/> : <>
        <label className="mc-instance-field">{t(k("name"))}<input aria-label={t(k("name"))} maxLength={80} value={name} disabled={!!busy} onChange={e => setName(e.target.value)} /></label>
        {action.kind === "create" && <><label className="mc-instance-field">{t("games.minecraft.catalog.gameVersion")}<select aria-label={t("games.minecraft.catalog.gameVersion")} value={game} disabled={!!busy} onChange={e => setGame(e.target.value)}>{games.map(v => <option key={v}>{v}</option>)}</select></label><MinecraftLoaderChoice game={game} value={creation} change={setCreation} disabled={!!busy} /><p className="mc-instance-notice">{t("games.minecraft.creation.note")}</p></>}
        {plan && <><div className="mc-pack-environment"><span>{plan.gameVersion}</span><span>{loaderName(plan.loader)} {plan.loaderVersion}</span><strong dir="ltr">{transferBytes(minecraftPackBytes(plan, optional))}</strong></div>{plan.summary && <p className="mc-pack-description" dir="auto">{plan.summary}</p>}<div className="mc-pack-file-heading"><h3>{t(k("contents"))}</h3><span>{t(k("files"), { count: plan.files.length + plan.overrideCount })}</span></div><label className="mc-pack-filter"><Search size={16} /><input aria-label={t(k("filterFiles"))} placeholder={t(k("filterFiles"))} value={fileFilter} onChange={e => setFileFilter(e.target.value)} /></label><div className="mc-pack-files">{visible.slice(0, 200).map(file => <label key={file.path}>{file.optional ? <input type="checkbox" aria-label={file.path} checked={optional.has(file.path)} disabled={!!busy} onChange={e => setOptional(value => { const next = new Set(value); if (e.target.checked) next.add(file.path); else next.delete(file.path); return next; })} /> : <Check size={15} />}<div><span dir="auto">{file.path}</span>{file.optional && <small>{t(k("optional"))}</small>}</div><span dir="ltr">{transferBytes(file.bytes)}</span></label>)}{visible.length > 200 && <p>{t(k("filterMore"), { count: visible.length - 200 })}</p>}</div>{plan.overrideCount > 0 && <p className="mc-instance-notice">{t(k("overrides"), { count: plan.overrideCount })}</p>}{plan.skipped > 0 && <p className="mc-instance-notice">{t(k("skipped"), { count: plan.skipped })}</p>}<p className="mc-instance-notice">{t(k("verifyNote"))}</p></>}
        {action.kind === "pack" && !plan && !busy && <button className="games-button" onClick={() => setRetry(v => v + 1)}>{t(k("reviewAgain"))}</button>}
        {busy && <div className="mc-pack-progress" role="status"><span>{t(busy === "create" ? "games.minecraft.creation.creating" : k(progress ? `phase.${progress.phase}` : busy === "versions" ? "loadingVersions" : busy === "review" ? "phase.review" : "phase.files"))}</span>{progress?.name && <small dir="auto">{progress.name}</small>}{progress?.totalBytes ? <><progress value={progress.bytes} max={progress.totalBytes} /><small>{transferBytes(progress.bytes)} / {transferBytes(progress.totalBytes)}</small></> : <progress />}</div>}
      </>}
    </>}{(error || !path && folderError) && <div className="mc-instance-error" role="alert"><span>{t(error || folderError)}</span>{action.kind !== "pack" && !busy && <button className="games-button" onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button>}</div>}</div>
    <footer><span>{path && !done ? t(k("isolated")) : ""}</span>{done ? <button className="games-button" onClick={close}>{t("common.done")}</button> : (action.kind === "pack" && !!busy || busy === "create") ? <button className="games-button" disabled={cancelling} onClick={cancel}>{t(cancelling ? k("cancelling") : "common.cancel")}</button> : <button className="games-button games-button-primary" disabled={!!busy || !path || !name.trim() || (action.kind === "pack" ? !plan : action.kind === "create" && (!game || !creation.ready || creation.game !== game))} onClick={() => void submit()}>{t(k(action.kind === "pack" ? "install" : action.kind === "rename" ? "save" : "create"))}<ArrowRight size={16} /></button>}</footer>
  </div></ModalShell>;
}
