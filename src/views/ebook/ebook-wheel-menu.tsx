import {
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  Download,
  Eye,
  FileText,
  Info,
  Loader2,
  Play,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { emitListToast } from "@/components/lists/list-toast";
import type { EBook } from "@/lib/ebook/api";
import {
  ebookInLibrary,
  eBookIsReadLater,
  toggleEBookLibrary,
  toggleEBookReadLater,
} from "@/lib/ebook/library";
import {
  enqueueEBookExport,
  sourceRouteForEBook,
  type EBookExportFormat,
} from "@/lib/ebook/offline-export";
import { sourceEBookChapters, sourceEBookDetail } from "@/lib/ebook/providers";
import { loadEBookResume } from "@/lib/ebook/reader-state";
import { useT } from "@/lib/i18n";
import { getEBookTracking, saveEBookTracking } from "@/lib/ebook/tracking";
import { useView } from "@/lib/view";

export type EBookWheelTarget = { ebook: EBook; x: number; y: number };

type WheelMode = "wheel" | "details" | "download";

type WheelAction = {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
  active?: boolean;
};

function ShelfBooksIcon({ size = 20, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 18.5h18" />
      <path d="M4.5 21h15" />
      <path d="M5.5 7.5h3v11h-3z" />
      <path d="M8.5 5h3.5v13.5H8.5z" />
      <path d="M12 8h3.5v10.5H12z" />
      <path d="m16.5 6 3 1-3.7 11.5h-3.1z" />
    </svg>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function sourceName(ebook: EBook): string | null {
  return (
    ebook.providerName ??
    ebook.books?.find((book) => book.source === "source")?.providerName ??
    null
  );
}

export function EBookWheelMenu({
  target,
  profile,
  onClose,
  onOpenDetails,
  onStartReading,
}: {
  target: EBookWheelTarget;
  profile: string;
  onClose: () => void;
  onOpenDetails: (ebook: EBook) => void;
  onStartReading: (ebook: EBook) => void;
}) {
  const { ebook } = target;
  const t = useT();
  const { setView } = useView();
  const [mode, setMode] = useState<WheelMode>("wheel");
  const [onShelf, setOnShelf] = useState(() => ebookInLibrary(ebook.id));
  const [readLater, setReadLater] = useState(() => eBookIsReadLater(ebook.id));
  const totalLabel = (value: number | undefined, unit: "volume" | "chapter"): string => {
    if (!value) return unit === "volume" ? t("Volumes not reported") : t("Chapters not reported");
    if (unit === "volume") {
      return value === 1
        ? t("{count} volume", { count: value })
        : t("{count} volumes", { count: value });
    }
    return value === 1
      ? t("{count} chapter", { count: value })
      : t("{count} chapters", { count: value });
  };
  const [completed, setCompleted] = useState(
    () => getEBookTracking(ebook.id).status === "COMPLETED",
  );
  const [detailBook, setDetailBook] = useState<EBook>(ebook);
  const [stats, setStats] = useState<{ volumes: number; chapters: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exporting, setExporting] = useState<EBookExportFormat | null>(null);
  const firstAction = useRef<HTMLButtonElement>(null);
  const resume = loadEBookResume(profile, ebook.id);
  const viewportWidth = typeof window === "undefined" ? 1_280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const centerX = clamp(target.x, 190, viewportWidth - 190);
  const centerY = clamp(target.y, 190, viewportHeight - 190);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mode === "wheel") onClose();
        else setMode("wheel");
      }
    };
    window.addEventListener("keydown", onKey);
    firstAction.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  useEffect(() => {
    if (mode !== "details" || stats) return;
    const route = sourceRouteForEBook(ebook);
    if (!route) {
      setStats({ volumes: ebook.volumes ?? 0, chapters: ebook.chapters ?? 0 });
      return;
    }
    let active = true;
    setStatsLoading(true);
    void sourceEBookDetail(route)
      .then((detail) => {
        if (!active || !detail) return;
        setDetailBook({
          ...ebook,
          ...detail,
          authors: detail.authors.length ? detail.authors : ebook.authors,
          description: detail.description || ebook.description,
          genres: detail.genres.length ? detail.genres : ebook.genres,
          cover: detail.cover || ebook.cover,
          books: ebook.books ?? detail.books,
        });
      })
      .catch(() => {});
    void sourceEBookChapters(route)
      .then((chapters) => {
        if (!active) return;
        const volumes = new Set(chapters.map((chapter) => chapter.volume?.trim()).filter(Boolean));
        setStats({
          volumes: volumes.size || ebook.volumes || 0,
          chapters: chapters.length || ebook.chapters || 0,
        });
      })
      .catch(() => {
        if (active) setStats({ volumes: ebook.volumes ?? 0, chapters: ebook.chapters ?? 0 });
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ebook, mode, stats]);

  const markCompleted = async () => {
    const next = !completed;
    setCompleted(next);
    try {
      await saveEBookTracking(ebook, {
        status: next ? "COMPLETED" : "PLANNING",
        progress: next ? (ebook.chapters ?? getEBookTracking(ebook.id).progress) : 0,
        progressVolumes: next ? (ebook.volumes ?? getEBookTracking(ebook.id).progressVolumes) : 0,
      });
      emitListToast(next ? t("Marked as read") : t("Marked as unread"));
    } catch {
      emitListToast(t("Saved locally; AniList sync is pending"));
    }
    onClose();
  };

  const startExport = async (format: EBookExportFormat) => {
    if (exporting) return;
    setExporting(format);
    try {
      await enqueueEBookExport(ebook, format);
      emitListToast(t("{format} added to Downloads", { format: format.toUpperCase() }));
      onClose();
      setView("downloads");
    } catch (error) {
      emitListToast(error instanceof Error ? error.message : t("This eBook could not be exported"));
    } finally {
      setExporting(null);
    }
  };

  const actions = useMemo<WheelAction[]>(
    () => [
      {
        id: "read",
        label: resume ? t("Continue Reading") : t("Start Reading"),
        Icon: Play,
        onClick: () => {
          onStartReading(ebook);
          onClose();
        },
      },
      { id: "details", label: t("Book Details"), Icon: Info, onClick: () => setMode("details") },
      { id: "download", label: t("Download"), Icon: Download, onClick: () => setMode("download") },
      {
        id: "shelf",
        label: onShelf ? t("On Shelf") : t("Add to Shelf"),
        Icon: ShelfBooksIcon,
        active: onShelf,
        onClick: () => {
          const next = toggleEBookLibrary(ebook);
          setOnShelf(next);
          emitListToast(next ? t("Added to Shelf") : t("Removed from Shelf"));
          onClose();
        },
      },
      {
        id: "bookmark",
        label: readLater ? t("Bookmarked") : t("Bookmark"),
        Icon: Bookmark,
        active: readLater,
        onClick: () => {
          const next = toggleEBookReadLater(ebook);
          setReadLater(next);
          emitListToast(next ? t("Bookmarked to read later") : t("Bookmark removed"));
          onClose();
        },
      },
      {
        id: "watched",
        label: completed ? t("Marked as read") : t("Mark as Read"),
        Icon: completed ? Check : Eye,
        active: completed,
        onClick: () => void markCompleted(),
      },
    ],
    [completed, ebook, onClose, onShelf, onStartReading, readLater, resume, t],
  );

  const node = (
    <div className="fixed inset-0 z-[220]" onContextMenu={(event) => event.preventDefault()}>
      <button
        type="button"
        aria-label={t("Close eBook menu")}
        className="absolute inset-0 cursor-default bg-canvas/55 backdrop-blur-[3px] animate-in fade-in duration-150"
        onMouseDown={onClose}
      />
      <div
        role="menu"
        aria-label={t("{title} actions", { title: ebook.title })}
        className="fixed h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 animate-in zoom-in-95 fade-in duration-200 motion-reduce:animate-none"
        style={{ left: centerX, top: centerY }}
      >
        <div className="absolute inset-[34px] rounded-full border border-edge-soft bg-[radial-gradient(circle_at_50%_42%,color-mix(in_oklch,var(--color-elevated),transparent_4%),color-mix(in_oklch,var(--color-canvas),transparent_6%)_68%)] shadow-[0_32px_90px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]" />
        <div className="absolute inset-[70px] rounded-full border border-edge-soft/60" />

        {actions.map((action, index) => {
          const angle = -90 + index * 60;
          const radians = (angle * Math.PI) / 180;
          const left = 50 + Math.cos(radians) * 39;
          const top = 50 + Math.sin(radians) * 39;
          return (
            <button
              key={action.id}
              ref={index === 0 ? firstAction : undefined}
              type="button"
              role="menuitem"
              onClick={action.onClick}
              className="group absolute flex w-[116px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 outline-none"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <span
                className={`grid h-14 w-14 place-items-center rounded-full border shadow-[0_10px_28px_-14px_rgba(0,0,0,0.9)] transition-all duration-200 group-hover:-translate-y-1 group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-accent group-active:scale-95 ${
                  action.active
                    ? "border-accent/50 bg-accent text-canvas"
                    : "border-edge bg-elevated text-ink-muted group-hover:border-edge-strong group-hover:bg-raised group-hover:text-ink"
                }`}
              >
                <action.Icon size={21} strokeWidth={2.1} />
              </span>
              <span className="max-w-[116px] text-center text-[11.5px] font-semibold leading-tight text-ink-muted transition-colors group-hover:text-ink">
                {action.label}
              </span>
            </button>
          );
        })}

        <div className="absolute left-1/2 top-1/2 grid h-[142px] w-[142px] -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full border border-edge bg-elevated shadow-[0_22px_55px_-22px_rgba(0,0,0,0.9)]">
          <div className="absolute inset-0">
            {ebook.cover ? (
              <img
                src={ebook.cover}
                alt=""
                className="h-full w-full object-cover opacity-35 blur-[1px]"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-accent/20 to-raised" />
            )}
            <div className="absolute inset-0 bg-canvas/65" />
          </div>
          <div className="relative flex max-w-[118px] flex-col items-center gap-1 text-center">
            <BookOpen size={22} className="mb-1 text-accent" />
            <span className="line-clamp-2 text-[12px] font-bold leading-tight text-ink">
              {ebook.title}
            </span>
            <span className="text-[9.5px] uppercase tracking-[0.13em] text-ink-subtle">
              {t("eBook actions")}
            </span>
          </div>
        </div>

        {mode !== "wheel" && (
          <div className="absolute left-1/2 top-1/2 z-20 w-[354px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[26px] border border-edge bg-elevated/98 shadow-[0_35px_95px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl animate-in zoom-in-95 fade-in duration-150">
            <div className="flex items-center justify-between border-b border-edge-soft px-5 py-4">
              <button
                type="button"
                onClick={() => setMode("wheel")}
                className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                aria-label={t("Back to eBook actions")}
              >
                <ChevronLeft size={19} />
              </button>
              <span className="text-[12px] font-semibold uppercase tracking-[0.13em] text-ink-subtle">
                {mode === "details" ? t("Book Details") : t("Offline Reading")}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                aria-label={t("Close")}
              >
                <X size={18} />
              </button>
            </div>
            {mode === "details" ? (
              <div className="p-5">
                <div className="mb-4 flex gap-4">
                  <div className="h-[112px] w-[76px] shrink-0 overflow-hidden rounded-lg bg-raised ring-1 ring-edge-soft">
                    {detailBook.cover ? (
                      <img src={detailBook.cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center">
                        <BookOpen className="text-ink-subtle" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 py-1">
                    <h3 className="line-clamp-2 text-[17px] font-semibold leading-tight text-ink">
                      {detailBook.title}
                    </h3>
                    <p className="mt-1 truncate text-[12px] text-ink-muted">
                      {detailBook.authors.join(", ") || t("Unknown author")}
                    </p>
                    <p className="mt-3 text-[11px] text-ink-subtle">
                      {t("From {source}", { source: sourceName(detailBook) ?? t("Book metadata") })}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11.5px] font-medium text-ink-muted">
                      {statsLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <span>{totalLabel(stats?.volumes || ebook.volumes, "volume")}</span>
                          <span className="text-edge-strong">•</span>
                          <span>{totalLabel(stats?.chapters || ebook.chapters, "chapter")}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <p className="line-clamp-4 text-[12.5px] leading-relaxed text-ink-muted">
                  {detailBook.description || t("No story summary is available for this eBook.")}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {detailBook.genres.slice(0, 5).map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-raised px-2.5 py-1 text-[10.5px] text-ink-muted ring-1 ring-edge-soft"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOpenDetails(ebook);
                    onClose();
                  }}
                  className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[13px] font-bold text-canvas transition-transform hover:scale-[1.01] active:scale-[0.98]"
                >
                  <Info size={17} /> {t("Open full details")}
                </button>
              </div>
            ) : (
              <div className="p-5">
                <p className="mb-4 text-[12.5px] leading-relaxed text-ink-muted">
                  {t("Save every available chapter from {source} for offline reading.", {
                    source: sourceName(ebook) ?? t("Book metadata"),
                  })}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={!!exporting}
                    onClick={() => void startExport("epub")}
                    className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-edge-soft bg-canvas/55 text-ink transition-colors hover:border-accent/40 hover:bg-raised disabled:opacity-50"
                  >
                    {exporting === "epub" ? (
                      <Loader2 size={23} className="animate-spin text-accent" />
                    ) : (
                      <BookOpen size={23} className="text-accent" />
                    )}
                    <span className="text-[13px] font-semibold">EPUB</span>
                    <span className="text-[10.5px] text-ink-subtle">{t("Reflowable eBook")}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!!exporting}
                    onClick={() => void startExport("pdf")}
                    className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-edge-soft bg-canvas/55 text-ink transition-colors hover:border-accent/40 hover:bg-raised disabled:opacity-50"
                  >
                    {exporting === "pdf" ? (
                      <Loader2 size={23} className="animate-spin text-accent" />
                    ) : (
                      <FileText size={23} className="text-accent" />
                    )}
                    <span className="text-[13px] font-semibold">PDF</span>
                    <span className="text-[10.5px] text-ink-subtle">{t("Print or save")}</span>
                  </button>
                </div>
                <p className="mt-4 text-center text-[11px] text-ink-subtle">
                  {t("Progress, speed, remaining time, and cancellation are managed on Downloads.")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
