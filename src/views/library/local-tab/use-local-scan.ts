import { useCallback, useMemo, useState } from "react";
import {
  addLocalEntries,
  parseFilename,
  removeLocalFolder,
  type LocalEntry,
} from "@/lib/local-library";
import { clearSidecarCache, countNfoFor } from "@/lib/local-library/sidecars";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { buildNfoEntry, buildTmdbEntry, type ScannedFile } from "./scan";
import { type ScanMode } from "./scan-mode-modal";

export type PendingScan = { folder: string; files: ScannedFile[]; nfoCount: number };
export type SourceFolder = { path: string; count: number };

export function useLocalScan({
  items,
  setToast,
}: {
  items: LocalEntry[];
  setToast: (msg: string) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ found: number; total: number } | null>(null);
  const [pending, setPending] = useState<PendingScan | null>(null);

  const scanFolder = useCallback(
    async (folder: string) => {
      setError(null);
      setBusy(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const scanned = (await invoke("harbor_scan_folder", {
          folder,
          minSizeMb: Math.max(0, Math.round(settings.localMinFileSizeMb ?? 50)),
        })) as ScannedFile[];
        if (scanned.length === 0) {
          setError(t("No video files found in that folder."));
          setBusy(false);
          return;
        }
        clearSidecarCache();
        const nfoCount = await countNfoFor(scanned.map((f) => f.path));
        setBusy(false);
        setPending({ folder, files: scanned, nfoCount });
      } catch (e) {
        console.warn("[library] folder scan failed", e);
        setError(e instanceof Error ? e.message : t("Couldn't scan that folder."));
        setBusy(false);
      }
    },
    [t, settings.localMinFileSizeMb],
  );

  const onAddFolder = useCallback(async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const folder = await open({ directory: true, multiple: false });
    if (typeof folder !== "string") return;
    await scanFolder(folder);
  }, [scanFolder]);

  const runScan = useCallback(
    async (files: ScannedFile[], mode: ScanMode, folder?: string) => {
      setBusy(true);
      setError(null);
      setProgress({ found: 0, total: files.length });
      const tmdbKey = settings.tmdbKey?.trim() || null;
      const entries: LocalEntry[] = [];
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const parsed = parseFilename(f.filename);
          const built =
            mode === "nfo"
              ? await buildNfoEntry(f, parsed, tmdbKey)
              : await buildTmdbEntry(f, parsed, tmdbKey);
          entries.push(folder ? { ...built, folder } : built);
          setProgress({ found: i + 1, total: files.length });
        }
        addLocalEntries(entries);
      } catch (e) {
        console.warn("[library] scan failed", e);
        setError(e instanceof Error ? e.message : t("Couldn't scan that folder."));
      } finally {
        setProgress(null);
        setBusy(false);
      }
    },
    [settings.tmdbKey, t],
  );

  const onPickMode = useCallback(
    (mode: ScanMode) => {
      const files = pending?.files ?? [];
      const folder = pending?.folder;
      setPending(null);
      if (files.length) void runScan(files, mode, folder);
    },
    [pending, runScan],
  );

  const folders = useMemo<SourceFolder[]>(() => {
    const counts = new Map<string, number>();
    for (const e of items) if (e.folder) counts.set(e.folder, (counts.get(e.folder) ?? 0) + 1);
    return [...counts.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));
  }, [items]);

  const removeFolder = useCallback(
    (path: string) => {
      removeLocalFolder(path);
      setToast(t("Removed folder from your library"));
    },
    [setToast, t],
  );

  return {
    busy,
    error,
    progress,
    pending,
    setPending,
    onAddFolder,
    onPickMode,
    folders,
    rescanFolder: scanFolder,
    removeFolder,
  };
}
