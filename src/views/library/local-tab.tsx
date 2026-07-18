import { AlertTriangle, CheckSquare, FolderPlus, HardDrive, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addLocalEntries,
  localEntryToMeta,
  parseFilename,
  removeLocalEntry,
  updateLocalEntries,
  updateLocalEntry,
  useLocalLibrary,
  type LocalEntry,
} from "@/lib/local-library";
import { clearSidecarCache, countNfoFor } from "@/lib/local-library/sidecars";
import { exportMovie, exportSeries, type ExportSizes } from "@/lib/local-library/export";
import { confirmDialog } from "@/lib/dialog";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { FilterBar, Grid, type TypeKey } from "./shared";
import { groupLocal, ShowGroupCard } from "./local-tab/show-group";
import { ScanModeModal, type ScanMode } from "./local-tab/scan-mode-modal";
import { IdentifyModal, type IdentifyResolution } from "./local-tab/identify-modal";
import { type LocalCardProps } from "./local-tab/card-actions";
import { OwnedCard } from "./local-tab/movie-card";
import {
  BulkBar,
  SortMenu,
  sortGroups,
  type LocalSortKey,
  type SortDir,
} from "./local-tab/toolbar";
import { buildNfoEntry, buildTmdbEntry, type ScannedFile } from "./local-tab/scan";

type PendingScan = { folder: string; files: ScannedFile[]; nfoCount: number };
type Tr = (key: string, vars?: Record<string, string | number>) => string;

