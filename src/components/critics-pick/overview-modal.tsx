import { ChevronLeft, ChevronRight, ExternalLink, Quote, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import type { CriticReview } from "@/lib/providers/tmdb";
import { openUrl } from "@/lib/window";
import { LinkedReview } from "./linked-review";
import type { PersonRef } from "./types";
import { formatReviewDate } from "./utils";

export function OverviewModal({
  title,
  tagline,
  overview,
  review,
  people,
  poster,
  onClose,
  onOpenTitle,
  onPersonClick,
  reviewCount,
  reviewIndex,
  onNavReview,
}: {
  title: string;
  tagline?: string;
  overview: string;
  review: CriticReview | null;
  people: PersonRef[];
  poster?: string | null;
  onClose: () => void;
  onOpenTitle?: () => void;
  onPersonClick: (id: number) => void;
  reviewCount?: number;
  reviewIndex?: number;
  onNavReview?: (dir: 1 | -1) => void;
}) {
  const t = useT();
  const contentRef = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState<1 | -1>(1);

  const nav = (d: 1 | -1) => {
    setDir(d);
    onNavReview?.(d);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (!onNavReview || !reviewCount || reviewCount < 2) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nav(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nav(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onNavReview, reviewCount]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [reviewIndex]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const canOpenTitle = !!poster && !!onOpenTitle;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("{title} overview", { title })}
      onClick={onClose}
      className="critics-backdrop-in fixed inset-0 z-[170] flex items-center justify-center bg-canvas/85 p-8 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="critics-modal-in relative flex max-h-[80vh] w-full max-w-[640px] flex-col gap-5 overflow-hidden rounded-2xl border border-edge-soft bg-surface p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close overview")}
          className="absolute end-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-[background-color,color,transform] duration-150 hover:bg-elevated hover:text-ink active:scale-90"
        >
          <X size={18} />
        </button>
        <div className="flex items-start gap-4 pe-10">
          {poster &&
            (canOpenTitle ? (
              <button
                type="button"
                onClick={onOpenTitle}
                aria-label={t("Open {title}", { title })}
                className="group/poster relative shrink-0 overflow-hidden rounded-lg ring-1 ring-edge-soft transition-transform duration-200 hover:-translate-y-0.5 hover:ring-accent/50 active:scale-95"
              >
                <img
                  src={poster}
                  alt=""
                  decoding="async"
                  className="h-[84px] w-[56px] object-cover transition-transform duration-300 group-hover/poster:scale-[1.06]"
                />
                <span className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-200 group-hover/poster:bg-ink/10" />
              </button>
            ) : (
              <img
                src={poster}
                alt=""
                decoding="async"
                className="h-[84px] w-[56px] shrink-0 rounded-lg object-cover ring-1 ring-edge-soft"
              />
            ))}
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11.5px] uppercase tracking-[0.2em] text-ink-subtle">
              {review ? t("Reader review") : t("Synopsis")}
            </span>
            {canOpenTitle ? (
              <button
                type="button"
                onClick={onOpenTitle}
                className="text-start font-display text-[24px] font-medium leading-tight tracking-tight text-ink transition-colors duration-150 hover:text-accent"
              >
                {title}
              </button>
            ) : (
              <h3 className="font-display text-[24px] font-medium leading-tight tracking-tight text-ink">
                {title}
              </h3>
            )}
          </div>
        </div>
        {review ? (
          <>
            <Quote size={22} className="shrink-0 text-accent" />
            <div
              ref={contentRef}
              key={reviewIndex}
              data-dir={dir}
              className="critics-review-in flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pe-2"
            >
              <p className="font-display text-[15px] leading-[1.65] text-ink/90 whitespace-pre-wrap">
                <LinkedReview text={review.content} people={people} onPersonClick={onPersonClick} />
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-edge-soft pt-3 text-[12px] text-ink-muted">
              <span className="flex items-center gap-2">
                <span className="font-medium text-ink">{review.author}</span>
                {typeof review.rating === "number" && review.rating > 0 && (
                  <span className="text-ink-subtle">· {review.rating}/10</span>
                )}
                {review.createdAt && (
                  <span className="text-ink-subtle">· {formatReviewDate(review.createdAt)}</span>
                )}
              </span>
              <div className="flex shrink-0 items-center gap-2.5">
                {!!reviewCount && reviewCount > 1 && onNavReview && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => nav(-1)}
                      aria-label={t("Previous review")}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-[background-color,color,transform] duration-150 hover:bg-elevated hover:text-ink active:scale-90"
                    >
                      <ChevronLeft size={15} strokeWidth={2.2} className="dir-icon" />
                    </button>
                    <span className="min-w-[2.75rem] text-center text-[11.5px] tabular-nums text-ink-subtle">
                      {(reviewIndex ?? 0) + 1} / {reviewCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => nav(1)}
                      aria-label={t("Next review")}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-[background-color,color,transform] duration-150 hover:bg-elevated hover:text-ink active:scale-90"
                    >
                      <ChevronRight size={15} strokeWidth={2.2} className="dir-icon" />
                    </button>
                  </div>
                )}
                {review.url && (
                  <button
                    type="button"
                    onClick={() => openUrl(review.url!)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-edge px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted transition-[background-color,color,transform] duration-150 hover:bg-elevated hover:text-ink active:scale-95"
                  >
                    {t("Source")} <ExternalLink size={11} strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {tagline && (
              <>
                <Quote size={22} className="shrink-0 text-accent" />
                <p className="font-display text-[16px] italic leading-[1.55] text-ink/90">{tagline}</p>
              </>
            )}
            <p className="overflow-y-auto pe-2 text-[14px] leading-[1.65] text-ink-muted">
              <LinkedReview text={overview} people={people} onPersonClick={onPersonClick} />
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
