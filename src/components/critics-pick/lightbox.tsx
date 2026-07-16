import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

export function Lightbox({
  images,
  startIndex,
  title,
  onClose,
}: {
  images: string[];
  startIndex: number;
  title: string;
  onClose: () => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(startIndex);
  const total = images.length;

  const prev = useCallback(() => setIndex((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIndex((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-canvas/95 p-10"
      role="dialog"
      aria-modal="true"
      aria-label={t("{title} image viewer", { title })}
      data-tv-focus-scope
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClose();
      }}
      tabIndex={0}
    >
      <div
        className="absolute start-8 top-8 flex flex-col gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="font-display text-[18px] font-medium tracking-tight text-ink">{title}</span>
        <span className="text-[12px] uppercase tracking-[0.18em] text-ink-subtle">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={t("Close image viewer")}
        className="absolute end-8 top-8 flex h-12 w-12 items-center justify-center rounded-full border border-edge-soft bg-elevated/50 text-ink-muted transition-colors duration-200 hover:bg-elevated hover:text-ink"
      >
        <X size={22} />
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label={t("Previous image")}
            className="absolute start-8 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-edge-soft bg-elevated/50 text-ink-muted transition-colors duration-200 hover:bg-elevated hover:text-ink"
          >
            <ChevronLeft size={28} className="dir-icon" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label={t("Next image")}
            className="absolute end-8 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-edge-soft bg-elevated/50 text-ink-muted transition-colors duration-200 hover:bg-elevated hover:text-ink"
          >
            <ChevronRight size={28} className="dir-icon" />
          </button>
        </>
      )}
      <img
        key={images[index]}
        src={images[index]}
        alt={`${title} ${index + 1}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[86vh] max-w-[90vw] rounded-xl border border-edge-soft object-contain shadow-2xl"
      />
      {total > 1 && (
        <div
          className="absolute inset-x-0 bottom-8 flex justify-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t("Image {n}", { n: i + 1 })}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === index ? "w-7 bg-ink" : "w-1.5 bg-ink-subtle/40 hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
