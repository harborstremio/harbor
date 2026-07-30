import {
  ArrowDownUp,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  CheckSquare,
  ChevronDown,
  Download,
  FlipHorizontal2,
  Square,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { LocalEntry } from "@/lib/local-library";
import type { LocalGroup } from "./show-group";

export type LocalSortKey = "added" | "title" | "year" | "rating" | "runtime";
export type SortDir = "asc" | "desc";

function groupSortEntry(g: LocalGroup): { entry: LocalEntry; added: number } {
  if (g.kind === "movie") {
    return { entry: g.entry, added: Math.max(...g.versions.map((v) => v.addedAt)) };
  }
  return { entry: g.head, added: Math.max(...g.episodes.map((e) => e.addedAt)) };
}

export function sortGroups(groups: LocalGroup[], key: LocalSortKey, dir: SortDir): LocalGroup[] {
  const mul = dir === "asc" ? 1 : -1;
  const decorated = groups.map((g) => ({ g, ...groupSortEntry(g) }));
  decorated.sort((a, b) => {
    if (key === "title") {
      return (
        mul *
        (a.entry.title ?? "").localeCompare(b.entry.title ?? "", undefined, { sensitivity: "base" })
      );
    }
    if (key === "runtime") {
      const ra = a.g.kind === "show" ? 0 : 1;
      const rb = b.g.kind === "show" ? 0 : 1;
      if (ra !== rb) return ra - rb;
    }
    const pick = (e: LocalEntry, added: number): number | null =>
      key === "year"
        ? (e.year ?? null)
        : key === "rating"
          ? (e.rating ?? null)
          : key === "runtime"
            ? (e.runtime ?? null)
            : added;
    const av = pick(a.entry, a.added);
    const bv = pick(b.entry, b.added);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return mul * (av - bv);
  });
  return decorated.map((d) => d.g);
}

export type GenreOption = { name: string; count: number };

/**
 * Multi-select genre picker. Follows SortMenu's dropdown idiom (outside-click +
 * Escape close) so it stays native to this toolbar; options are the genres
 * actually present in the library, most common first.
 */
export function GenreMenu({
  options,
  selected,
  onToggle,
  onClear,
}: {
  options: GenreOption[];
  selected: Set<string>;
  onToggle: (genre: string) => void;
  onClear: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (options.length === 0) return null;
  const count = selected.size;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${
          count > 0
            ? "bg-ink text-canvas"
            : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
        }`}
      >
        <Tags size={13} strokeWidth={2.2} />
        {count === 0 ? t("Genre") : t("{n} genres", { n: count })}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute end-0 top-[calc(100%+6px)] z-50 max-h-[320px] w-56 overflow-y-auto rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in">
          {count > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-start text-[13px] text-ink-muted transition-colors hover:bg-raised/60 hover:text-ink"
            >
              <X size={13} strokeWidth={2.4} />
              {t("Clear genres")}
            </button>
          )}
          {options.map((o) => {
            const on = selected.has(o.name);
            return (
              <button
                key={o.name}
                type="button"
                onClick={() => onToggle(o.name)}
                className={`flex h-9 w-full items-center justify-between gap-3 rounded-lg px-3 text-start text-[13px] transition-colors ${
                  on ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised/60 hover:text-ink"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {on ? (
                    <CheckSquare size={14} strokeWidth={2.4} className="shrink-0 text-accent" />
                  ) : (
                    <Square size={14} strokeWidth={2.2} className="shrink-0" />
                  )}
                  <span className="truncate">{o.name}</span>
                </span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-ink-subtle">
                  {o.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SortMenu({
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
}: {
  sortKey: LocalSortKey;
  setSortKey: (k: LocalSortKey) => void;
  sortDir: SortDir;
  setSortDir: (d: SortDir) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options: Array<[LocalSortKey, string]> = [
    ["added", t("Date added")],
    ["title", t("Title")],
    ["year", t("Year")],
    ["rating", t("Rating")],
    ["runtime", t("Duration")],
  ];
  const activeLabel = options.find(([k]) => k === sortKey)?.[1] ?? "";
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const dirLabel = sortDir === "asc" ? t("Ascending") : t("Descending");
  return (
    <div className="flex items-center gap-1.5">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-full bg-raised px-3.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <ArrowDownUp size={13} strokeWidth={2.2} />
          {activeLabel}
          <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute end-0 top-[calc(100%+6px)] z-50 w-44 rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in">
            {options.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSortKey(k);
                  setOpen(false);
                }}
                className={`flex h-9 w-full items-center justify-between gap-3 rounded-lg px-3 text-start text-[13px] transition-colors ${
                  sortKey === k
                    ? "bg-raised text-ink"
                    : "text-ink-muted hover:bg-raised/60 hover:text-ink"
                }`}
              >
                <span>{label}</span>
                {sortKey === k && <Check size={14} strokeWidth={2.4} className="text-accent" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
        title={dirLabel}
        aria-label={dirLabel}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        {sortDir === "asc" ? (
          <ArrowUpNarrowWide size={15} strokeWidth={2.2} />
        ) : (
          <ArrowDownWideNarrow size={15} strokeWidth={2.2} />
        )}
      </button>
    </div>
  );
}

export function BulkBar({
  count,
  allSelected,
  onSelectAll,
  onInvert,
  onDelete,
  onExport,
  onCancel,
}: {
  count: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onInvert: () => void;
  onDelete: () => void;
  onExport: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-elevated/70 px-3.5 py-2.5 ring-1 ring-edge-soft">
      <span className="text-[12.5px] font-semibold text-ink">
        {count === 1 ? t("1 selected") : t("{n} selected", { n: count })}
      </span>
      <button
        type="button"
        onClick={onSelectAll}
        className="flex h-8 items-center gap-1.5 rounded-full bg-raised px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <CheckSquare size={13} strokeWidth={2.2} />
        {allSelected ? t("Deselect all") : t("Select all")}
      </button>
      <button
        type="button"
        onClick={onInvert}
        className="flex h-8 items-center gap-1.5 rounded-full bg-raised px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <FlipHorizontal2 size={13} strokeWidth={2.2} />
        {t("Invert")}
      </button>
      <div className="ms-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={count === 0}
          className="flex h-8 items-center gap-1.5 rounded-full bg-raised px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-canvas hover:text-ink disabled:opacity-40"
        >
          <Download size={13} strokeWidth={2.2} />
          {t("Export")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={count === 0}
          className="flex h-8 items-center gap-1.5 rounded-full bg-danger/90 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-danger disabled:opacity-40"
        >
          <Trash2 size={13} strokeWidth={2.2} />
          {t("Remove")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          {t("Cancel")}
        </button>
      </div>
    </div>
  );
}