export function LocalTab() {
  const t = useT();
  const { openMeta } = useView();
  const items = useLocalLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ found: number; total: number } | null>(null);
  const [pending, setPending] = useState<PendingScan | null>(null);
  const [identify, setIdentify] = useState<LocalEntry[] | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const exportSizes: ExportSizes = useMemo(
    () => ({
      poster: settings.nfoPosterSize,
      backdrop: settings.nfoBackdropSize,
      logo: settings.nfoLogoSize,
    }),
    [settings.nfoPosterSize, settings.nfoBackdropSize, settings.nfoLogoSize],
  );

  const onAddFolder = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, multiple: false });
      if (typeof folder !== "string") {
        setBusy(false);
        return;
      }
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
  }, [t, settings.localMinFileSizeMb]);

  const runScan = useCallback(
    async (files: ScannedFile[], mode: ScanMode) => {
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
          entries.push(built);
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
      setPending(null);
      if (files.length) void runScan(files, mode);
    },
    [pending, runScan],
  );

  const onResolveIdentify = useCallback((ids: string[], res: IdentifyResolution) => {
    updateLocalEntries(ids, {
      tmdbId: res.tmdbId,
      imdbId: res.imdbId,
      poster: res.poster,
      title: res.title,
      year: res.year,
      type: res.type,
      needsReview: false,
    });
  }, []);

  const runExport = useCallback(
    async (entries: LocalEntry[]): Promise<{ ok: number; fail: number; reason?: string }> => {
      const key = settings.tmdbKey?.trim();
      if (!key) {
        setToast(t("Add a TMDB key to export metadata."));
        return { ok: 0, fail: 0 };
      }
      const movies = entries.filter((e) => e.type === "movie" && e.tmdbId != null);
      const showGroups = new Map<string, LocalEntry[]>();
      for (const e of entries) {
        if (e.type !== "show" || e.tmdbId == null) continue;
        const gk = `t${e.tmdbId}`;
        let arr = showGroups.get(gk);
        if (!arr) {
          arr = [];
          showGroups.set(gk, arr);
        }
        arr.push(e);
      }
      const total = movies.length + showGroups.size;
      let ok = 0;
      let fail = 0;
      let done = 0;
      let reason: string | undefined;
      for (const m of movies) {
        setToast(t("Exporting {done}/{total}…", { done: ++done, total }));
        const res = await exportMovie(key, m, exportSizes);
        if (res.ok) {
          ok += 1;
          if (res.localArt) updateLocalEntry(m.id, { localArt: res.localArt });
        } else {
          fail += 1;
          reason = reason ?? res.reason;
        }
      }
      for (const eps of showGroups.values()) {
        setToast(t("Exporting {done}/{total}…", { done: ++done, total }));
        const res = await exportSeries(key, eps, exportSizes);
        if (res.ok) {
          ok += 1;
          if (res.localArt)
            updateLocalEntries(
              eps.map((e) => e.id),
              { localArt: res.localArt },
            );
        } else {
          fail += 1;
          reason = reason ?? res.reason;
        }
      }
      return { ok, fail, reason };
    },
    [settings.tmdbKey, exportSizes, t],
  );

  const onExportOne = useCallback(
    async (entryOrList: LocalEntry | LocalEntry[]) => {
      const list = (Array.isArray(entryOrList) ? entryOrList : [entryOrList]).filter(
        (e) => e.tmdbId != null,
      );
      if (list.length === 0) {
        setToast(t("Identify this title before exporting."));
        return;
      }
      const { ok, fail, reason } = await runExport(list);
      setToast(
        fail === 0
          ? t("Saved .nfo and artwork")
          : ok === 0
            ? t("Export failed: {reason}", { reason: reason ?? t("unknown error") })
            : t("Exported {ok}, {fail} failed", { ok, fail }),
      );
    },
    [runExport, t],
  );

  const toggleSelect = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      if (allIn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const bulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    const n = selected.size;
    const ok = await confirmDialog(
      t("Remove {n} items from your library? Files on your disk are not deleted.", { n }),
    );
    if (!ok) return;
    selected.forEach((id) => removeLocalEntry(id));
    exitSelect();
  }, [selected, exitSelect, t]);

  const bulkExport = useCallback(async () => {
    const list = items.filter((i) => selected.has(i.id) && i.tmdbId != null);
    if (list.length === 0) {
      setToast(t("Select identified titles to export."));
      return;
    }
    const { ok, fail, reason } = await runExport(list);
    setToast(
      fail === 0
        ? t("Exported {n} titles", { n: ok })
        : ok === 0
          ? t("Export failed: {reason}", { reason: reason ?? t("unknown error") })
          : t("Exported {ok}, {fail} failed", { ok, fail }),
    );
    exitSelect();
  }, [items, selected, runExport, exitSelect, t]);

  const [type, setType] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<LocalSortKey>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const reviewGroups = useMemo(
    () =>
      groupLocal(items)
        .filter((g) =>
          g.kind === "movie" ? g.entry.needsReview : g.episodes.some((e) => e.needsReview),
        )
        .map((g) => (g.kind === "movie" ? [g.entry] : g.episodes)),
    [items],
  );
  const reviewCount = reviewGroups.length;
  const counts = useMemo(
    () => ({
      all: items.length,
      movie: items.filter((i) => i.type === "movie").length,
      series: items.filter((i) => i.type === "show").length,
    }),
    [items],
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (type === "movie" && it.type !== "movie") return false;
      if (type === "series" && it.type !== "show") return false;
      if (q && !(it.title ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, type, query]);
  const groups = useMemo(
    () => sortGroups(groupLocal(visible), sortKey, sortDir),
    [visible, sortKey, sortDir],
  );

  const openFirstReview = useCallback(() => {
    if (reviewGroups[0]) setIdentify(reviewGroups[0]);
  }, [reviewGroups]);

  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.id));
  const selectAll = useCallback(() => {
    setSelected((prev) => {
      if (visible.every((i) => prev.has(i.id))) {
        const next = new Set(prev);
        visible.forEach((i) => next.delete(i.id));
        return next;
      }
      return new Set([...prev, ...visible.map((i) => i.id)]);
    });
  }, [visible]);
  const invertSelection = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const it of visible) {
        if (next.has(it.id)) next.delete(it.id);
        else next.add(it.id);
      }
      return next;
    });
  }, [visible]);

  const modals = (
    <>
      <ScanModeModal
        isOpen={pending != null}
        nfoCount={pending?.nfoCount ?? 0}
        onPick={onPickMode}
        onClose={() => setPending(null)}
      />
      <IdentifyModal
        target={identify}
        onClose={() => setIdentify(null)}
        onResolved={onResolveIdentify}
      />
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12.5px] font-semibold text-canvas shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </>
  );

  if (items.length === 0) {
    return (
      <>
        {modals}
        <EmptyOwned onAddFolder={onAddFolder} busy={busy} error={error} progress={progress} />
      </>
    );
  }

  const cardProps: LocalCardProps = {
    selectMode,
    selected,
    onToggleSelect: toggleSelect,
    onFixMatch: (e) => setIdentify(Array.isArray(e) ? e : [e]),
    onExport: onExportOne,
    onOpenDetail: (e) => {
      const m = localEntryToMeta(e);
      if (m) openMeta(m);
    },
  };

  return (
    <section className="flex flex-col gap-4">
      {modals}
      <FilterBar
        type={type}
        setType={setType}
        query={query}
        setQuery={setQuery}
        counts={counts}
        trailing={
          <div className="ms-auto flex items-center gap-2">
            <SortMenu
              sortKey={sortKey}
              setSortKey={setSortKey}
              sortDir={sortDir}
              setSortDir={setSortDir}
            />
            <button
              type="button"
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${
                selectMode
                  ? "bg-ink text-canvas"
                  : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              <CheckSquare size={13} strokeWidth={2.2} />
              {selectMode ? t("Done") : t("Select")}
            </button>
            <button
              type="button"
              onClick={onAddFolder}
              disabled={busy}
              className="flex h-9 items-center gap-1.5 rounded-full bg-raised px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FolderPlus size={13} strokeWidth={2.2} />
              )}
              {busy ? scanLabel(progress, t) : t("Add folder")}
            </button>
          </div>
        }
      />
      {selectMode ? (
        <BulkBar
          count={selected.size}
          allSelected={allSelected}
          onSelectAll={selectAll}
          onInvert={invertSelection}
          onDelete={bulkDelete}
          onExport={bulkExport}
          onCancel={exitSelect}
        />
      ) : reviewCount > 0 ? (
        <button
          type="button"
          onClick={openFirstReview}
          className="flex items-center gap-2.5 rounded-xl bg-amber-500/12 px-3.5 py-2.5 text-start ring-1 ring-amber-500/30 transition-colors hover:bg-amber-500/20"
        >
          <AlertTriangle size={15} className="shrink-0 text-amber-500" />
          <span className="text-[12.5px] font-medium text-ink">
            {reviewCount === 1
              ? t("1 title needs review — help us identify it.")
              : t("{n} titles need review — help us identify them.", { n: reviewCount })}
          </span>
          <span className="ms-auto rounded-full bg-amber-500 px-3 py-1 text-[11.5px] font-semibold text-black">
            {t("Review")}
          </span>
        </button>
      ) : null}
      <span className="text-[12px] text-ink-muted">
        {items.length === 1
          ? t("{shown} of {total} file from your computer", {
              shown: visible.length,
              total: items.length,
            })
          : t("{shown} of {total} files from your computer", {
              shown: visible.length,
              total: items.length,
            })}
      </span>
      {error && (
        <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
          {error}
        </p>
      )}
      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-6 py-10 text-center text-[13px] text-ink-muted">
          {t("No matches for these filters.")}
        </p>
      ) : (
        <Grid>
          {groups.map((g) =>
            g.kind === "movie" ? (
              <OwnedCard key={g.entry.id} entry={g.entry} {...cardProps} />
            ) : (
              <ShowGroupCard key={g.key} head={g.head} episodes={g.episodes} {...cardProps} />
            ),
          )}
        </Grid>
      )}
    </section>
  );
}

function scanLabel(progress: { found: number; total: number } | null, t: Tr): string {
  if (!progress) return t("Scanning");
  return `${progress.found} / ${progress.total}`;
}

function EmptyOwned({
  onAddFolder,
  busy,
  error,
  progress,
}: {
  onAddFolder: () => void;
  busy: boolean;
  error: string | null;
  progress: { found: number; total: number } | null;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
      <HardDrive size={32} strokeWidth={1.5} className="text-ink-subtle" />
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[18px] font-semibold text-ink">{t("Add files from your computer")}</h2>
        <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
          {t(
            "Point Harbor at a folder. We scan it for movies and shows, parse titles from filenames, and enrich them with TMDB so they look the same as everything else here. We just remember the path; nothing is copied or moved.",
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onAddFolder}
        disabled={busy}
        className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-colors hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <FolderPlus size={15} strokeWidth={2.2} />
        )}
        {busy ? scanLabel(progress, t) : t("Choose folder")}
      </button>
      {error && (
        <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
          {error}
        </p>
      )}
    </div>
  );
}
