import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { osClass } from "@/lib/platform";
import { readSaveFolders, writeSaveFolders, saveErrorKey, type SaveFolders, type SaveSnapshot, type SaveProgress, type SaveRestorePlan, type SaveRestoreReceipt } from "@/lib/games/saves";
import type { GameSummary } from "@/lib/games/types";
import { simsError } from "@/lib/games/sims";

export function useGameSaves(profile: string, game: GameSummary, simsPath?: string) {
  const configId = simsPath ? `${game.id}:sims:${simsPath}` : game.id;
  const errorKey = (error: unknown) => {
    const code = String(error);
    if (simsPath && ["sims_running", "sims_process"].includes(code)) return "games.sims.savesRunning";
    if (code === "sims_save_recovery") return "games.backups.save_recovery";
    return code.startsWith("sims_") ? simsError(error) : saveErrorKey(error);
  };
  const available = isTauri() && ["windows", "macos", "linux"].includes(osClass());
  const [folders, setFolders] = useState<SaveFolders>({ version: 1, source: "", vault: "" });
  const [snapshots, setSnapshots] = useState<SaveSnapshot[]>([]);
  const [plan, setPlan] = useState<SaveRestorePlan | null>(null), [receipt, setReceipt] = useState<SaveRestoreReceipt | null>(null);
  const [busy, setBusy] = useState<"list" | "choose" | "backup" | "review" | "restore" | "recover" | null>(null);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [progress, setProgress] = useState<SaveProgress | null>(null), [error, setError] = useState("");
  const live = useRef(true), pending = useRef(false), operation = useRef(""), token = useRef(""), revision = useRef(0);
  const discard = () => { const value = token.current; token.current = ""; setPlan(null); if (value) void invoke("games_discard_save_restore", { profile, token: value }).catch(() => {}); };
  const cancel = () => { if (operation.current) void invoke("games_cancel_save_operation", { profile, operationId: operation.current }).catch(error => { if (live.current) setError(errorKey(error)); }); };
  const refresh = async (value = folders) => {
    const request = ++revision.current;
    if (!available) { setSnapshots([]); setRecoveryPending(false); return; }
    const needed = value.source ? await invoke<boolean>("games_save_recovery_status", { target: value.source }) : false;
    if (live.current && request === revision.current) setRecoveryPending(needed);
    if (!value.vault) { setSnapshots([]); return; }
    const list = await invoke<SaveSnapshot[]>(simsPath ? "games_sims_save_list" : "games_list_save_snapshots", { path: simsPath, vault: value.vault, profile, gameId: game.id });
    if (live.current && request === revision.current) setSnapshots(list);
  };
  useEffect(() => {
    live.current = true;
    setBusy("list"); pending.current = true;
    const initialize = async () => {
      let value = readSaveFolders(profile, configId);
      if (simsPath && available) {
        const context = await invoke<{ source: string; vault: string }>("games_sims_save_context", { path: simsPath });
        value = { version: 1, source: context.source, vault: value.vault || context.vault };
      }
      if (!live.current) return;
      setFolders(value); await refresh(value);
    };
    void initialize().catch(error => { if (live.current) setError(errorKey(error)); }).finally(() => { if (live.current) { pending.current = false; setBusy(null); } });
    const stop = available ? listen<SaveProgress>("games:save-progress", ({ payload }) => { if (live.current && payload.profile === profile && payload.operationId === operation.current) setProgress(payload); }).catch(() => () => {}) : Promise.resolve(() => {});
    return () => { live.current = false; revision.current++; cancel(); if (token.current) void invoke("games_discard_save_restore", { profile, token: token.current }).catch(() => {}); void stop.then(unlisten => unlisten()); };
  }, [profile, game.id, available, simsPath]);
  const task = async (kind: Exclude<typeof busy, null>, run: (id: string) => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(kind); setError(""); setProgress(null); operation.current = crypto.randomUUID();
    try { await run(operation.current); } catch (error) { if (live.current) { setError(errorKey(error)); if (kind === "restore") discard(); if (kind === "restore" || kind === "recover") await refresh().catch(() => {}); } }
    finally { operation.current = ""; pending.current = false; if (live.current) { setBusy(null); setProgress(null); } }
  };
  const choose = (kind: "source" | "vault", title: string) => task("choose", async () => {
    if (simsPath && kind === "source") return;
    const { open } = await import("@tauri-apps/plugin-dialog");
    const path = await open({ directory: true, multiple: false, title, defaultPath: folders[kind] || undefined });
    if (typeof path !== "string" || !live.current) return;
    const next = { ...folders, [kind]: path }; writeSaveFolders(profile, configId, next); discard(); setReceipt(null); setFolders(next);
    if (kind === "vault") setSnapshots([]);
    await refresh(next);
  });
  const backup = (label: string) => task("backup", async operationId => {
    discard(); setReceipt(null);
    await invoke(simsPath ? "games_sims_save_snapshot" : "games_create_save_snapshot", { path: simsPath, args: { profile, gameId: game.id, gameName: game.name, source: folders.source, vault: folders.vault, label, operationId } });
    await refresh();
  });
  const review = (snapshotId: string) => task("review", async operationId => {
    discard(); setReceipt(null);
    const result = await invoke<SaveRestorePlan>(simsPath ? "games_sims_save_review" : "games_prepare_save_restore", { path: simsPath, profile, gameId: game.id, vault: folders.vault, snapshotId, target: folders.source, operationId });
    if (live.current) { token.current = result.token; setPlan(result); }
    else void invoke("games_discard_save_restore", { profile, token: result.token }).catch(() => {});
  });
  const restore = () => task("restore", async operationId => {
    const result = await invoke<SaveRestoreReceipt>("games_restore_save_snapshot", { profile, token: token.current, operationId });
    token.current = "";
    if (live.current) { setReceipt(result); setPlan(null); }
    await refresh();
  });
  const recover = () => task("recover", async operationId => {
    discard(); setReceipt(null);
    const result = await invoke<SaveRestoreReceipt>(simsPath ? "games_sims_save_recover" : "games_recover_save_restore", { path: simsPath, target: folders.source, profile, gameId: game.id, operationId });
    if (live.current) setReceipt(result);
    await refresh();
  });
  const reveal = async (path: string) => { try { const { revealItemInDir } = await import("@tauri-apps/plugin-opener"); await revealItemInDir(path); } catch (error) { if (live.current) setError(errorKey(error)); } };
  return { available, folders, snapshots, plan, receipt, busy, progress, error, recoveryPending, recover, choose, backup, review, restore, discard, cancel, reveal, clearReceipt: () => setReceipt(null), refresh: () => task("list", () => refresh()) };
}
