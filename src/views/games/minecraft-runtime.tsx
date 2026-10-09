import { Play } from "@/components/icons/play-filled";
import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowDownToLine, Check, Coffee, Layers, PackageCheck, RefreshCw, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { type MinecraftInstance } from "@/lib/games/minecraft-instances";
import { minecraftRuntimeError, type MinecraftRuntimePlan, type MinecraftRuntimeProgress, type MinecraftRuntimeState } from "@/lib/games/minecraft-runtime";
import { transferBytes } from "@/lib/games/transfers";
import { GameArt } from "./game-art";
import { MinecraftJavaSetup } from "./minecraft-java";
import { MinecraftAccountButton, MinecraftAccountDialog } from "./minecraft-account";
import type { MinecraftAccountController } from "@/hooks/use-minecraft-account";
import { useMinecraftLaunch } from "@/hooks/use-minecraft-launch";
import { MinecraftLaunchStatus } from "./minecraft-launch";
import "./minecraft-runtime.css";

const k = (key: string) => `games.minecraft.runtime.${key}`;
const loaderName = (value: string) => value === "neoforge" ? "NeoForge" : value[0].toUpperCase() + value.slice(1);
export function MinecraftRuntimeDialog({ profile, path, instance, close: onClose, account }: { profile: string; path: string; instance: MinecraftInstance; close: () => void; account: MinecraftAccountController }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null), { closing, close } = useModalExit(onClose);
  const [plan, setPlan] = useState<MinecraftRuntimePlan | null>(null), [state, setState] = useState<MinecraftRuntimeState | null>(null), [busy, setBusy] = useState("review"), [error, setError] = useState(""), [retry, setRetry] = useState(0), [progress, setProgress] = useState<MinecraftRuntimeProgress | null>(null), [cancelling, setCancelling] = useState(false);
  const mounted = useRef(true), operation = useRef(""), token = useRef(""), pending = useRef(false), forceReview = useRef(false);
  const [javaReady, setJavaReady] = useState(false), [javaBusy, setJavaBusy] = useState(true), [accountOpen, setAccountOpen] = useState(false);
  const needsProcessors = (plan?.processors ?? 0) > 0;
  const launch = useMinecraftLaunch(profile, path, instance.id, closing);
  const discard = () => { if (token.current) void invoke("games_minecraft_runtime_discard", { profile, token: token.current }).catch(() => {}); token.current = ""; };
  const cancel = () => { if (operation.current) { setCancelling(true); void invoke("games_minecraft_runtime_cancel", { profile, operationId: operation.current }).catch(() => {}); } };
  useSectionBack(close, !accountOpen);
  useEffect(() => {
    mounted.current = true; root.current?.querySelector<HTMLButtonElement>(".mc-instance-close")?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => { if (e.key !== "Tab" || [...document.querySelectorAll('[role="dialog"]')].at(-1) !== root.current?.closest('[role="dialog"]')) return; const nodes = [...(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]') ?? [])].filter(v => v.getClientRects().length); if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); } };
    document.addEventListener("keydown", trap);
    const unlisten = listen<MinecraftRuntimeProgress>("games:minecraft-runtime-progress", ({ payload }) => { if (mounted.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {});
    return () => { mounted.current = false; if (operation.current) void invoke("games_minecraft_runtime_cancel", { profile, operationId: operation.current }).catch(() => {}); discard(); document.removeEventListener("keydown", trap); void unlisten.then(fn => fn()); };
  }, [profile]);
  useEffect(() => {
    let disposed = false;
    // React replays mount effects in the desktop dev app. Start native work
    // after that replay so the first cleanup cannot strand a pending review.
    queueMicrotask(() => {
    if (disposed || pending.current) return; pending.current = true; setBusy("review"); setJavaReady(false); setJavaBusy(true); setError(""); setPlan(null); setState(null); setProgress(null); setCancelling(false); discard();
    operation.current = crypto.randomUUID();
    void (async () => {
      if (!forceReview.current) {
        const saved = await invoke<MinecraftRuntimeState>("games_minecraft_runtime_state", { profile, path, id: instance.id });
        if (disposed || !mounted.current) return null;
        if (saved.installed && saved.java !== null) { setState(saved); return null; }
      }
      forceReview.current = false;
      return invoke<MinecraftRuntimePlan>("games_minecraft_runtime_review", { profile, path, id: instance.id, operationId: operation.current });
    })().then(value => {
      if (!value) return;
      if (disposed || !mounted.current) { void invoke("games_minecraft_runtime_discard", { profile, token: value.token }).catch(() => {}); return; }
      token.current = value.token; setPlan(value);
    }).catch(reason => { if (!disposed && mounted.current) setError(minecraftRuntimeError(reason)); }).finally(() => { if (!disposed && mounted.current) { pending.current = false; operation.current = ""; setBusy(""); setCancelling(false); } });
    });
    return () => { disposed = true; };
  }, [profile, path, instance.id, retry]);
  const install = async () => {
    if (pending.current || !token.current || (needsProcessors && (!javaReady || javaBusy))) return; pending.current = true; const held = token.current; token.current = ""; operation.current = crypto.randomUUID(); setBusy("install"); setError(""); setProgress(null); setCancelling(false);
    try { const result = await invoke<MinecraftRuntimeState>("games_minecraft_runtime_install", { profile, token: held, operationId: operation.current }); if (mounted.current) setState(result); }
    catch (reason) { if (mounted.current) { setError(minecraftRuntimeError(reason)); setPlan(null); } }
    finally { if (mounted.current) { pending.current = false; operation.current = ""; setBusy(""); setProgress(null); setCancelling(false); } }
  };
  return <><ModalShell backdropClassName="mc-instance-scrim" closing={closing} onDismiss={close} labelledBy={id} width={650}><div ref={root} className="mc-instance-dialog mc-runtime-dialog">
    <header><div><span className="games-section-kicker">{t(k("setup"))}</span><h2 id={id} dir="auto">{instance.name}</h2></div><button className="games-icon-button mc-instance-close" onClick={close} aria-label={t("common.close")}><X size={20} /></button></header>
    <div className="mc-instance-dialog-scroll">
      <div className="mc-runtime-cover"><GameArt src={instance.pack?.icon || "/games/publisher/minecraft-java.jpg"} /><div><strong dir="auto">{instance.pack?.name || "Minecraft: Java Edition"}</strong><span dir="ltr">{instance.gameVersion} · {loaderName(instance.loader)}{instance.loaderVersion && ` ${instance.loaderVersion}`}</span></div></div>
      {state?.installed && state.java !== null ? <>
        {!launch.state?.running && <><div className="mc-runtime-success mc-runtime-complete"><PackageCheck size={20} /><h3>{t(k("ready"))}</h3><button className="games-icon-button" disabled={launch.busy || javaBusy} aria-label={t(k("verify"))} title={t(k("verify"))} onClick={() => { forceReview.current = true; setJavaReady(false); setRetry(v => v + 1); }}><RefreshCw size={16} /></button></div><fieldset disabled={launch.busy || launch.checking || !!launch.readError}><MinecraftJavaSetup profile={profile} path={path} instance={instance.id} required={state.java} closing={closing} onReady={setJavaReady} onBusy={setJavaBusy} /></fieldset><fieldset className="mc-launch-account" disabled={launch.busy || javaBusy}><div><strong>{t("games.minecraft.launch.account")}</strong><span>{t("games.minecraft.launch.accountNote")}</span></div><MinecraftAccountButton account={account} open={() => setAccountOpen(true)} /></fieldset></>}
        <MinecraftLaunchStatus launch={launch} required={state.java} />
      </> : <>
        <p className="mc-runtime-intro">{t(k("note"))}</p>
        {plan && <div className="mc-runtime-steps">
          <div><Layers size={20} /><div><strong>{t(k("gameFiles"))}</strong><span>{t(k("fileCount"), { count: plan.files })}</span></div><b dir="ltr">{transferBytes(plan.bytes)}</b></div>
          {!needsProcessors && <div><Coffee size={20} /><div><strong>{t(k("java"), { version: plan.java })}</strong><span>{t(k("javaNote"))}</span></div></div>}</div>}
        {plan && plan.cachedFiles > 0 && <p className="mc-runtime-cached"><Check size={16} /><span>{t(k("cached"), { count: plan.cachedFiles })} · <bdi dir="ltr">{transferBytes(plan.cachedBytes)}</bdi></span></p>}
        {plan && needsProcessors && <fieldset className="mc-runtime-prerequisite" hidden={busy === "install"} disabled={!!busy}><p>{t(k("processorNote"), { loader: loaderName(instance.loader) })}</p><MinecraftJavaSetup profile={profile} path={path} instance={instance.id} required={plan.java} closing={closing} onReady={setJavaReady} onBusy={setJavaBusy} /></fieldset>}
        {busy && <div className="mc-pack-progress" role="status"><span>{t(k(busy === "review" ? "reviewing" : progress?.phase === "processors" ? "preparingLoader" : "installing"), { loader: loaderName(instance.loader) })}</span>{progress?.name && <small dir="auto">{progress.name}</small>}{progress?.phase === "processors" ? <><progress value={progress.files} max={progress.totalFiles} /><small>{t(k("processorProgress"), { done: progress.files, total: progress.totalFiles })}</small></> : progress?.totalBytes ? <><progress value={progress.bytes} max={progress.totalBytes} /><small dir="ltr">{transferBytes(progress.bytes)} / {transferBytes(progress.totalBytes)}</small><small>{t(k("progress"), { done: progress.files, total: progress.totalFiles })}</small></> : <progress />}</div>}
      </>}
      {error && <div className="mc-instance-error" role="alert">{t(error)}</div>}
      {!busy && !plan && !state && <button className="games-button" onClick={() => setRetry(v => v + 1)}><RefreshCw size={16} />{t("common.retry")}</button>}
    </div>
    <footer><span>{state ? t(launch.state?.running ? "games.minecraft.launch.closeNote" : !javaReady ? "games.minecraft.launch.javaNote" : k("preserved")) : t(k("resumeNote"))}</span>{state ? launch.busy ? <button className="games-button" disabled={launch.canceling} onClick={launch.cancel}>{t(launch.canceling ? "games.minecraft.instances.cancelling" : "common.cancel")}</button> : launch.state?.running ? <button className="games-button" onClick={close}>{t("common.done")}</button> : <button className="games-button games-button-primary" disabled={!javaReady || javaBusy || launch.checking || !!launch.readError || !launch.state} onClick={() => account.status?.account ? void launch.play() : setAccountOpen(true)}><Play size={17} />{t(account.status?.account ? "games.minecraft.launch.play" : "games.minecraft.account.signIn")}</button> : busy ? <button className="games-button" onClick={cancel} disabled={cancelling}>{t(cancelling ? "games.minecraft.instances.cancelling" : "common.cancel")}</button> : <button className="games-button games-button-primary" disabled={!plan || (needsProcessors && (!javaReady || javaBusy))} onClick={() => void install()}><ArrowDownToLine size={16} />{t(k(plan && plan.cachedFiles === plan.files ? "verify" : "install"))}{plan && plan.bytes > plan.cachedBytes && <b dir="ltr">{transferBytes(plan.bytes - plan.cachedBytes)}</b>}</button>}</footer>
  </div></ModalShell>{accountOpen && <MinecraftAccountDialog account={account} close={() => setAccountOpen(false)} />}</>;
}
