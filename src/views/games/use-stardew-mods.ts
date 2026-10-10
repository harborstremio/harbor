import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { readStardewFolder, rememberStardewFolder, stardewCancel, stardewError, stardewFolders, stardewInspect, stardewUpdates, type StardewInventory, type StardewProgress, type StardewReport } from "@/lib/games/stardew";

export function useStardewMods(profile: string, active: boolean) {
  const [path, setPath] = useState(() => readStardewFolder(profile));
  const [inventory, setInventory] = useState<StardewInventory | null>(null);
  const [report, setReport] = useState<StardewReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [progress, setProgress] = useState<StardewProgress | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const task = useRef<{ id: string; canceled: boolean } | null>(null);
  const alive = useRef(true);
  const available = useRef(active); available.current = active;
  const initialized = useRef(false);
  const cancel = () => {
    const own = task.current; if (!own) return;
    own.canceled = true; setCanceling(true);
    void stardewCancel(profile, own.id).catch(() => {});
  };
  const run = async (next = path, updates = false) => {
    if (!next || task.current || !available.current) return;
    const own = { id: crypto.randomUUID(), canceled: false }; task.current = own;
    setPath(next); setBusy(true); setCanceling(false); setError(""); setProgress(null);
    // A rescan invalidates old provider results, even if the local folder is unchanged.
    setReport(null); if (inventory?.path !== next) setInventory(null);
    let stop: (() => void) | undefined;
    try {
      stop = await listen<StardewProgress>("games:stardew-progress", ({ payload }) => {
        if (payload.profile !== profile || payload.operationId !== own.id) return;
        if (own.canceled || !alive.current || !available.current) { void stardewCancel(profile, own.id).catch(() => {}); return; }
        setProgress(payload);
      });
      if (own.canceled || !alive.current || !available.current) return;
      const result = updates ? await stardewUpdates(profile, next, own.id) : await stardewInspect(profile, next, own.id);
      if (own.canceled || !alive.current || !available.current) return;
      const data = "inventory" in result ? result.inventory : result;
      setInventory(data); setPath(data.path); rememberStardewFolder(profile, data.path);
      if ("updates" in result) setReport(result);
    } catch (reason) { if (alive.current && !own.canceled && available.current) setError(stardewError(reason)); }
    finally { stop?.(); if (task.current === own) task.current = null; if (alive.current) { setBusy(false); setCanceling(false); setProgress(null); } }
  };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; const own = task.current; if (own) { own.canceled = true; void stardewCancel(profile, own.id).catch(() => {}); } };
  }, [profile]);
  useEffect(() => {
    if (!active) { cancel(); return; }
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted || initialized.current) return;
      initialized.current = true;
      if (path) void run(path);
      else void stardewFolders().then(paths => { if (alive.current) setCandidates(paths); }).catch(() => {});
    });
    return () => { mounted = false; };
    // This initializes one profile-scoped, keyed companion instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return { path, inventory, report, error, busy, canceling, progress, candidates, run, cancel, setError };
}
