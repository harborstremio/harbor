import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ArrowUp, Check, ChevronDown, Info, Maximize2, Minimize2, Settings2, Volume2, VolumeX, X } from "lucide-react";
import { Tooltip } from "@/views/detail/tooltip";
import { t, useT } from "@/lib/i18n";
import { listMangaSources } from "@/lib/manga/sources";
import {
  chapterSourceOf,
  loadChapterSource,
  saveChapterSource,
  SourceMenu,
} from "./reader-source-menu";
import { PhoneRemoteButton } from "./reader-phone-remote";
import type { MangaChapter } from "@/views/manga/manga-reader/reader-types";

function chapterLabel(c: MangaChapter): string {
  return c.chapter ? t("Chapter {n}", { n: c.chapter }) : c.title || t("Oneshot");
}

const CHAPTER_SORT_KEY = "harbor.manga.chaptersort.v1";
function loadChapterDesc(): boolean {
  try {
    return localStorage.getItem(CHAPTER_SORT_KEY) !== "asc";
  } catch {
    return true;
  }
}
function saveChapterDesc(desc: boolean): void {
  try {
    localStorage.setItem(CHAPTER_SORT_KEY, desc ? "desc" : "asc");
  } catch {
    /* noop */
  }
}

const ICON_BTN =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted transition duration-150 hover:bg-elevated hover:text-ink active:scale-90";

