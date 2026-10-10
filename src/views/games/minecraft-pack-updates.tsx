import { useCallback, useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowRight, Check, FileArchive, History, RotateCcw, Search, X } from "lucide-react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT, useUiLanguage } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { minecraftCatalogRequest, minecraftVersions, type MinecraftVersion } from "@/lib/games/minecraft-catalog";
import type { MinecraftInstance } from "@/lib/games/minecraft-instances";
import { minecraftPackUpdateError, type MinecraftPackUpdate, type MinecraftPackHistory } from "@/lib/games/minecraft-pack-update";
import { transferBytes } from "@/lib/games/transfers";
import { GameArt } from "./game-art";
import "./minecraft-pack-updates.css";

const k = (key: string) => `games.minecraft.update.${key}`;
const phaseKey = (phase: string) => phase === "verify" ? "games.minecraft.launch.phase.files" : ["pack", "review", "files", "overrides", "done"].includes(phase) ? `games.minecraft.instances.phase.${phase}` : k(`phase.${phase}`);
type Progress = { profile: string; operationId: string; phase: string; name: string; bytes: number; totalBytes: number };
export function MinecraftPackUpdates({ profile, path, instance, close: onClose, changed, setup }: { profile: string; path: string; instance: MinecraftInstance; close: () => void; changed: (value: MinecraftInstance) => void; setup: (value: MinecraftInstance) => void }) {
  const t = useT(), language = useUiLanguage(), id = useId(), root = useRef<HTMLDivElement>(null), closeRef = useRef(onClose); closeRef.current = onClose;
  const dismiss = useCallback(() => closeRef.current(), []), { closing, close } = useModalExit(dismiss);
  const [versions, setVersions] = useState<MinecraftVersion[]>([]), [version, setVersion] = useState(""), [history, setHistory] = useState<MinecraftPackHistory | null>(null), [catalogBusy, setCatalogBusy] = useState(false), [catalogError, setCatalogError] = useState(""), [retry, setRetry] = useState(0);
  const [plan, setPlan] = useState<MinecraftPackUpdate | null>(null), [busy, setBusy] = useState(""), [error, setError] = useState(""), [progress, setProgress] = useState<Progress | null>(null), [cancelling, setCancelling] = useState(false), [completed, setCompleted] = useState<MinecraftInstance | null>(null), [fileQuery, setFileQuery] = useState(""), [tab, setTab] = useState("changes"), [original, setOriginal] = useState("");
  const mounted = useRef(true), operation = useRef(""), token = useRef(""), pending = useRef(false), generation = useRef(0);
  const closingRef = useRef(closing); closingRef.current = closing;
  const originalFile = useRef(""), lastSource = useRef<{ source: string | null; remote: boolean } | null>(null);
  const discard = () => { if (token.current) void invoke("games_minecraft_pack_update_discard", { profile, token: token.current }).catch(() => {}); token.current = ""; };
  const cancel = () => { if (operation.current) { setCancelling(true); void invoke("games_minecraft_pack_update_cancel", { profile, operationId: operation.current }).catch(() => {}); } };
  useSectionBack(close, true);
  useEffect(() => {
    mounted.current = true; root.current?.querySelector<HTMLButtonElement>(".mc-instance-close")?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => { if (e.key !== "Tab") return; const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary') ?? [])].filter(v => v.getClientRects().length); if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); } };
    document.addEventListener("keydown", trap);
    const off = listen<Progress>("games:minecraft-progress", ({ payload }) => { if (mounted.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {});
    return () => { mounted.current = false; generation.current++; if (operation.current) void invoke("games_minecraft_pack_update_cancel", { profile, operationId: operation.current }).catch(() => {}); discard(); document.removeEventListener("keydown", trap); void off.then(fn => fn()); };
  }, [profile]);
  useEffect(() => { if (closing) { cancel(); discard(); generation.current++; } }, [closing]);
  useEffect(() => {
    const controller = new AbortController(); let disposed = false; setCatalogError(""); setCatalogBusy(true);
    queueMicrotask(() => { if (disposed) return;
      const project = instance.pack?.project;
      const catalog = project ? minecraftCatalogRequest({ kind: "versions", type: "modpack", query: project }, controller.signal).then(minecraftVersions) : Promise.resolve([]);
      void Promise.allSettled([catalog, invoke<MinecraftPackHistory>("games_minecraft_pack_update_state", { profile, path, id: instance.id })]).then(([items, state]) => {
        if (disposed) return;
        if (items.status === "fulfilled") { const releases = items.value.filter(v => v.filename.endsWith(".mrpack")); setVersions(releases); setVersion(current => releases.some(v => v.id === current) ? current : (releases.find(v => v.id !== instance.pack?.versionId && v.type === "release") ?? releases.find(v => v.id !== instance.pack?.versionId))?.id ?? ""); } else setCatalogError(minecraftPackUpdateError(items.reason));
        if (state.status === "fulfilled") setHistory(state.value); else setCatalogError(minecraftPackUpdateError(state.reason));
      }).finally(() => { if (!disposed) setCatalogBusy(false); });
    }); return () => { disposed = true; controller.abort(); };
  }, [profile, path, instance.id, retry]);
  const run = async (command: string, args: Record<string, unknown>, phase: string) => {
    if (pending.current || closingRef.current) return; pending.current = true; setBusy(phase); setError(""); setProgress(null); setCancelling(false); operation.current = crypto.randomUUID(); const ticket = generation.current;
    try {
      const result = await invoke<MinecraftPackUpdate | MinecraftInstance>(command, { profile, ...args, operationId: operation.current });
      if (!mounted.current || ticket !== generation.current) { if ("token" in result) void invoke("games_minecraft_pack_update_discard", { profile, token: result.token }).catch(() => {}); return; }
      if ("token" in result) { token.current = result.token; setPlan(result); } else { changed(result); setCompleted(result); }
    } catch (reason) { if (mounted.current && ticket === generation.current) { setError(minecraftPackUpdateError(reason)); setPlan(null); } }
    finally { if (mounted.current && ticket === generation.current) { operation.current = ""; pending.current = false; setBusy(""); setProgress(null); setCancelling(false); } }
  };
  const review = (source: string | null, remote: boolean) => { lastSource.current = { source, remote }; discard(); setPlan(null); setTab("changes"); setFileQuery(""); void run("games_minecraft_pack_update_review", { path, id: instance.id, source, remote, original: originalFile.current || null }, "review"); };
  const chooseFile = async (isOriginal: boolean) => {
    if (pending.current) return; pending.current = true; setBusy("choose");
    try { const { open } = await import("@tauri-apps/plugin-dialog"); const value = await open({ multiple: false, filters: [{ name: "Modrinth modpack", extensions: ["mrpack"] }], title: t(k(isOriginal ? "chooseOriginal" : "chooseFile")) }); if (!mounted.current || closingRef.current) return; if (typeof value === "string") { if (isOriginal) { setOriginal(value); originalFile.current = value; setError(""); if (lastSource.current) { pending.current = false; review(lastSource.current.source, lastSource.current.remote); return; } } else { pending.current = false; review(value, false); return; } } }
    catch (reason) { if (mounted.current) setError(minecraftPackUpdateError(reason)); }
    finally { if (mounted.current && !operation.current) { pending.current = false; setBusy(""); } }
  };
  const apply = () => { if (!plan || !token.current || plan.conflicts || plan.environmentBlocked) return; const held = token.current; token.current = ""; void run("games_minecraft_pack_update_apply", { token: held }, "apply"); };
  const selectOptional = (file: string, checked: boolean) => { if (!plan || pending.current) return; const optional = new Set(plan.selectedOptional); if (checked) optional.add(file); else optional.delete(file); const held = token.current; token.current = ""; void run("games_minecraft_pack_update_select", { token: held, optional: [...optional] }, "review"); };
  const selected = versions.find(v => v.id === version);
  const visible = plan?.changes.filter(change => (tab === "preserved" ? change.action === "preserve" : change.action !== "unchanged" && change.action !== "preserve") && change.path.toLowerCase().includes(fileQuery.toLowerCase())) ?? [];
  const optional = plan?.optional.filter(file => file.path.toLowerCase().includes(fileQuery.toLowerCase())) ?? [];
  const date = selected?.date ? new Date(selected.date) : null;
  return <ModalShell closing={closing} onDismiss={close} width={860} labelledBy={id} backdropClassName="mc-instance-scrim"><div className="mc-instance-dialog mc-pack-update" ref={root}>
    <header><GameArt src={instance.pack?.icon || "/games/publisher/minecraft-java.jpg"} eager /><div><span className="games-section-kicker">{instance.name}</span><h2 id={id}>{t(k("title"))}</h2></div><button className="games-icon-button mc-instance-close" aria-label={t("common.close")} onClick={close}><X size={20} /></button></header>
    <div className="mc-instance-dialog-scroll">
      {completed ? <div className="mc-instance-done"><Check size={30} /><h3>{t(k("complete"))}</h3><div className="mc-creation-summary"><GameArt src={completed.pack?.icon || "/games/publisher/minecraft-java.jpg"} /><div><strong dir="auto">{completed.name}</strong><span dir="ltr">{completed.pack?.version} · {completed.gameVersion}</span></div></div><p>{t(k("completeNote"))}</p><button className="games-button games-button-primary" onClick={() => setup(completed)}>{t("games.minecraft.runtime.setup")}<ArrowRight size={16} /></button></div> : <>
        <div className="mc-update-current"><div><span>{t(k("installed"))}</span><strong dir="auto">{instance.pack?.version}</strong></div><div><span dir="ltr">{instance.gameVersion} · {instance.loader} {instance.loaderVersion}</span><small dir="auto">{instance.pack?.name}</small></div></div>
        {!plan && !busy && <>
          {catalogBusy ? <p className="mc-instance-notice" role="status">{t(k("loading"))}</p> : versions.length ? <><label className="mc-instance-field">{t(k("version"))}<select aria-label={t(k("version"))} value={version} onChange={e => setVersion(e.target.value)}><option value="" disabled>{t(k("chooseVersion"))}</option>{versions.map(v => <option key={v.id} value={v.id} disabled={v.id === instance.pack?.versionId}>{v.number} · {v.games.join(", ")}{v.type !== "release" ? ` · ${v.type}` : ""}{v.id === instance.pack?.versionId ? ` · ${t(k("installed"))}` : ""}</option>)}</select></label>{selected && <div className="mc-update-release"><strong dir="auto">{selected.name}</strong><span>{date && !Number.isNaN(date.valueOf()) ? date.toLocaleDateString(language) : ""}{selected.bytes > 0 ? ` · ${transferBytes(selected.bytes)}` : ""}</span></div>}</> : !catalogError && <p className="mc-instance-notice">{t(k(instance.pack?.project ? "noVersions" : "localNote"))}</p>}
          {catalogError && <div className="mc-instance-error" role="alert"><span>{t(catalogError)}</span><button className="games-button" onClick={() => setRetry(v => v + 1)}>{t("common.retry")}</button></div>}
          <div className="mc-update-sources"><button className="games-button" onClick={() => void chooseFile(false)}><FileArchive size={16} />{t(k("chooseFile"))}</button>{history?.previous && <button className="games-button" onClick={() => review(null, false)}><RotateCcw size={16} />{t(k("restoreVersion"), { version: history.previous.pack?.version ?? "" })}</button>}</div>
          <p className="mc-update-note"><History size={17} /><span>{t(k("reviewNote"))}</span></p>
        </>}
        {plan && <>
          <div className="mc-update-target"><ArrowRight size={22} /><div><strong dir="auto">{plan.version}</strong><span dir="ltr">{plan.gameVersion} · {plan.loader} {plan.loaderVersion}</span></div><button className="games-button" disabled={!!busy} onClick={() => { discard(); setPlan(null); }}>{t(k("changeVersion"))}</button></div>
          <div className="mc-update-size"><span>{t(k("download"))}<strong dir="ltr">{transferBytes(plan.downloadBytes)}</strong></span><span>{t(k("recoveryCopy"))}<strong dir="ltr">{transferBytes(plan.copyBytes)}</strong></span></div>
          {(plan.conflicts > 0 || plan.environmentBlocked) && <p className="mc-update-warning" role="alert">{t(k(plan.environmentBlocked ? "loaderConflict" : "conflictNote"))}</p>}
          {plan.environmentChanged && <p className="mc-instance-notice">{t(k("environmentNote"))}</p>}
          <div className="mc-update-tabs" role="group" aria-label={t(k("fileGroups"))}>{["changes", "preserved", ...(plan.optional.length ? ["optional"] : [])].map(value => <button className="games-button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{t(k(value))}<span>{value === "preserved" ? plan.preserved : value === "optional" ? plan.optional.length : plan.changes.filter(c => c.action !== "preserve" && c.action !== "unchanged").length}</span></button>)}</div>
          <label className="mc-pack-filter"><Search size={16} /><input value={fileQuery} onChange={e => setFileQuery(e.target.value)} placeholder={t("games.minecraft.instances.filterFiles")} aria-label={t("games.minecraft.instances.filterFiles")} /></label>
          <div className="mc-update-files">{tab === "optional" ? optional.slice(0, 200).map(file => <label key={file.path}><input type="checkbox" checked={plan.selectedOptional.includes(file.path)} disabled={!!busy} onChange={e => selectOptional(file.path, e.target.checked)} /><span dir="auto">{file.path}</span><small>{transferBytes(file.bytes)}</small></label>) : visible.slice(0, 200).map(file => <div key={file.path}><span dir="auto">{file.path}</span><small data-action={file.action}>{t(k(`action.${file.action}`))}</small></div>)}{(tab === "optional" ? optional : visible).length === 0 && <p>{t(k("noChanges"))}</p>}{(tab === "optional" ? optional : visible).length > 200 && <p>{t("games.minecraft.instances.filterMore", { count: (tab === "optional" ? optional : visible).length - 200 })}</p>}</div>
          {plan.extraMods.length > 0 && <details className="mc-update-extras"><summary>{t(k("extraMods"), { count: plan.extraMods.length })}</summary>{plan.extraMods.map(name => <span key={name} dir="auto">{name}</span>)}</details>}
          <p className="mc-update-note"><History size={17} /><span>{t(k("preserveNote"))}</span></p>
        </>}
        {!!busy && <div className="mc-pack-progress" role="status"><span>{t(phaseKey(progress?.phase ?? (busy === "apply" ? "copy" : "review")))}</span>{progress?.name && <small dir="auto">{progress.name}</small>}{progress?.totalBytes ? <><progress value={progress.bytes} max={progress.totalBytes} /><small>{transferBytes(progress.bytes)} / {transferBytes(progress.totalBytes)}</small></> : <progress />}</div>}
        {error && <div className="mc-instance-error" role="alert"><span>{t(error)}</span>{error === k("originalError") && <button className="games-button" disabled={!!busy} onClick={() => void chooseFile(true)}>{t(k("chooseOriginal"))}</button>}</div>}{original && !plan && <p className="mc-instance-notice">{t(k("originalSelected"))}</p>}
      </>}
    </div>
    <footer><span>{completed ? "" : t(k("footer"))}</span>{completed ? <button className="games-button" onClick={close}>{t("common.done")}</button> : busy ? <button className="games-button" disabled={cancelling || busy === "choose"} onClick={cancel}>{t(cancelling ? "games.minecraft.instances.cancelling" : "common.cancel")}</button> : plan ? <button className="games-button games-button-primary" disabled={!!plan.conflicts || plan.environmentBlocked} onClick={apply}>{t(k(plan.restore ? "restore" : "apply"))}<ArrowRight size={16} /></button> : <button className="games-button games-button-primary" disabled={!version || catalogBusy} onClick={() => review(version, true)}>{t(k("review"))}<ArrowRight size={16} /></button>}</footer>
  </div></ModalShell>;
}
