import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUp,
  ArrowUpNarrowWide,
  Check,
  ChevronDown,
  ChevronLeft,
  Layers,
  Search,
} from "lucide-react";
import { useMobileRemote } from "../mobile-remote";
import { useRegisterSheet } from "../mobile-sheet-lock";
import { SHEET_EXIT_CSS, useSheetPresence } from "../remote-extras";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useVirtualWindow } from "./use-virtual-window";
import type { RemoteMangaChapter } from "@/lib/remote/protocol";

const SORT_KEY = "harbor.manga.chaptersort.v1";
const ROW_H = 68;
const NO_CHAPTERS: RemoteMangaChapter[] = [];

const loadDesc = () => {
  try {
    return localStorage.getItem(SORT_KEY) !== "asc";
  } catch {
    return true;
  }
};
const saveDesc = (d: boolean) => {
  try {
    localStorage.setItem(SORT_KEY, d ? "desc" : "asc");
  } catch {}
};

type Src = { id: string; name: string; count: number };

function collectSources(chapters: RemoteMangaChapter[]): Src[] {
  const m = new Map<string, Src>();
  for (const c of chapters) {
    if (!c.sourceId) continue;
    const e = m.get(c.sourceId) ?? { id: c.sourceId, name: c.sourceName ?? c.sourceId, count: 0 };
    e.count += 1;
    m.set(c.sourceId, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function ChapterNavigator({
  open,
  onClose,
  onJumpPage,
}: {
  open: boolean;
  onClose: () => void;
  onJumpPage: () => void;
}) {
  const { snapshot, sendCommand } = useMobileRemote();
  const manga = snapshot.manga;
  const reduce = useReducedMotion();
  const { render, leaving } = useSheetPresence(open);
  useRegisterSheet(open);

  const [query, setQuery] = useState("");
  const [desc, setDesc] = useState(loadDesc);
  const [src, setSrc] = useState("all");

  const chapters = manga?.chapters ?? NO_CHAPTERS;
  const sources = useMemo(() => collectSources(chapters), [chapters]);
  const multiSource = sources.length > 1;
  const effSrc = sources.some((s) => s.id === src) ? src : "all";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const num = (c: RemoteMangaChapter) => parseFloat(c.chapter ?? "") || 0;
    return chapters
      .filter((c) => effSrc === "all" || c.sourceId === effSrc)
      .filter(
        (c) => !q || c.label.toLowerCase().includes(q) || (c.title ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (desc ? num(b) - num(a) : num(a) - num(b)));
  }, [chapters, query, desc, effSrc]);

  const activeRow = manga ? rows.findIndex((c) => c.id === manga.chapterId) : -1;
  const {
    ref: scrollRef,
    onScroll,
    scrollToRow,
    scrollTop,
    start,
    end,
    padTop,
    totalHeight,
  } = useVirtualWindow(rows.length, ROW_H);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      if (activeRow >= 0) scrollToRow(activeRow);
    });
    return () => cancelAnimationFrame(raf);
  }, [open, activeRow, scrollToRow]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!render || !manga) return null;

  const jump = (index: number) => {
    sendCommand({ action: "mangaJumpChapter", index });
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col bg-canvas ${leaving ? "harbor-sheet-scrim-out" : reduce ? "" : "animate-fade-in"}`}
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
    >
      <style>{SHEET_EXIT_CSS}</style>

      <div className="flex items-center gap-1.5 px-3 pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-transform active:scale-90"
        >
          <ChevronLeft size={24} strokeWidth={2.2} className="dir-icon" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold text-ink">Chapters</span>
          <span className="text-[12px] tabular-nums text-ink-subtle">
            {manga.chapterIndex + 1} of {chapters.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onJumpPage}
          className="flex h-11 items-center rounded-full bg-elevated/70 px-4 text-[13.5px] font-semibold text-ink transition-transform active:scale-95"
        >
          Page {manga.pageIndex + 1}
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="flex h-12 items-center gap-2.5 rounded-2xl bg-elevated/70 px-4">
          <Search size={18} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search chapters"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 pb-2">
        <button
          type="button"
          onClick={() =>
            setDesc((d) => {
              const n = !d;
              saveDesc(n);
              return n;
            })
          }
          aria-label={
            desc ? "Sorted newest first, tap for oldest" : "Sorted oldest first, tap for newest"
          }
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-edge-soft/70 px-3 text-[12.5px] font-semibold text-ink-muted transition-transform active:scale-95"
        >
          {desc ? (
            <ArrowDownWideNarrow size={15} strokeWidth={2.2} />
          ) : (
            <ArrowUpNarrowWide size={15} strokeWidth={2.2} />
          )}
          {desc ? "Newest" : "Oldest"}
        </button>
        {multiSource ? (
          <SourceDropdown
            sources={sources}
            total={chapters.length}
            active={effSrc}
            onPick={setSrc}
          />
        ) : sources.length === 1 ? (
          <span className="flex h-9 min-w-0 items-center gap-1.5 rounded-full bg-elevated/50 px-3 text-[12.5px] font-medium text-ink-subtle">
            <Layers size={14} strokeWidth={2.2} className="shrink-0" />
            <span className="truncate">{sources[0].name}</span>
          </span>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-16 text-center text-[14px] text-ink-muted">
          No chapters match your search.
        </p>
      ) : (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          <div className="relative" style={{ height: totalHeight }}>
            <div
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${padTop}px)` }}
            >
              {rows.slice(start, end).map((c) => (
                <ChapterRow
                  key={c.id}
                  chapter={c}
                  active={c.id === manga.chapterId}
                  showSource={multiSource}
                  onClick={() => jump(c.index)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {scrollTop > 240 && (
        <button
          type="button"
          onClick={() =>
            scrollRef.current?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
          }
          aria-label="Scroll to top"
          className="absolute end-5 grid h-12 w-12 place-items-center rounded-full border border-edge-soft bg-elevated/90 text-ink shadow-[0_10px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md transition-transform active:scale-90"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
        >
          <ArrowUp size={22} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

function ChapterRow({
  chapter,
  active,
  showSource,
  onClick,
}: {
  chapter: RemoteMangaChapter;
  active: boolean;
  showSource: boolean;
  onClick: () => void;
}) {
  const source = chapter.sourceName ?? chapter.sourceId;
  return (
    <div style={{ height: ROW_H }} className="py-1">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-full w-full items-center gap-3 rounded-2xl px-3.5 text-start transition-colors ${active ? "bg-accent-soft" : "active:bg-elevated/60"}`}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums ${active ? "bg-accent text-canvas" : "bg-raised text-ink-muted"}`}
        >
          {chapter.chapter ?? "•"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={`truncate text-[15px] ${active ? "font-semibold text-accent" : "font-medium text-ink"}`}
          >
            {chapter.label}
          </span>
          {(chapter.title || chapter.group) && (
            <span className="truncate text-[12px] text-ink-subtle">
              {chapter.title || chapter.group}
            </span>
          )}
        </span>
        {showSource && source && (
          <span className="max-w-[92px] shrink-0 truncate rounded-md bg-raised px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-subtle">
            {source}
          </span>
        )}
        {chapter.downloaded && (
          <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle">
            Saved
          </span>
        )}
        {active && <Check size={20} strokeWidth={2.6} className="shrink-0 text-accent" />}
      </button>
    </div>
  );
}

function SourceDropdown({
  sources,
  total,
  active,
  onPick,
}: {
  sources: Src[];
  total: number;
  active: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const activeName =
    active === "all"
      ? "All sources"
      : (sources.find((s) => s.id === active)?.name ?? "All sources");

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-9 w-full min-w-0 items-center gap-1.5 rounded-full bg-elevated/70 px-3 text-[12.5px] font-semibold text-ink transition-transform active:scale-[0.98]"
      >
        <Layers size={14} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
        <span className="min-w-0 flex-1 truncate text-start">{activeName}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.4}
          className={`shrink-0 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-edge-soft bg-elevated p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
          <SourceOption
            name="All sources"
            count={total}
            active={active === "all"}
            onClick={() => {
              onPick("all");
              setOpen(false);
            }}
          />
          {sources.map((s) => (
            <SourceOption
              key={s.id}
              name={s.name}
              count={s.count}
              active={active === s.id}
              onClick={() => {
                onPick(s.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceOption({
  name,
  count,
  active,
  onClick,
}: {
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-[13.5px] transition-colors ${active ? "bg-accent-soft font-semibold text-accent" : "text-ink-muted active:bg-raised/60"}`}
    >
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle">{count}</span>
      {active && <Check size={16} strokeWidth={2.6} className="shrink-0 text-accent" />}
    </button>
  );
}
