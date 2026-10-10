import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addLocalEntries,
  parseFilename,
  removeLocalFolder,
  type LocalEntry,
} from "@/lib/local-library";
import { clearSidecarCache, countNfoFor } from "@/lib/local-library/sidecars";
import { localPathKey, removedLocalPaths } from "@/lib/local-library/removals";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { buildNfoEntry, buildTmdbEntry, type ScannedFile } from "./scan";
import { type ScanMode } from "./scan-mode-modal";

export type PendingScan = {
  folder: string;
  files: ScannedFile[];
  nfoCount: number;
  restoreRemoved: boolean;
};
export type SourceFolder = { path: string; count: number };

export function useLocalScan({
  items,
  setToast,
}: {
  items: LocalEntry[];
  setToast: (msg: string) => void;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const sweeping = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const foldersRef = useRef<SourceFolder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ found: number; total: number } | null>(null);
  const [pending, setPending] = useState<PendingScan | null>(null);

  const scanFolder = useCallback(
    async (folder: string, restoreRemoved = false) => {
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
        const removed = removedLocalPaths();
        const files = restoreRemoved
          ? scanned
          : scanned.filter((file) => !removed.has(localPathKey(file.path)));
        if (!files.length) {
          setBusy(false);
          return;
        }
        clearSidecarCache();
        const nfoCount = await countNfoFor(files.map((f) => f.path));
        setBusy(false);
        setPending({ folder, files, nfoCount, restoreRemoved });
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
    await scanFolder(folder, true);
  }, [scanFolder]);

  const runScan = useCallback(
    async (files: ScannedFile[], mode: ScanMode, folder?: string, restoreRemoved = false) => {
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
        addLocalEntries(entries, restoreRemoved);
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
      const restoreRemoved = pending?.restoreRemoved;
      setPending(null);
      update({ localScanMode: mode });
      if (files.length) void runScan(files, mode, folder, restoreRemoved);
    },
    [pending, runScan, update],
  );

  const folders = useMemo<SourceFolder[]>(() => {
    const counts = new Map<string, number>();
    for (const e of items) if (e.folder) counts.set(e.folder, (counts.get(e.folder) ?? 0) + 1);
    return [...counts.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { sensitivity: "base" }));
  }, [items]);

  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  const removeFolder = useCallback(
    (path: string) => {
      removeLocalFolder(path);
      setToast(t("Removed folder from your library"));
    },
    [setToast, t],
  );

  const autoScan = useCallback(async () => {
    if (sweeping.current || busy || pending) return;
    const targets = foldersRef.current;
    if (!targets.length) return;
    sweeping.current = true;
    try {
      const known = new Set(itemsRef.current.map((entry) => localPathKey(entry.path)));
      const removed = removedLocalPaths();
      const fresh: { file: ScannedFile; folder: string }[] = [];
      const { invoke } = await import("@tauri-apps/api/core");
      for (const folder of targets) {
        let scanned: ScannedFile[] = [];
        try {
          scanned = (await invoke("harbor_scan_folder", {
            folder: folder.path,
            minSizeMb: Math.max(0, Math.round(settings.localMinFileSizeMb ?? 50)),
          })) as ScannedFile[];
        } catch (cause) {
          console.warn("[library] auto-scan skipped a folder", folder.path, cause);
          continue;
        }
        for (const file of scanned)
          if (!known.has(localPathKey(file.path)) && !removed.has(localPathKey(file.path)))
            fresh.push({ file, folder: folder.path });
      }
      if (!fresh.length) return;
      clearSidecarCache();
      const nfoCount = await countNfoFor(fresh.map((entry) => entry.file.path));
      const mode: ScanMode =
        settings.localScanMode ?? (nfoCount > 0 ? "nfo" : "tmdb");
      const tmdbKey = settings.tmdbKey?.trim() || null;
      const built: LocalEntry[] = [];
      setProgress({ found: 0, total: fresh.length });
      for (let i = 0; i < fresh.length; i++) {
        const { file, folder } = fresh[i];
        const parsed = parseFilename(file.filename);
        const entry =
          mode === "nfo"
            ? await buildNfoEntry(file, parsed, tmdbKey)
            : await buildTmdbEntry(file, parsed, tmdbKey);
        built.push({ ...entry, folder });
        setProgress({ found: i + 1, total: fresh.length });
      }
      const added = addLocalEntries(built);
      if (!added) return;
      setToast(
        added === 1
          ? t("Added 1 new title from your folders")
          : t("Added {n} new titles from your folders", { n: added }),
      );
    } catch (cause) {
      console.warn("[library] auto-scan failed", cause);
    } finally {
      setProgress(null);
      sweeping.current = false;
    }
  }, [busy, pending, settings.localMinFileSizeMb, settings.localScanMode, settings.tmdbKey, setToast, t]);

  return {
    busy,
    error,
    progress,
    autoScan,
    pending,
    setPending,
    onAddFolder,
    onPickMode,
    folders,
    rescanFolder: scanFolder,
    removeFolder,
  };
}
