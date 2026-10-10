import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { minecraftLaunchError, type MinecraftLaunchProgress, type MinecraftLaunchState } from "@/lib/games/minecraft-launch";

export function useMinecraftLaunch(profile: string, path: string, id: string, closing: boolean) {
  const [state, setState] = useState<MinecraftLaunchState | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [checking, setChecking] = useState(true), [canceling, setCanceling] = useState(false), [progress, setProgress] = useState<MinecraftLaunchProgress | null>(null), [logs, setLogs] = useState(false), [revision, setRevision] = useState(0);
  const [readError, setReadError] = useState("");
  const mounted = useRef(false), operation = useRef(""), pending = useRef(false);
  const cancel = () => { if (operation.current) { setCanceling(true); void invoke("games_minecraft_runtime_cancel", { profile, operationId: operation.current }).catch(() => {}); } };
  useEffect(() => {
    mounted.current = true;
    const unlisten = listen<MinecraftLaunchProgress>("games:minecraft-launch-progress", ({ payload }) => { if (mounted.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {});
    return () => { mounted.current = false; if (operation.current) void invoke("games_minecraft_runtime_cancel", { profile, operationId: operation.current }).catch(() => {}); void unlisten.then(fn => fn()); };
  }, [profile]);
  useEffect(() => { if (closing) cancel(); }, [closing]);
  useEffect(() => {
    let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      if (disposed || closing) return;
      try {
        const value = await invoke<MinecraftLaunchState>("games_minecraft_launch_state", { profile, path, id, logs });
        if (disposed) return; setState(value); setReadError("");
        if (value.running) timer = setTimeout(() => { if (document.hidden) timer = setTimeout(read, 2000); else void read(); }, 2000);
      } catch (reason) { if (!disposed) setReadError(minecraftLaunchError(reason)); }
      finally { if (!disposed) setChecking(false); }
    };
    queueMicrotask(() => { if (!disposed && !busy) void read(); });
    return () => { disposed = true; clearTimeout(timer); };
  }, [profile, path, id, logs, revision, busy, closing]);
  const play = async () => {
    if (pending.current || closing || !state || state.running) return;
    pending.current = true; operation.current = crypto.randomUUID(); setBusy(true); setError(""); setProgress(null); setCanceling(false);
    try { const value = await invoke<MinecraftLaunchState>("games_minecraft_launch", { profile, path, id, operationId: operation.current }); if (mounted.current) setState(value); }
    catch (reason) { if (mounted.current && String(reason) !== "instance_canceled") setError(minecraftLaunchError(reason)); }
    finally { pending.current = false; operation.current = ""; if (mounted.current) { setBusy(false); setProgress(null); setCanceling(false); } }
  };
  return { state, error, readError, busy, checking, canceling, progress, logs, setLogs, play, cancel, retry: () => { setChecking(true); setRevision(v => v + 1); } };
}
