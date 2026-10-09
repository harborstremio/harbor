import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowDownToLine, Check, Coffee, FolderOpen, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";
import { minecraftJavaError, type MinecraftJavaPlan, type MinecraftJavaProgress, type MinecraftJavaState } from "@/lib/games/minecraft-java";
import { transferBytes } from "@/lib/games/transfers";
import "./minecraft-java.css";

const k = (key: string) => `games.minecraft.java.${key}`;
export function MinecraftJavaSetup({ profile, path, instance, required, closing, onReady, onBusy }: { profile: string; path: string; instance: string; required: number; closing: boolean; onReady?: (ready: boolean) => void; onBusy?: (busy: boolean) => void }) {
  const t = useT(), id = useId(), root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MinecraftJavaState | null>(null), [plan, setPlan] = useState<MinecraftJavaPlan | null>(null), [busy, setBusy] = useState("checking"), [error, setError] = useState(""), [progress, setProgress] = useState<MinecraftJavaProgress | null>(null), [memory, setMemory] = useState(4096), [retry, setRetry] = useState(0), [canceling, setCanceling] = useState(false);
  const [managing, setManaging] = useState(false);
  const mounted = useRef(false), pending = useRef(false), operation = useRef(""), token = useRef(""), generation = useRef(0);
  const discard = () => { if (token.current) void invoke("games_minecraft_java_discard", { profile, token: token.current }).catch(() => {}); token.current = ""; };
  const cancel = () => { if (operation.current) { setCanceling(true); void invoke("games_minecraft_runtime_cancel", { profile, operationId: operation.current }).catch(() => {}); } };
  useEffect(() => {
    mounted.current = true;
    const unlisten = listen<MinecraftJavaProgress>("games:minecraft-java-progress", ({ payload }) => { if (mounted.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {});
    return () => { mounted.current = false; generation.current++; if (operation.current) void invoke("games_minecraft_runtime_cancel", { profile, operationId: operation.current }).catch(() => {}); discard(); void unlisten.then(fn => fn()); };
  }, [profile]);
  useEffect(() => { if (closing) { generation.current++; cancel(); discard(); } }, [closing]);
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return; setBusy("checking"); setError("");
      void invoke<MinecraftJavaState>("games_minecraft_java_state", { profile, path, id: instance }).then(value => { if (!disposed && mounted.current) { setState(value); setMemory(value.configured?.memoryMib ?? 4096); } }).catch(reason => { if (!disposed && mounted.current) setError(minecraftJavaError(reason)); }).finally(() => { if (!disposed && mounted.current) setBusy(""); });
    }); return () => { disposed = true; };
  }, [profile, path, instance, retry]);
  const run = async (kind: "review" | "choose" | "install" | "memory", nextMemory = memory) => {
    if (pending.current || closing) return; pending.current = true; const ticket = generation.current;
    setBusy(kind === "review" ? "review" : kind === "install" ? "download" : "checking"); setError(""); setProgress(null); setCanceling(false);
    operation.current = crypto.randomUUID();
    try {
      if (kind === "review") {
        discard(); setPlan(null);
        const value = await invoke<MinecraftJavaPlan>("games_minecraft_java_review", { profile, path, id: instance, operationId: operation.current });
        if (!mounted.current || ticket !== generation.current) { void invoke("games_minecraft_java_discard", { profile, token: value.token }).catch(() => {}); return; }
        token.current = value.token; setPlan(value);
      } else {
        let value: MinecraftJavaState;
        if (kind === "choose") {
          const { open } = await import("@tauri-apps/plugin-dialog"); const selected = await open({ multiple: false, title: t(k("choose")) });
          if (typeof selected !== "string" || !mounted.current || ticket !== generation.current) return;
          value = await invoke("games_minecraft_java_select", { profile, path, id: instance, executable: selected, memory: nextMemory, operationId: operation.current });
        } else if (kind === "install") {
          if (!token.current) return; const held = token.current; token.current = ""; setPlan(null);
          value = await invoke("games_minecraft_java_install", { profile, token: held, memory: nextMemory, operationId: operation.current });
        } else { value = await invoke("games_minecraft_java_memory", { profile, path, id: instance, memory: nextMemory }); }
        if (mounted.current && ticket === generation.current) { setState(value); setMemory(value.configured?.memoryMib ?? nextMemory); discard(); setPlan(null); }
      }
    } catch (reason) { if (mounted.current && ticket === generation.current) setError(minecraftJavaError(reason)); }
    finally { if (mounted.current && ticket === generation.current) { pending.current = false; operation.current = ""; setBusy(""); setProgress(null); setCanceling(false); } }
  };
  const java = state?.configured?.java;
  const showControls = !state?.compatible || managing;
  useEffect(() => { onReady?.(!!state?.compatible); }, [state?.compatible, onReady]);
  useEffect(() => { onBusy?.(!!busy); }, [busy, onBusy]);
  useEffect(() => {
    if (!busy && !closing && document.activeElement === document.body) root.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [busy, closing]);
  return <section ref={root} className="mc-java-setup" aria-labelledby={id}>
    <div className="mc-java-heading"><Coffee size={23} /><div><h3 id={id}>{t(k("title"))}</h3>{!state?.compatible && <p>{t(k("note"), { version: required })}</p>}</div></div>
    {java && <div className="mc-java-current"><div className="mc-java-current-main"><div>{state.compatible && <Check size={17} />}<strong>{state.compatible ? t(k("ready")) : t(k("versionError"), { version: required })}</strong><span dir="ltr">{java.vendor} · {java.version}{state.compatible && ` · ${memory / 1024} GiB`}</span></div>{state.compatible && <button className="games-button" disabled={!!busy} aria-expanded={managing} aria-controls={`${id}-controls`} onClick={() => setManaging(value => !value)}>{t(k("manage"))}</button>}</div>{showControls && <details><summary>{t(k("path"))}</summary><p dir="ltr">{java.path}</p></details>}</div>}
    <div id={`${id}-controls`} hidden={!showControls}>
    <div className="mc-java-choices"><button className="games-button" disabled={!!busy} onClick={() => void run("review")}><ArrowDownToLine size={17} />{t(k("managed"))}</button><button className="games-button" disabled={!!busy} onClick={() => void run("choose")}><FolderOpen size={17} />{t(k("installed"))}</button></div>
    {plan && <div className="mc-java-download"><div><strong dir="ltr">Eclipse Temurin {plan.major}</strong><span dir="ltr">{plan.version} · {transferBytes(plan.bytes)}</span><p>{t(k("managedNote"))}</p></div><button className="games-button games-button-primary" disabled={!!busy} onClick={() => void run("install")}><ArrowDownToLine size={16} />{t(k("download"))}</button></div>}
    <label className="mc-java-memory"><div><strong>{t(k("memory"))}</strong><span>{t(k("memoryNote"))}</span></div><select aria-label={t(k("memory"))} disabled={!!busy} value={memory} onChange={e => { const value = Number(e.target.value); if (state?.configured) void run("memory", value); else setMemory(value); }}>{[1024, 2048, 3072, 4096, 6144, 8192, 12288, 16384, 24576, 32768, memory].filter((v, i, values) => values.indexOf(v) === i).sort((a, b) => a - b).map(v => <option key={v} value={v}>{v / 1024} GiB</option>)}</select></label>
    </div>
    {busy && <div className="mc-java-progress"><div className="mc-pack-progress" role="status"><span>{t(k(progress ? `phase.${progress.phase}` : busy === "download" ? "phase.download" : busy))}</span>{progress?.totalBytes && progress.phase === "download" ? <><progress value={progress.bytes} max={progress.totalBytes} /><small dir="ltr">{transferBytes(progress.bytes)} / {transferBytes(progress.totalBytes)}</small></> : <progress />}</div>{operation.current && busy !== "checking" && <button className="games-button" disabled={canceling} onClick={cancel}>{t(canceling ? "games.minecraft.instances.cancelling" : "common.cancel")}</button>}</div>}
    {error && <div className="mc-instance-error" role="alert">{t(error, { version: required })}{!state && !busy && <button className="games-button" onClick={() => setRetry(v => v + 1)}><RefreshCw size={16} />{t("common.retry")}</button>}</div>}
  </section>;
}
