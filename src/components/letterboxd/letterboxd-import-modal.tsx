/**
 * LetterboxdImportModal
 *
 * A full-screen panel (stacked over Profile Settings, same pattern as
 * CustomizationPanel) with a 4-step import flow:
 *
 *   Step 1 — Picker:       ZIP file selector
 *   Step 2 — Processing:   parse + resolve with progress bar
 *   Step 3 — Review:       summary + per-film table + toggles + confirm
 *   Step 4 — Done:         success screen
 */

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckSquare,
  Download,
  Film,
  Loader2,
  Square,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { parseLbxZip, LbxImportError, type LbxParseResult } from "@/lib/letterboxd-import/parser";
import { resolveItems, unmatchedToCsv, type ResolvedItem, type ResolveProgress } from "@/lib/letterboxd-import/resolver";
import { setRatingLocal } from "@/lib/ratings/store";
import { setMovieWatchedLocal } from "@/lib/movie-watched";
import { setWatchedFlag } from "@/lib/watched-flag";
import { addToWatchlist } from "@/lib/watchlist";
import type { MyRating } from "@/lib/ratings/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        {sublabel && <div className="text-[12px] text-ink-subtle">{sublabel}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{ minHeight: 0 }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? "bg-accent" : "bg-edge"}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function StatusBadge({ status, exists }: { status: "matched" | "unmatched"; exists?: boolean }) {
  if (status === "unmatched") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger/12 px-2 py-0.5 text-[11px] font-medium text-danger">
        <X size={10} /> Unmatched
      </span>
    );
  }
  if (exists) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">
        Update
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
      <Check size={10} /> New
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Picker
// ---------------------------------------------------------------------------

