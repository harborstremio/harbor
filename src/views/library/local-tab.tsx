import {
  AlertTriangle,
  CheckSquare,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  localEntryToMeta,
  removeLocalEntry,
  updateLocalEntries,
  useLocalLibrary,
  type LocalEntry,
} from "@/lib/local-library";
import { confirmDialog } from "@/lib/dialog";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { FilterBar, Grid, type TypeKey } from "./shared";
import { VirtualGrid } from "@/components/virtual-grid";
import { groupLocal, ShowGroupCard } from "./local-tab/show-group";
import { ScanModeModal } from "./local-tab/scan-mode-modal";
import { IdentifyModal, type IdentifyResolution } from "./local-tab/identify-modal";
import { type LocalCardProps } from "./local-tab/card-actions";
import { OwnedCard } from "./local-tab/movie-card";
import {
  BulkBar,
  GenreMenu,
  SortMenu,
  sortGroups,
  type GenreOption,
  type LocalSortKey,
  type SortDir,
} from "./local-tab/toolbar";
import { useSettings } from "@/lib/settings";
import { FoldersModal } from "./local-tab/folders-modal";
import { useLocalExport } from "./local-tab/use-local-export";
import { useLocalScan } from "./local-tab/use-local-scan";
import { LocalCwRow } from "./local-tab/cw-row";
import { useReportFeatured } from "./featured-context";

type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** `scrollRef` is the scroll container the grid virtualizes against. The cast
 *  modal has no scroller of its own, so it renders the plain grid instead. */
