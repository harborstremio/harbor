import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { osClass } from "@/lib/platform";
import { importUnmatchedCustom } from "@/lib/games/library-metadata-import";
import type { GameSummary } from "@/lib/games/types";
import { useCustomLaunchHealth } from "./use-custom-launch-health";
import { changeCustomLibrary, correctCustomPlaytime, customLaunchError, customLibraryKey, emptyCustomLibrary, readCustomLibrary, recordCustomExit, removeCustomGame, saveCustomConfiguration, upsertCustomGame, updateCustomGames, type CustomGame, type CustomLibrary, type CustomProcess, type CustomExit, type LaunchConfig } from "@/lib/games/custom-library";

export function useCustomGameLibrary(profile: string, active: boolean) {
  const available = isTauri() && ["windows", "macos", "linux"].includes(osClass());
  const [state, setState] = useState({ profile, data: emptyCustomLibrary() }), [running, setRunning] = useState<CustomProcess[]>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState<string[]>([]);
  const live = useRef(true), owner = useRef(profile), pending = useRef(new Set<string>()), finished = useRef(new Set<string>()), syncId = useRef(0);
  owner.current = profile;
  const data = state.profile === profile ? state.data : emptyCustomLibrary();
  const inspection = useCustomLaunchHealth(profile, data.games, active, available);
  const valid = () => live.current && owner.current === profile;
  const change = async (update: (store: CustomLibrary) => CustomLibrary) => {
    const data = await changeCustomLibrary(profile, update); if (valid()) setState({ profile, data }); return data;
  };
  const recordExit = async (event: CustomExit) => {
    if (event.profile !== profile) return;
    finished.current.add(event.sessionId);
    if (valid()) setRunning(previous => previous.filter(p => p.sessionId !== event.sessionId));
    if (!event.success && valid()) setError("games.custom.launch_exited");
    try { await change(store => recordCustomExit(store, event, event.startedAt)); } catch (error) { if (valid()) setError(customLaunchError(error)); }
  };
  const refresh = async () => {
    const revision = ++syncId.current;
    try {
      const data = readCustomLibrary(profile); if (valid()) setState({ profile, data });
      if (!available) return;
      const [processes, history] = await Promise.all([invoke<CustomProcess[]>("games_custom_running", { profile }), invoke<CustomExit[]>("games_custom_history", { profile })]);
      if (!valid() || revision !== syncId.current) return;
      setRunning(processes.filter(p => !finished.current.has(p.sessionId)));
      if (history.length) await change(store => history.reduce((store, event) => recordCustomExit(store, event, event.startedAt), store));
    } catch (error) { if (valid()) setError(customLaunchError(error)); }
  };
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    pending.current.clear(); finished.current.clear(); setBusy([]); setRunning([]); setError(""); void refresh();
    const stop = available ? listen<CustomExit>("games:custom-exit", event => { if (valid()) void recordExit(event.payload); }).catch(error => { if (valid()) setError(customLaunchError(error)); return () => {}; }) : Promise.resolve(() => {});
    const storage = (event: StorageEvent) => { if (event.key === customLibraryKey(profile)) void refresh(); };
    window.addEventListener("storage", storage);
    return () => { syncId.current++; void stop.then(unlisten => unlisten()); window.removeEventListener("storage", storage); };
  }, [profile, available]);
  useEffect(() => { if (!active) return; void refresh(); const focus = () => void refresh(); window.addEventListener("focus", focus); return () => window.removeEventListener("focus", focus); }, [active, profile]);
  const task = async (id: string, action: () => Promise<void>) => {
    if (pending.current.has(id)) return false; pending.current.add(id); setBusy([...pending.current]); setError("");
    try { await action(); return true; } catch (error) { if (valid()) setError(customLaunchError(error)); return false; }
    finally { if (valid()) { pending.current.delete(id); setBusy([...pending.current]); } }
  };
  const save = (game: CustomGame) => task(game.id, async () => {
    const config = await invoke<LaunchConfig>("games_validate_custom_launch", { config: game.config });
    if (!valid()) return;
    await change(store => saveCustomConfiguration(store, { ...game, config }));
    if (valid()) inspection.recheck();
  });
  const update = (id: string, patch: Partial<Pick<CustomGame, "pinned" | "hidden" | "linked" | "artwork">>) => task(id, async () => { await change(store => { const game = store.games.find(game => game.id === id); if (!game) throw Error("launch_removed"); return upsertCustomGame(store, { ...game, ...patch }); }); });
  const matchMissing = (id: string, name: string, metadata: GameSummary, signal: AbortSignal) => task(id, async () => {
    await change(store => { signal.throwIfAborted(); if (!valid()) throw Error("metadata_import_conflict"); return importUnmatchedCustom(store,id,name,metadata); });
  });
  const updateMany = (ids: string[], patch: { pinned?: boolean; hidden?: boolean }) => task("selection", async () => { await change(store => updateCustomGames(store, ids, patch)); });
  const correctPlaytime = (id: string, seconds: number | null) => task(id, async () => {
    if (running.some(process => process.id === id)) throw Error("launch_running");
    await change(store => correctCustomPlaytime(store, id, seconds));
  });
  const remove = (id: string) => task(id, async () => { if (running.some(p => p.id === id)) throw Error("launch_running"); await change(store => removeCustomGame(store, id)); });
  const launch = (game: CustomGame) => task(game.id, async () => {
    if(game.launchPending)throw Error('launch_missing');
    // A focus refresh started before Windows approval must not overwrite the new process.
    syncId.current++;
    let process: CustomProcess;
    try { process = await invoke<CustomProcess>("games_launch_custom", { profile, id: game.id, config: game.config }); }
    catch (error) { if (valid()) inspection.reportFailure(game, error); throw error; }
    if (valid()) {
      syncId.current++;
      if (!finished.current.has(process.sessionId)) setRunning(previous => [...previous.filter(p => p.id !== game.id), process]);
    }
    await change(store => { const item = store.games.find(item => item.id === game.id); return item ? upsertCustomGame(store, { ...item, lastPlayed: process.startedAt }) : store; });
  });
  const chooseArtwork = (game: CustomGame, title: string) => task(game.id, async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ multiple: false, directory: false, title, filters: [{ name: title, extensions: ["png", "jpg", "jpeg", "webp", "gif"] }] });
    if (typeof path !== "string" || !valid()) return;
    const canonical = await invoke<string>("games_validate_custom_artwork", { path });
    await new Promise<void>((resolve, reject) => { const image = new Image(), timer = setTimeout(() => reject(Error("launch_artwork")), 8000); image.onload = () => { clearTimeout(timer); image.naturalWidth > 0 && image.naturalWidth * image.naturalHeight <= 40_000_000 ? resolve() : reject(Error("launch_artwork")); }; image.onerror = () => { clearTimeout(timer); reject(Error("launch_artwork")); }; image.src = convertFileSrc(canonical); });
    if (valid()) await change(store => { const item = store.games.find(item => item.id === game.id); if (!item) throw Error("launch_removed"); return upsertCustomGame(store, { ...item, artwork: canonical }); });
  });
  return { profile, available, data, ...inspection, running: running.filter(p => p.profile === profile), busy, error, save, update, matchMissing, updateMany, correctPlaytime, remove, launch, chooseArtwork, refresh: () => { inspection.recheck(); return refresh(); }, dismissError: () => setError("") };
}
export type CustomGameLibrary = ReturnType<typeof useCustomGameLibrary>;
