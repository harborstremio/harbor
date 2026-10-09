import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ImagePlus, X } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { t } from "@/lib/i18n";

export function MediaLightbox({
  images,
  index,
  onClose,
  onDownload,
  onSetBackdrop,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onDownload?: (url: string, index: number) => void;
  onSetBackdrop?: (url: string) => void;
}) {
  const [i, setI] = useState(index);
  const [open, setOpen] = useState(false);

  const go = useCallback(
    (dir: -1 | 1) => setI((p) => (p + dir + images.length) % images.length),
    [images.length],
  );

  useEffect(() => {
    const r = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  const multi = images.length > 1;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[120] flex cursor-zoom-out items-center justify-center"
      style={{
        backgroundColor: open ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0)",
        backdropFilter: open ? "blur(28px) saturate(1.15)" : "blur(0px)",
        WebkitBackdropFilter: open ? "blur(28px) saturate(1.15)" : "blur(0px)",
        transition:
          "background-color 320ms cubic-bezier(0.32,0.72,0.24,1), backdrop-filter 320ms cubic-bezier(0.32,0.72,0.24,1)",
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label={t("Close")}
        className="absolute end-7 top-16 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-colors hover:bg-canvas active:scale-[0.94]"
      >
        <X size={18} strokeWidth={2.4} />
      </button>

      {(onDownload || onSetBackdrop) && (
        <div className="absolute start-7 top-16 z-10 flex items-center gap-2">
          {onSetBackdrop && (
            <HoverTooltip label={t("Set as theme backdrop")} align="center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetBackdrop(images[i]);
                }}
                aria-label={t("Set as theme backdrop")}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-colors hover:bg-canvas active:scale-[0.94]"
              >
                <ImagePlus size={18} strokeWidth={2.2} />
              </button>
            </HoverTooltip>
          )}
          {onDownload && (
            <HoverTooltip label={t("Download")} align="center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload(images[i], i);
                }}
                aria-label={t("Download")}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas/90 text-ink shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition-colors hover:bg-canvas active:scale-[0.94]"
              >
                <Download size={18} strokeWidth={2.2} />
              </button>
            </HoverTooltip>
          )}
        </div>
      )}

      {multi && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          aria-label={t("Previous")}
          className="absolute start-7 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/85 text-ink backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronLeft size={24} strokeWidth={2.2} className="dir-icon" />
        </button>
      )}

      <img
        key={i}
        src={images[i]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[82vh] max-w-[88vw] cursor-default rounded-2xl object-contain shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.94)",
          transition: "opacity 280ms ease, transform 360ms cubic-bezier(0.32,0.72,0.24,1)",
        }}
      />

      {multi && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          aria-label={t("Next")}
          className="absolute end-7 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/85 text-ink backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        >
          <ChevronRight size={24} strokeWidth={2.2} className="dir-icon" />
        </button>
      )}

      {multi && (
        <span className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 select-none text-[11px] font-medium uppercase tracking-[0.18em] text-ink/45">
          {i + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