export function ReaderBar({
  visible,
  chapters,
  index,
  onJumpChapter,
  fullscreen,
  onToggleFullscreen,
  onOpenSettings,
  onExit,
  onOpenDetail,
  flipSound,
  onToggleFlipSound,
}: {
  visible: boolean;
  chapters: MangaChapter[];
  index: number;
  onJumpChapter: (i: number) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onExit: () => void;
  onOpenDetail: () => void;
  flipSound?: boolean | null;
  onToggleFlipSound?: () => void;
}) {
  const t = useT();
  return (
    <div
      data-tauri-drag-region
      className={`flex h-14 shrink-0 items-center gap-3 border-b border-edge-soft bg-canvas/70 px-3 text-ink backdrop-blur-xl transition-opacity duration-300 ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <Tooltip label={t("Close reader")} side="bottom">
        <button
          type="button"
          onClick={onExit}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={t("Close reader")}
          className={ICON_BTN}
        >
          <X className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </Tooltip>

      <div className="flex flex-1" data-tauri-drag-region />

      <ChapterMenu chapters={chapters} index={index} onJump={onJumpChapter} />

      <div className="flex flex-1" data-tauri-drag-region />

      <Tooltip label={t("View details")} side="bottom">
        <button
          type="button"
          onClick={onOpenDetail}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={t("View details")}
          className={ICON_BTN}
        >
          <Info className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </Tooltip>

      {flipSound != null && onToggleFlipSound && (
        <Tooltip label={flipSound ? t("Mute page-turn sound") : t("Unmute page-turn sound")} side="bottom">
          <button
            type="button"
            onClick={onToggleFlipSound}
            onMouseDown={(e) => e.preventDefault()}
            aria-label={flipSound ? t("Mute page-turn sound") : t("Unmute page-turn sound")}
            className={ICON_BTN}
          >
            {flipSound ? (
              <Volume2 className="h-5 w-5" strokeWidth={2.2} />
            ) : (
              <VolumeX className="h-5 w-5" strokeWidth={2.2} />
            )}
          </button>
        </Tooltip>
      )}
      <PhoneRemoteButton />
      <Tooltip label={fullscreen ? t("Exit fullscreen") : t("Fullscreen")} side="bottom">
        <button
          type="button"
          onClick={onToggleFullscreen}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={fullscreen ? t("Exit fullscreen") : t("Fullscreen")}
          className={ICON_BTN}
        >
          {fullscreen ? (
            <Minimize2 className="h-5 w-5" strokeWidth={2.2} />
          ) : (
            <Maximize2 className="h-5 w-5" strokeWidth={2.2} />
          )}
        </button>
      </Tooltip>
      <Tooltip label={t("Reader settings")} side="bottom">
        <button
          type="button"
          onClick={onOpenSettings}
          onMouseDown={(e) => e.preventDefault()}
          aria-label={t("Reader settings")}
          className={ICON_BTN}
        >
          <Settings2 className="h-5 w-5" strokeWidth={2.2} />
        </button>
      </Tooltip>
    </div>
  );
}

function ChapterMenu({
  chapters,
  index,
  onJump,
}: {
  chapters: MangaChapter[];
  index: number;
  onJump: (i: number) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => {
      setShown(true);
      activeRef.current?.scrollIntoView({ block: "center" });
    });
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const [desc, setDesc] = useState(loadChapterDesc);
  const listRef = useRef<HTMLDivElement>(null);
  const [listScrolled, setListScrolled] = useState(false);
  const toggleDesc = () =>
    setDesc((d) => {
      const next = !d;
      saveChapterDesc(next);
      return next;
    });

  const [srcFilter, setSrcFilter] = useState(loadChapterSource);
  const pickSource = (id: string) => {
    setSrcFilter(id);
    saveChapterSource(id);
  };
  const sourceInfo = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of chapters) {
      const s = chapterSourceOf(c);
      if (!s) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    const known = listMangaSources();
    const entries = [...counts.entries()].map(([id, count]) => {
      const src = known.find((s) => s.provider === id || s.id === id);
      return { id, count, name: src?.name ?? id, iconUrl: src?.iconUrl };
    });
    entries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return entries;
  }, [chapters]);
  const multiSource = sourceInfo.length > 1;
  const effSource =
    multiSource && sourceInfo.some((s) => s.id === srcFilter) ? srcFilter : "all";

  const num = (c: MangaChapter) => parseFloat(c.chapter ?? "") || 0;
  const rows = chapters
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => effSource === "all" || chapterSourceOf(c) === effSource)
    .sort((a, b) => (desc ? num(b.c) - num(a.c) : num(a.c) - num(b.c)));

  const current = chapters[index];

  return (
    <div ref={ref} className="relative flex shrink-0 flex-col items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseDown={(e) => e.preventDefault()}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl px-3 py-1 text-sm font-semibold text-ink transition duration-150 hover:bg-elevated active:scale-[0.97]"
      >
        <span className="max-w-[44vw] truncate sm:max-w-xs">{chapterLabel(current)}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.2}
        />
      </button>
      <span className="text-[11px] tabular-nums text-ink-subtle">
        {t("{page} of {count}", { page: index + 1, count: chapters.length })}
      </span>
      {open && (
        <div
          className={`absolute top-[calc(100%+10px)] z-50 w-72 origin-top overflow-hidden rounded-2xl border border-edge bg-surface/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-all duration-200 ${shown ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"}`}
        >
          <div className="relative flex items-center justify-between gap-2 border-b border-edge-soft/70 px-3.5 py-2.5">
            {multiSource ? (
              <SourceMenu
                sources={sourceInfo}
                total={chapters.length}
                active={effSource}
                onPick={pickSource}
              />
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                {t("Chapters")}
              </span>
            )}
            <button
              type="button"
              onClick={toggleDesc}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowDownUp size={12} strokeWidth={2.2} />
              {desc ? t("Newest first") : t("Oldest first")}
            </button>
          </div>
          <div
            ref={listRef}
            onScroll={(e) => setListScrolled(e.currentTarget.scrollTop > 140)}
            className="max-h-72 overflow-y-auto overscroll-contain p-1.5"
          >
            {rows.map(({ c, i }) => {
              const active = i === index;
              return (
                <button
                  key={c.id}
                  ref={active ? activeRef : undefined}
                  type="button"
                  onClick={() => {
                    onJump(i);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-[13px] transition-colors ${active ? "bg-accent/15 font-semibold text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"}`}
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 text-accent ${active ? "opacity-100" : "opacity-0"}`}
                    strokeWidth={2.6}
                  />
                  <span className="truncate">{chapterLabel(c)}</span>
                  {c.group && (
                    <span className="ms-auto shrink-0 truncate text-[10px] text-ink-subtle">{c.group}</span>
                  )}
                </button>
              );
            })}
          </div>
          {listScrolled && (
            <button
              type="button"
              onClick={() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label={t("Scroll to top")}
              className="absolute bottom-2.5 end-2.5 grid h-8 w-8 place-items-center rounded-full border border-edge-soft bg-elevated/90 text-ink-muted shadow-[0_6px_16px_-6px_rgba(0,0,0,0.6)] backdrop-blur-md transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowUp size={15} strokeWidth={2.4} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