function PickerStep({
  onPicked,
}: {
  onPicked: (buffer: ArrayBuffer, name: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setError("Please select a Letterboxd export ZIP file.");
        return;
      }
      setError(null);
      file.arrayBuffer().then((buf) => onPicked(buf, file.name)).catch(() => {
        setError("Could not read the selected file.");
      });
    },
    [onPicked],
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-elevated ring-1 ring-edge-soft">
        <Film size={36} className="text-ink-muted" />
      </div>
      <div className="text-center">
        <h3 className="font-display text-[18px] text-ink">Import from Letterboxd</h3>
        <p className="mt-1.5 max-w-sm text-[13px] text-ink-subtle">
          Export your data from{" "}
          <span className="font-medium text-ink">letterboxd.com → Settings → Import &amp; Export → Export Your Data</span>{" "}
          then select the downloaded ZIP below.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="sr-only"
        id="lbx-zip-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div
        className={`w-full max-w-sm cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent/8"
            : "border-edge-soft bg-elevated hover:border-edge hover:bg-surface"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <Upload size={24} className="mx-auto mb-3 text-ink-muted" />
        <p className="text-[13px] font-medium text-ink">Drop ZIP here, or click to browse</p>
        <p className="mt-1 text-[11px] text-ink-subtle">letterboxd-export.zip</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-danger/12 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/25">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Processing
// ---------------------------------------------------------------------------

function ProcessingStep({ progress }: { progress: ResolveProgress }) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <Loader2 size={36} className="animate-spin text-accent" />
      <div className="text-center">
        <h3 className="font-display text-[18px] text-ink">Matching films…</h3>
        <p className="mt-1 text-[13px] text-ink-subtle">
          {progress.done} / {progress.total} resolved
        </p>
      </div>
      <div className="w-full max-w-xs overflow-hidden rounded-full bg-elevated ring-1 ring-edge-soft">
        <div
          className="h-2 rounded-full bg-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Review
// ---------------------------------------------------------------------------

type ImportToggles = { ratings: boolean; watched: boolean; watchlist: boolean };

function ReviewStep({
  parseResult,
  items,
  onConfirm,
  onClose,
}: {
  parseResult: LbxParseResult;
  items: ResolvedItem[];
  onConfirm: (items: ResolvedItem[], toggles: ImportToggles) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ResolvedItem[]>(items);
  const [toggles, setToggles] = useState<ImportToggles>({
    ratings: true,
    watched: true,
    watchlist: true,
  });

  const matchedCount = rows.filter((r) => r.status === "matched").length;
  const unmatchedCount = rows.filter((r) => r.status === "unmatched").length;
  const checkedCount = rows.filter((r) => r.checked).length;

  const toggleRow = (idx: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)),
    );
  };

  const toggleAll = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, checked: r.status === "matched" ? checked : false })));
  };

  const handleDownloadUnmatched = () => {
    const csv = unmatchedToCsv(rows);
    downloadCsv(csv, "letterboxd-unmatched.csv");
  };

  const allMatchedChecked = rows.filter((r) => r.status === "matched").every((r) => r.checked);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Summary header */}
      <div className="shrink-0 space-y-4 border-b border-edge-soft bg-elevated px-6 py-4">
        <div className="flex flex-wrap gap-3">
          <Pill value={parseResult.films.length} label="Total films" />
          <Pill value={parseResult.ratedCount} label="Rated" accent />
          <Pill value={parseResult.watchedCount} label="Watched" />
          <Pill value={parseResult.watchlistCount} label="Watchlist" />
          <Pill value={matchedCount} label="Matched" success />
          {unmatchedCount > 0 && <Pill value={unmatchedCount} label="Unmatched" danger />}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Toggle
            checked={toggles.ratings}
            onChange={(v) => setToggles((t) => ({ ...t, ratings: v }))}
            label="Import ratings"
          />
          <Toggle
            checked={toggles.watched}
            onChange={(v) => setToggles((t) => ({ ...t, watched: v }))}
            label="Import watched"
          />
          <Toggle
            checked={toggles.watchlist}
            onChange={(v) => setToggles((t) => ({ ...t, watchlist: v }))}
            label="Import watchlist"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 z-10 bg-canvas">
            <tr className="border-b border-edge-soft text-left text-[11px] text-ink-subtle">
              <th className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleAll(!allMatchedChecked)}
                  className="flex items-center gap-1 hover:text-ink"
                >
                  {allMatchedChecked ? (
                    <CheckSquare size={13} className="text-accent" />
                  ) : (
                    <Square size={13} />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">Title</th>
              <th className="px-3 py-2.5 font-medium">Year</th>
              <th className="px-3 py-2.5 font-medium">Lbx ★</th>
              <th className="px-3 py-2.5 font-medium">Harbor ★</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.film.uri || idx}
                className={`border-b border-edge-soft/50 transition-colors ${
                  row.checked ? "bg-transparent" : "opacity-50"
                } ${row.status === "unmatched" ? "bg-danger/4" : "hover:bg-elevated/40"}`}
              >
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleRow(idx)}
                    disabled={row.status === "unmatched"}
                    className="flex items-center gap-1 text-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {row.checked ? (
                      <CheckSquare size={13} className="text-accent" />
                    ) : (
                      <Square size={13} />
                    )}
                  </button>
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 font-medium text-ink">
                  {row.film.name}
                </td>
                <td className="px-3 py-2 text-ink-muted">{row.film.year || "—"}</td>
                <td className="px-3 py-2 text-ink-muted">
                  {row.film.lbxRating != null ? `${row.film.lbxRating}/5` : "—"}
                </td>
                <td className="px-3 py-2 font-medium text-ink">
                  {row.film.harborRating != null ? `${row.film.harborRating}/10` : "—"}
                </td>
                <td className="px-3 py-2 text-ink-subtle">
                  {Array.from(row.film.actions).join(" · ")}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge
                    status={row.status}
                    exists={row.ratingExists || row.watchedExists}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-edge-soft bg-canvas px-6 py-3">
        <div className="flex items-center gap-2">
          {unmatchedCount > 0 && (
            <button
              type="button"
              onClick={handleDownloadUnmatched}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] text-ink-muted ring-1 ring-edge-soft hover:bg-elevated hover:text-ink"
            >
              <Download size={13} />
              Download unmatched ({unmatchedCount})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-subtle">{checkedCount} films to import</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-9 items-center rounded-[10px] px-4 text-[13.5px] font-medium text-ink-muted hover:bg-elevated"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(rows, toggles)}
            disabled={checkedCount === 0}
            className="inline-flex min-h-9 items-center gap-2 rounded-[10px] bg-accent px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Check size={15} /> Confirm import
          </button>
        </div>
      </div>
    </div>
  );
}

function Pill({
  value,
  label,
  accent,
  success,
  danger,
}: {
  value: number;
  label: string;
  accent?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  const cls = accent
    ? "bg-accent/12 text-accent"
    : success
      ? "bg-success/15 text-success"
      : danger
        ? "bg-danger/12 text-danger"
        : "bg-elevated text-ink-muted ring-1 ring-edge-soft";
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${cls}`}>
      <span className="text-[15px] font-bold tabular-nums">{value}</span>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Done
// ---------------------------------------------------------------------------

function DoneStep({
  importedCount,
  onClose,
}: {
  importedCount: number;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-success/15 ring-1 ring-success/30">
        <Check size={36} className="text-success" />
      </div>
      <div className="text-center">
        <h3 className="font-display text-[20px] text-ink">Import complete</h3>
        <p className="mt-1.5 text-[13px] text-ink-subtle">
          Successfully imported <span className="font-semibold text-ink">{importedCount} films</span> into your library.
        </p>
        <p className="mt-1 text-[12px] text-ink-subtle">
          Ratings are visible on detail pages. Watched films will sync on next app refresh.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center rounded-[10px] bg-accent px-6 text-[14px] font-semibold text-canvas hover:opacity-90"
      >
        Done
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import execution
// ---------------------------------------------------------------------------

function executeImport(
  items: ResolvedItem[],
  toggles: ImportToggles,
): number {
  let count = 0;
  const now = Date.now();

  for (const item of items) {
    if (!item.checked || item.status === "unmatched" || !item.meta) continue;
    const meta = item.meta;
    const film = item.film;

    // Ratings
    if (toggles.ratings && film.actions.has("rated") && film.harborRating != null) {
      const rating: MyRating = {
        itemKey: meta.id,
        mediaType: "movie",
        score: film.harborRating,
        title: meta.name || film.name,
        poster: meta.poster,
        updatedAt: now,
      };
      setRatingLocal(rating);
      count++;
    }

    // Watched (always also sets movie-watched flag)
    if (toggles.watched && film.actions.has("watched")) {
      setMovieWatchedLocal(meta.id, true);
      setWatchedFlag(meta.id, true);
      if (!film.actions.has("rated")) count++; // only count once per film
    }

    // Watchlist
    if (toggles.watchlist && film.actions.has("watchlist")) {
      addToWatchlist({
        id: meta.id,
        type: "movie",
        name: meta.name || film.name,
        poster: meta.poster,
      });
      if (!film.actions.has("rated") && !film.actions.has("watched")) count++;
    }
  }

  return count;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Step = "picker" | "processing" | "review" | "done";

export function LetterboxdImportModal({ onClose }: { onClose: () => void }) {
  const { settings } = useSettings();
  const [step, setStep] = useState<Step>("picker");
  const [progress, setProgress] = useState<ResolveProgress>({ done: 0, total: 0 });
  const [parseResult, setParseResult] = useState<LbxParseResult | null>(null);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFilePicked = useCallback(
    async (buffer: ArrayBuffer) => {
      setError(null);
      setStep("processing");
      setProgress({ done: 0, total: 1 });
      try {
        const parsed = await parseLbxZip(buffer);
        setParseResult(parsed);
        setProgress({ done: 0, total: parsed.films.length });
        const resolved = await resolveItems(
          parsed.films,
          settings.tmdbKey ?? "",
          (p) => setProgress(p),
        );
        setResolvedItems(resolved);
        setStep("review");
      } catch (e) {
        const msg =
          e instanceof LbxImportError
            ? e.message
            : "An unexpected error occurred while processing the ZIP.";
        setError(msg);
        setStep("picker");
      }
    },
    [settings.tmdbKey],
  );

  const handleConfirm = useCallback(
    (items: ResolvedItem[], toggles: ImportToggles) => {
      const n = executeImport(items, toggles);
      setImportedCount(n);
      setStep("done");
    },
    [],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-edge-soft bg-canvas px-6 py-3">
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-elevated"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-display text-[18px] text-ink">Import from Letterboxd</h2>
      </div>

      {error && (
        <div className="shrink-0 flex items-center gap-2 bg-danger/10 px-6 py-2.5 text-[12.5px] text-danger">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {step === "picker" && (
        <PickerStep onPicked={handleFilePicked} onClose={onClose} />
      )}
      {step === "processing" && <ProcessingStep progress={progress} />}
      {step === "review" && parseResult && (
        <ReviewStep
          parseResult={parseResult}
          items={resolvedItems}
          onConfirm={handleConfirm}
          onClose={onClose}
        />
      )}
      {step === "done" && <DoneStep importedCount={importedCount} onClose={onClose} />}
    </div>
  );
}