export function LocalTab({ scrollRef }: { scrollRef?: RefObject<HTMLElement | null> }) {
  const t = useT();
  const { openMeta } = useView();
  const items = useLocalLibrary();
  const [toast, setToast] = useState<string | null>(null);
  const [identify, setIdentify] = useState<LocalEntry[] | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFolders, setShowFolders] = useState(false);
  const anchorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const scan = useLocalScan({ items, setToast });
  const { runExport, onExportOne } = useLocalExport(setToast);

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
    anchorRef.current = null;
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

  const { settings } = useSettings();

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

  // Matches the column width Grid derives in ./shared, so the virtualized rows
  // keep the same density as the rest of the library tabs.
  const posterWidth = Math.round(150 * settings.posterScale);
  const [type, setType] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<LocalSortKey>("added");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [genres, setGenres] = useState<Set<string>>(() => new Set());
  const genreOptions = useMemo<GenreOption[]>(() => {
    const counts = new Map<string, number>();
    for (const it of items) {
      for (const g of it.genres ?? []) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return Array.from(counts, ([name, count]) => ({ name, count })).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  }, [items]);
  const toggleGenre = useCallback((genre: string) => {
    setGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) next.delete(genre);
      else next.add(genre);
      return next;
    });
  }, []);
  const clearGenres = useCallback(() => setGenres(new Set()), []);
  const reviewGroups = useMemo(
    () =>
      groupLocal(items)
        .filter((g) =>
          g.kind === "movie"
            ? g.versions.some((e) => e.needsReview)
            : g.episodes.some((e) => e.needsReview),
        )
        .map((g) => (g.kind === "movie" ? g.versions : g.episodes)),
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
      // OR across selected genres; entries scanned before genres were captured
      // have none and drop out while a genre filter is active.
      if (genres.size > 0 && !(it.genres ?? []).some((g) => genres.has(g))) return false;
      return true;
    });
  }, [items, type, query, genres]);
  const groups = useMemo(
    () => sortGroups(groupLocal(visible), sortKey, sortDir),
    [visible, sortKey, sortDir],
  );
  const selectItems = useCallback(
    (ids: string[], range?: boolean) => {
      const key = ids[0];
      if (!key) return;
      if (range && anchorRef.current && anchorRef.current !== key) {
        const units = groups.map((g) =>
          g.kind === "movie" ? [g.entry.id] : g.episodes.map((e) => e.id),
        );
        const a = units.findIndex((u) => u.includes(anchorRef.current!));
        const b = units.findIndex((u) => u.includes(key));
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          setSelected((prev) => {
            const next = new Set(prev);
            for (let i = lo; i <= hi; i++) units[i].forEach((id) => next.add(id));
            return next;
          });
          return;
        }
      }
      anchorRef.current = key;
      toggleSelect(ids);
    },
    [groups, toggleSelect],
  );

  // localEntryToMeta returns null without a tmdb/imdb id, and the hero needs a
  // resolvable id to fetch a backdrop, so unidentified files are left out.
  useReportFeatured(
    useMemo(
      () =>
        groups
          .map((g) => localEntryToMeta(g.kind === "movie" ? g.entry : g.head))
          .filter((m): m is NonNullable<typeof m> => m != null),
      [groups],
    ),
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

  const openAddFolder = useCallback(() => {
    setShowFolders(false);
    void scan.onAddFolder();
  }, [scan]);

  const onFixMatchCb = useCallback((e: LocalEntry | LocalEntry[]) => {
    setIdentify(Array.isArray(e) ? e : [e]);
  }, []);
  const onOpenDetailCb = useCallback(
    (e: LocalEntry) => {
      const m = localEntryToMeta(e);
      if (m) openMeta(m);
    },
    [openMeta],
  );
  // Stable identity keeps the memoized cards from re-rendering on every toast,
  // scan-progress tick or selection change.
  const cardProps: LocalCardProps = useMemo(
    () => ({
      selectMode,
      onToggleSelect: selectItems,
      onFixMatch: onFixMatchCb,
      onExport: onExportOne,
      onOpenDetail: onOpenDetailCb,
    }),
    [selectMode, selectItems, onFixMatchCb, onExportOne, onOpenDetailCb],
  );

  const modals = (
    <>
      <ScanModeModal
        isOpen={scan.pending != null}
        nfoCount={scan.pending?.nfoCount ?? 0}
        onPick={scan.onPickMode}
        onClose={() => scan.setPending(null)}
      />
      <IdentifyModal
        target={identify}
        onClose={() => setIdentify(null)}
        onResolved={onResolveIdentify}
      />
      <FoldersModal
        isOpen={showFolders}
        folders={scan.folders}
        busy={scan.busy}
        onClose={() => setShowFolders(false)}
        onAddFolder={openAddFolder}
        onRescan={(path) => {
          setShowFolders(false);
          void scan.rescanFolder(path);
        }}
        onRemove={scan.removeFolder}
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
        <EmptyOwned
          onAddFolder={scan.onAddFolder}
          busy={scan.busy}
          error={scan.error}
          progress={scan.progress}
        />
      </>
    );
  }

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
            <GenreMenu
              options={genreOptions}
              selected={genres}
              onToggle={toggleGenre}
              onClear={clearGenres}
            />
            <SortMenu
              sortKey={sortKey}
              setSortKey={setSortKey}
              sortDir={sortDir}
              setSortDir={setSortDir}
            />
            {scan.folders.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFolders(true)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-raised px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              >
                <FolderOpen size={13} strokeWidth={2.2} />
                {t("Folders")}
              </button>
            )}
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
              onClick={scan.onAddFolder}
              disabled={scan.busy}
              className="flex h-9 items-center gap-1.5 rounded-full bg-raised px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:cursor-wait disabled:opacity-60"
            >
              {scan.busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FolderPlus size={13} strokeWidth={2.2} />
              )}
              {scan.busy ? scanLabel(scan.progress, t) : t("Add folder")}
            </button>
          </div>
        }
      />
      {!selectMode && <LocalCwRow />}
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
      {scan.error && (
        <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
          {scan.error}
        </p>
      )}
      {groups.length === 0 ? (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-6 py-10 text-center">
          <p className="text-[13px] text-ink-muted">{t("No matches for these filters.")}</p>
          {genres.size > 0 && (
            <p className="text-[12px] text-ink-subtle">
              {t(
                "Genres are only recorded for files scanned after this feature was added — re-add a folder to pick them up.",
              )}
            </p>
          )}
        </div>
      ) : scrollRef ? (
        <VirtualGrid
          items={groups}
          scrollRef={scrollRef}
          minColumnWidth={posterWidth}
          gapX={16}
          gapY={32}
          estimateRowHeight={Math.round(posterWidth * 1.5) + 46}
          getKey={(g) => g.key}
          renderItem={(g) =>
            g.kind === "movie" ? (
              <OwnedCard
                entry={g.entry}
                versions={g.versions}
                isSelected={g.versions.every((v) => selected.has(v.id))}
                {...cardProps}
              />
            ) : (
              <ShowGroupCard
                head={g.head}
                episodes={g.episodes}
                isSelected={g.episodes.every((e) => selected.has(e.id))}
                {...cardProps}
              />
            )
          }
        />
      ) : (
        <Grid>
          {groups.map((g) =>
            g.kind === "movie" ? (
              <OwnedCard
                key={g.key}
                entry={g.entry}
                versions={g.versions}
                isSelected={g.versions.every((v) => selected.has(v.id))}
                {...cardProps}
              />
            ) : (
              <ShowGroupCard
                key={g.key}
                head={g.head}
                episodes={g.episodes}
                isSelected={g.episodes.every((e) => selected.has(e.id))}
                {...cardProps}
              />
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
