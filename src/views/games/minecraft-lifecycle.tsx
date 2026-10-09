import { useCallback, useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, ArrowRight, Check, FileArchive, History, Search, Trash2, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import type { MinecraftInstance } from "@/lib/games/minecraft-instances";
import { minecraftLifecycleError, type MinecraftExported, type MinecraftExportPlan, type MinecraftLifecycleAction, type MinecraftRemoved, type MinecraftRemovePlan, type MinecraftStorageState } from "@/lib/games/minecraft-lifecycle";
import { transferBytes } from "@/lib/games/transfers";
import { GameArt } from "./game-art";
import "./minecraft-pack-updates.css";
import "./minecraft-lifecycle.css";

const k = (key: string) => `games.minecraft.lifecycle.${key}`;
const loaderName = (value: string) => value === "neoforge" ? "NeoForge" : value[0].toUpperCase() + value.slice(1);
type Progress = { profile: string; operationId: string; bytes: number; totalBytes: number; name: string };
export function MinecraftLifecycle({ profile, path, instance, action, close: onClose, refresh }: { profile: string; path: string; instance: MinecraftInstance; action: MinecraftLifecycleAction; close: () => void; refresh: () => void }) {
  const t = useT(), language = useUiLanguage(), id = useId(), root = useRef<HTMLDivElement>(null), closeRef = useRef(onClose); closeRef.current = onClose;
  const dismiss = useCallback(() => closeRef.current(), []), { closing, close } = useModalExit(dismiss);
  const [version, setVersion] = useState(instance.pack?.version || "1.0.0"), [worlds, setWorlds] = useState(false), [settings, setSettings] = useState(false), [query, setQuery] = useState("");
  const [state, setState] = useState<MinecraftStorageState | null>(null), [exportPlan, setExportPlan] = useState<MinecraftExportPlan | null>(null), [removePlan, setRemovePlan] = useState<MinecraftRemovePlan | null>(null), [busy, setBusy] = useState(""), [error, setError] = useState(""), [retry, setRetry] = useState(0), [done, setDone] = useState<MinecraftExported | MinecraftRemoved | null>(null), [progress, setProgress] = useState<Progress | null>(null), [cancelling, setCancelling] = useState(false);
  const mounted = useRef(true), pending = useRef(false), generation = useRef(0), operation = useRef(""), token = useRef(""), closingRef = useRef(closing); closingRef.current = closing;
  const discard = (value = token.current) => { if (value) void invoke("games_minecraft_lifecycle_discard", { profile, token: value }).catch(() => {}); if (value === token.current) token.current = ""; };
  const cancel = () => { if (operation.current) { setCancelling(true); void invoke("games_minecraft_runtime_cancel", { profile, operationId: operation.current }).catch(() => {}); } };
  useSectionBack(close, true);
  useEffect(() => {
    mounted.current = true; root.current?.querySelector<HTMLButtonElement>(".mc-instance-close")?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => { if (event.key !== "Tab") return; const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary') ?? [])].filter(node => node.getClientRects().length); if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); } };
    document.addEventListener("keydown", trap);
    const off = listen<Progress>("games:minecraft-progress", ({ payload }) => { if (mounted.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {});
    return () => { mounted.current = false; generation.current++; if (operation.current) void invoke("games_minecraft_runtime_cancel", { profile, operationId: operation.current }).catch(() => {}); discard(); document.removeEventListener("keydown", trap); void off.then(fn => fn()); };
  }, [profile]);
  useEffect(() => { if (closing) { cancel(); discard(); generation.current++; } }, [closing]);
  const run = async (command: string, args: Record<string, unknown>, phase: string) => {
    if (pending.current || closingRef.current) return; pending.current = true; setBusy(phase); setError(""); setProgress(null); setCancelling(false); operation.current = crypto.randomUUID(); const ticket = generation.current;
    try {
      const result = await invoke<MinecraftExportPlan | MinecraftRemovePlan | MinecraftExported | MinecraftRemoved>(command, { profile, ...args, operationId: operation.current });
      if (!mounted.current || ticket !== generation.current) { if ("token" in result) discard(result.token); return; }
      if ("token" in result) { token.current = result.token; if ("embeddedBytes" in result) setExportPlan(result); else setRemovePlan(result); }
      else { token.current = ""; setDone(result); }
    } catch (reason) { if (mounted.current && ticket === generation.current) { setError(minecraftLifecycleError(reason)); setExportPlan(null); setRemovePlan(null); discard(); } }
    finally {
      // The OS may finish moving a folder after this modal closes, or partially move copies.
      if (phase === "removing") refresh();
      if (mounted.current && ticket === generation.current) { pending.current = false; operation.current = ""; setBusy(""); setProgress(null); setCancelling(false); }
    }
  };
  const reviewRemove = (backup: string | null) => { discard(); setRemovePlan(null); void run("games_minecraft_instance_remove_review", { path, id: instance.id, backup }, "reviewing"); };
  useEffect(() => {
    if (action !== "storage") return; let disposed = false; setBusy("loading"); setError("");
    void invoke<MinecraftStorageState>("games_minecraft_instance_storage", { profile, path, id: instance.id }).then(value => { if (!disposed) setState(value); }).catch(reason => { if (!disposed) setError(minecraftLifecycleError(reason)); }).finally(() => { if (!disposed) setBusy(""); });
    return () => { disposed = true; };
  }, [profile, path, instance.id, action, retry]);
  const save = async () => {
    if (!exportPlan || pending.current) return; pending.current = true; setBusy("choosing"); setError(""); const ticket = generation.current;
    let destination: string | null = null;
    try { const { save } = await import("@tauri-apps/plugin-dialog"); destination = await save({ title: t(k("export")), defaultPath: `${instance.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").slice(0, 120) || "Minecraft"}.mrpack`, filters: [{ name: "Modrinth modpack", extensions: ["mrpack"] }] }); }
    catch (reason) { if (mounted.current && ticket === generation.current) setError(minecraftLifecycleError(reason)); }
    finally { if (mounted.current && ticket === generation.current) { pending.current = false; setBusy(""); } }
    if (destination && mounted.current && ticket === generation.current && !closingRef.current) void run("games_minecraft_instance_export_apply", { token: exportPlan.token, path: destination }, "exporting");
  };
  const reset = () => { discard(); setExportPlan(null); setRemovePlan(null); setError(""); setQuery(""); };
  const title = action === "storage" && removePlan ? "removeCopy" : action;
  const files = exportPlan?.files.filter(file => file.path.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) ?? [];
  const Icon = action === "export" ? FileArchive : action === "storage" ? History : Trash2;
  return <ModalShell closing={closing} onDismiss={close} width={760} labelledBy={id} backdropClassName="mc-instance-scrim"><div className="mc-instance-dialog mc-lifecycle-dialog" ref={root}>
    <header><Icon size={25} /><div><span className="games-section-kicker">Minecraft</span><h2 id={id}>{t(k(title))}</h2></div><button className="games-icon-button mc-instance-close" aria-label={t("common.close")} onClick={close}><X size={20} /></button></header>
    <div className="mc-instance-dialog-scroll">
      <div className="mc-lifecycle-identity"><GameArt src={instance.pack?.icon || "/games/publisher/minecraft-java.jpg"} fallback="/games/publisher/minecraft-java.jpg" /><div><strong dir="auto">{instance.name}</strong><small>{instance.gameVersion} · {loaderName(instance.loader)}{instance.pack?.version && ` · ${instance.pack.version}`}</small></div></div>
      {done ? <div className="mc-lifecycle-success" role="status"><Check size={30} /><h3>{t(k("path" in done ? "exported" : done.instanceRemoved ? "removed" : "copyRemoved"))}</h3><p>{"path" in done ? done.path : t(k("undoNote"))}</p>{"path" in done && <small dir="ltr">{transferBytes(done.bytes)}</small>}</div> : <>
        {action === "export" && !exportPlan && <><p className="mc-pack-description">{t(k("exportNote"))}</p><label className="mc-instance-field">{t(k("version"))}<input maxLength={200} value={version} disabled={!!busy} onChange={event => setVersion(event.target.value)} /></label><div className="mc-lifecycle-options"><label><input type="checkbox" checked={worlds} disabled={!!busy} onChange={event => setWorlds(event.target.checked)} />{t(k("worlds"))}</label><label><input type="checkbox" checked={settings} disabled={!!busy} onChange={event => setSettings(event.target.checked)} />{t(k("settings"))}</label></div><p className="mc-instance-notice">{t(k("privateNote"))}</p></>}
        {exportPlan && <><div className="mc-update-target"><FileArchive size={23} /><div><strong dir="auto">{exportPlan.version}</strong><span>{t("games.minecraft.instances.files", { count: exportPlan.files.length })}</span></div><button className="games-button" disabled={!!busy} onClick={reset}>{t(k("edit"))}</button></div><div className="mc-update-size"><span>{t(k("included"))}<strong dir="ltr">{transferBytes(exportPlan.embeddedBytes)}</strong></span><span>{t(k("referenced"))}<strong dir="ltr">{transferBytes(exportPlan.downloadBytes)}</strong></span></div><p className="mc-instance-notice">{t(k("referenceNote"))}</p><label className="mc-pack-filter"><Search size={16} /><input aria-label={t("games.minecraft.instances.filterFiles")} placeholder={t("games.minecraft.instances.filterFiles")} value={query} onChange={event => setQuery(event.target.value)} /></label><div className="mc-update-files">{files.slice(0, 150).map(file => <div key={file.path}><span dir="auto">{file.path}</span><small>{t(k(file.embedded ? "included" : "referenced"))}</small><small dir="ltr">{transferBytes(file.bytes)}</small></div>)}{files.length > 150 && <p>{t("games.minecraft.instances.filterMore", { count: files.length - 150 })}</p>}</div></>}
        {action === "storage" && !removePlan && <><p className="mc-pack-description">{t(k("storageNote"))}</p>{state?.backups.map(copy => <div key={copy.key} className="mc-lifecycle-copy"><History size={20} /><div><strong dir="auto">{copy.version || copy.name}</strong><small>{copy.gameVersion} · {loaderName(copy.loader)}{copy.savedAt ? ` · ${new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(copy.savedAt * 1000)}` : ""}{copy.latest && ` · ${t(k("latest"))}`}</small></div><button className="games-button" disabled={!!busy} aria-label={t(k("reviewCopy"), { version: copy.version || copy.name })} onClick={() => reviewRemove(copy.key)}>{t(k("review"))}<ArrowRight size={15} /></button></div>)}{state && !state.backups.length && <p className="mc-instance-notice">{t(k("empty"))}</p>}{!!state?.unreadable && <p className="mc-instance-notice">{t(k("unreadable"), { count: state.unreadable })}</p>}</>}
        {action === "remove" && !removePlan && <p className="mc-pack-description">{t(k("removeNote"))}</p>}
        {removePlan && <><div className="mc-update-target"><Trash2 size={23} /><div><strong dir="auto">{removePlan.version || removePlan.name}</strong><span>{t(k(removePlan.backup ? "removeCopy" : "remove"))}</span></div><button className="games-button" disabled={!!busy} onClick={reset}><ArrowLeft size={15} />{t("common.back")}</button></div><div className="mc-update-size"><span>{t("games.minecraft.instances.files", { count: removePlan.files })}<strong dir="ltr">{transferBytes(removePlan.bytes)}</strong></span><span>{t(k("worldCount"), { count: removePlan.worlds })}</span></div>{removePlan.latest && <p className="mc-update-warning">{t(k("latestNote"))}</p>}{removePlan.recoveryCopies > 0 && <p className="mc-instance-notice">{t(k("copiesIncluded"), { count: removePlan.recoveryCopies })}</p>}{removePlan.unreadable > 0 && <p className="mc-instance-notice">{t(k("unreadable"), { count: removePlan.unreadable })}</p>}<p className="mc-pack-description">{t(k("trashNote"))}</p></>}
      </>}
      {busy && <div className="mc-pack-progress" role="status"><span>{t(k(busy))}</span>{progress?.name && <small dir="auto">{progress.name}</small>}{progress?.totalBytes ? <progress value={progress.bytes} max={progress.totalBytes} /> : <progress />}</div>}
      {error && <div className="mc-instance-error" role="alert"><span>{t(error)}</span>{action === "storage" && !busy && <button className="games-button" onClick={() => { setDone(null); setRetry(v => v + 1); }}>{t("common.retry")}</button>}</div>}
    </div>
    <footer><span>{action === "export" && !done ? ".mrpack" : ""}</span>{done ? <button className="games-button" onClick={close}>{t("common.done")}</button> : busy ? busy !== "loading" && busy !== "removing" && busy !== "choosing" && <button className="games-button" disabled={cancelling} onClick={cancel}>{t(cancelling ? "games.minecraft.instances.cancelling" : "common.cancel")}</button> : exportPlan ? <button className="games-button games-button-primary" onClick={() => void save()}>{t(k("save"))}<ArrowRight size={16} /></button> : removePlan ? <button className="games-button" onClick={() => void run("games_minecraft_instance_remove_apply", { token: removePlan.token }, "removing")}><Trash2 size={16} />{t(k("trash"))}</button> : action === "export" ? <button className="games-button games-button-primary" disabled={!version.trim()} onClick={() => { discard(); void run("games_minecraft_instance_export_review", { path, id: instance.id, version: version.trim(), worlds, settings }, "reviewing"); }}>{t(k("review"))}<ArrowRight size={16} /></button> : action === "remove" ? <button className="games-button" onClick={() => reviewRemove(null)}>{t(k("review"))}<ArrowRight size={16} /></button> : <button className="games-button" onClick={close}>{t("common.done")}</button>}</footer>
  </div></ModalShell>;
}
