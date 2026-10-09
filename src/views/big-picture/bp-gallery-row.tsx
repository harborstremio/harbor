import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SFX } from "@/lib/sfx";
import { bpBoxCss, bpBoxPx, bpCardArt, bpHeroArt, type BpArtBox } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { pushBpBack } from "./bp-back";
import { bpOverscan } from "./bp-safe-area";
import { BP_DETAIL_HEADING, BP_DETAIL_TRACK_TIGHT } from "./detail/bp-detail-chrome";

export type BpGalleryShape = "wide" | "tall" | "logo";

type Shape = BpGalleryShape;

// The CSS width and the number handed to bpCardArt come from one record, the
// rule bp-art states: edit the clamp, forget the request, and the cell asks for
// a size it stopped drawing. buildGallery hands these over at w780, w342 and
// w500 for cells that resolve to 228, 112 and 178 on a television, so the
// backdrop strip alone was decoding 2.4x the pixels it can paint, 24 times.
const BOX: Record<Shape, BpArtBox> = {
  wide: { min: 228, vw: 19, max: 372 },
  tall: { min: 112, vw: 9, max: 172 },
  logo: { min: 178, vw: 15, max: 290 },
};

const RATIO: Record<Shape, string> = {
  wide: "16 / 9",
  tall: "2 / 3",
  logo: "16 / 9",
};

// A clear logo is transparent artwork with its own margins. object-cover crops
// the wordmark; it has to sit inside the cell, not fill it.
const FIT: Record<Shape, string> = {
  wide: "object-cover",
  tall: "object-cover",
  logo: "object-contain p-[clamp(12px,1.2vw,26px)]",
};

function BpGalleryLightbox({
  images,
  index,
  shape,
  onClose,
  onStep,
}: {
  images: string[];
  index: number;
  shape: Shape;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  useEffect(
    () =>
      pushBpBack(() => {
        SFX.close();
        onClose();
        return true;
      }),
    [onClose],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        SFX.close();
        onClose();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onStep(e.key === "ArrowRight" ? 1 : -1);
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, onStep]);

  return createPortal(
    // Overlay, not dialog: this surface owns every arrow itself, and it holds no
    // focusable cell for the engine to move between.
    //
    // data-bp-root on the portal, the way bp-player-shell and the crash surface
    // spell it. This mounts on document.body as a SIBLING of the shell's root,
    // so every var(--bp-*) below resolved to nothing: the full-bleed scrim was
    // transparent and a poster or a clear logo sat in the middle of the live
    // detail page, and the animation shorthands were invalid outright.
    <div
      data-bp-root
      data-bp-overlay
      style={{ "--bp-overscan": String(bpOverscan()) } as CSSProperties}
      className="fixed inset-0 z-[960] flex items-center justify-center bg-[var(--bp-void)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      onClick={onClose}
    >
      {/* The strip cells ask for a cell-sized file, so the lightbox has to ask
          again at hero size or a full-bleed still is the 500px thumbnail. */}
      <img
        key={images[index]}
        src={bpHeroArt(images[index], shape === "tall" ? "portrait" : "wide")}
        alt=""
        decoding="async"
        className="h-full w-full object-contain [animation:bp-enter_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      />
      {/* The step has to be said. This overlay swallows every arrow itself, so
          the hint bar behind it is describing keys that no longer do what it
          claims, and a full-bleed still with a bare counter floating in it looks
          like a dead end. The glyphs are physical-key mapping, not reading
          order, so they do not flip under rtl. */}
      <span className="pointer-events-none absolute bottom-[calc(clamp(16px,2.4vh,34px)_+_var(--bp-safe-y,0px))] left-1/2 flex -translate-x-1/2 items-center gap-[clamp(8px,0.8vw,15px)] rounded-full bg-[var(--bp-void)]/80 px-[clamp(12px,1.1vw,20px)] py-[clamp(5px,0.6vh,9px)] text-[clamp(11px,1.5vh,17px)] font-semibold tabular-nums text-ink-muted ring-1 ring-[var(--bp-edge-2)]">
        <ChevronLeft
          size={19}
          strokeWidth={2.4}
          className={images.length > 1 ? "" : "opacity-25"}
        />
        {index + 1} / {images.length}
        <ChevronRight
          size={19}
          strokeWidth={2.4}
          className={images.length > 1 ? "" : "opacity-25"}
        />
      </span>
    </div>,
    document.body,
  );
}

export function BpGalleryRow({
  title,
  images,
  shape = "wide",
  rowKey,
}: {
  title: string;
  images: string[];
  shape?: Shape;
  rowKey?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const box = BOX[shape];
  const cellPx = bpBoxPx(box);

  const step = useCallback(
    (delta: number) =>
      setOpen((cur) => (cur === null ? cur : (cur + delta + images.length) % images.length)),
    [images.length],
  );

  if (images.length === 0) return null;

  return (
    <section data-bp-row data-bp-row-key={rowKey ?? `gallery:${shape}`} className="relative">
      <h2 className={BP_DETAIL_HEADING}>{title}</h2>
      <div data-bp-scroll-x className={BP_DETAIL_TRACK_TIGHT}>
        {images.slice(0, 24).map((src, i) => (
          <button
            key={src}
            type="button"
            data-bp-focusable
            data-bp-tile
            data-bp-restore-key={`bp-gallery:${i}`}
            onClick={() => {
              SFX.open();
              setOpen(i);
            }}
            aria-label={`${title} ${i + 1}`}
            className="relative shrink-0 overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
            style={{ width: bpBoxCss(box), aspectRatio: RATIO[shape] }}
          >
            <BpArt src={bpCardArt(src, cellPx)} className={FIT[shape]} />
          </button>
        ))}
      </div>
      {open !== null && (
        <BpGalleryLightbox
          images={images.slice(0, 24)}
          index={open}
          shape={shape}
          onClose={() => setOpen(null)}
          onStep={step}
        />
      )}
    </section>
  );
}
