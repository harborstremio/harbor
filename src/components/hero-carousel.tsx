import { useEffect, useRef, useState } from "react";
import { observe, usePageVisible } from "@/lib/visibility";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Hero } from "./hero";
import { NavChevron } from "@/components/nav-arrow";
import type { Meta } from "@/lib/cinemeta";

/** `rank` renders a "#N in … Today" trending pill; omit it where that framing
 * doesn't apply, such as the library hero. */
export type Slide = {
  meta: Meta;
  rank?: { label: string; position: number; sources?: Array<{ label: string; rank: number }> };
};

const EASE_OUT = "cubic-bezier(0.32, 0.72, 0.24, 1)";
const DRAG_BUDGE = 6;
const SNAP_RATIO = 0.18;
const FLICK_VELOCITY = 0.45;
const SLIDE_GAP_PX = 22;
const ROTATE_MS = 13000;
const BILLBOARD_ROTATE_MS = 22000;
const BILLBOARD_ENTER_SCALE = 1.045;

export function HeroCarousel({
  slides,
  full = false,
  fullQuality = false,
  playTrailers = false,
  billboard = false,
  bottomAlign = false,
  playSquare = false,
  moreInfo = false,
}: {
  slides: Slide[];
  full?: boolean;
  fullQuality?: boolean;
  playTrailers?: boolean;
  billboard?: boolean;
  bottomAlign?: boolean;
  playSquare?: boolean;
  moreInfo?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [inViewport, setInViewport] = useState(true);
  const pageVisible = usePageVisible();
  const { settings } = useSettings();
  const t = useT();
  const rtl = isRtl(useUiLanguage());
  const reduce = useReducedMotion();

  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    return observe(el, setInViewport);
  }, []);

  useEffect(() => {
    for (const s of slides) {
      const logo = s.meta.logo;
      if (logo) {
        const img = new Image();
        img.src = logo;
      }
    }
  }, [slides]);
  const startX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const moved = useRef(false);
  const widthRef = useRef(0);
  const downRef = useRef(false);

  useEffect(() => {
    if (paused || dragging || !inViewport || !pageVisible || slides.length < 2) return;
    if (settings.heroTrailerAudio) return;
    const id = setInterval(
      () => setActive((a) => (a + 1) % slides.length),
      billboard ? BILLBOARD_ROTATE_MS : ROTATE_MS,
    );
    return () => clearInterval(id);
  }, [
    paused,
    dragging,
    inViewport,
    pageVisible,
    slides.length,
    settings.heroTrailerAudio,
    billboard,
  ]);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [slides.length, active]);

  const safeActive = slides.length > 0 ? Math.min(Math.max(active, 0), slides.length - 1) : 0;

  if (slides.length === 0) {
    return (
      <div
        className={`harbor-hero-stage animate-pulse border border-edge-soft bg-elevated/30 ${full ? "min-h-[max(78vh,640px)] rounded-none" : "min-h-[560px] rounded-2xl"}`}
      />
    );
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (slides.length < 2) return;
    if (
      e.target instanceof Element &&
      e.target.closest("button, a, input, select, textarea, [role='button']")
    ) {
      downRef.current = false;
      moved.current = false;
      return;
    }
    widthRef.current = viewportRef.current?.clientWidth ?? 1000;
    downRef.current = true;
    moved.current = false;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!downRef.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > DRAG_BUDGE && !moved.current) {
      moved.current = true;
      setDragging(true);
      try {
        viewportRef.current?.setPointerCapture(e.pointerId);
      } catch {}
    }
    const now = performance.now();
    const dt = now - lastT.current;
    if (dt > 0) {
      const inst = (e.clientX - lastX.current) / dt;
      velocity.current = velocity.current * 0.6 + inst * 0.4;
    }
    lastX.current = e.clientX;
    lastT.current = now;
    if (!moved.current) return;

    const W = widthRef.current || 1000;
    let next = dx;
    if (active === 0 && dx > 0) next = rubberBand(dx, W);
    else if (active === slides.length - 1 && dx < 0) next = -rubberBand(-dx, W);
    setOffset(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!downRef.current) return;
    downRef.current = false;
    try {
      if (viewportRef.current?.hasPointerCapture?.(e.pointerId)) {
        viewportRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
    if (!moved.current) {
      setDragging(false);
      return;
    }
    setDragging(false);
    const W = widthRef.current || 1000;
    const distance = offset;
    const threshold = W * SNAP_RATIO;
    const v = velocity.current;
    const wantNext = (distance < -threshold || v < -FLICK_VELOCITY) && active < slides.length - 1;
    const wantPrev = (distance > threshold || v > FLICK_VELOCITY) && active > 0;
    if (wantNext) setActive(active + 1);
    else if (wantPrev) setActive(active - 1);
    setOffset(0);
    setTimeout(() => {
      moved.current = false;
    }, 0);
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target instanceof Element &&
      e.target.closest("button, a, input, select, textarea, [role='button']")
    ) {
      return;
    }
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const trackTransform = `translate3d(calc(${-safeActive * 100}% + ${offset - safeActive * SLIDE_GAP_PX}px), 0, 0)`;

  const slideStyle = (isActive: boolean, distance: number): React.CSSProperties => {
    if (!billboard) {
      return {
        opacity: dragging ? 1 : isActive ? 1 : 0.42,
        transition: dragging ? "none" : `opacity 700ms ${EASE_OUT}`,
        pointerEvents: isActive ? "auto" : "none",
        zIndex: 10 - distance,
      };
    }
    if (reduce) {
      return {
        opacity: isActive ? 1 : 0,
        transition: "opacity 200ms linear",
        pointerEvents: isActive ? "auto" : "none",
        zIndex: isActive ? 10 : 9,
      };
    }
    return {
      opacity: isActive ? 1 : 0,
      transform: isActive ? "scale(1)" : `scale(${BILLBOARD_ENTER_SCALE})`,
      transformOrigin: "center 42%",
      transition:
        "opacity var(--tv-dur-billboard, 640ms) linear, transform var(--tv-dur-billboard-settle, 900ms) var(--tv-ease-settle, cubic-bezier(0.3,0.45,0.2,1))",
      pointerEvents: isActive ? "auto" : "none",
      zIndex: isActive ? 10 : 9,
    };
  };

  return (
    <div
      className={full ? "relative" : "flex flex-col gap-5"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={viewportRef}
        dir="ltr"
        onPointerDown={billboard ? undefined : onPointerDown}
        onPointerMove={billboard ? undefined : onPointerMove}
        onPointerUp={billboard ? undefined : endDrag}
        onPointerCancel={billboard ? undefined : endDrag}
        onClickCapture={billboard ? undefined : onClickCapture}
        className={`group relative overflow-hidden ${full ? "rounded-none" : "rounded-2xl"} ${
          billboard ? "" : dragging ? "cursor-grabbing" : "cursor-grab"
        } select-none`}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className={billboard ? "grid" : "flex"}
          dir="ltr"
          style={
            billboard
              ? undefined
              : {
                  gap: `${SLIDE_GAP_PX}px`,
                  transform: trackTransform,
                  transition: dragging ? "none" : `transform 720ms ${EASE_OUT}`,
                  willChange: dragging ? "transform" : "auto",
                }
          }
        >
          {slides.map((s, i) => {
            const isActive = i === safeActive;
            const distance = Math.abs(i - safeActive);
            const shouldMount = distance <= 1 || dragging;
            return (
              <div
                key={`${s.meta.id}-${i}`}
                dir={rtl ? "rtl" : "ltr"}
                aria-hidden={!isActive}
                className={`w-full shrink-0 ${billboard ? "[grid-area:1/1]" : ""}`}
                style={slideStyle(isActive, distance)}
              >
                {shouldMount ? (
                  <Hero
                    meta={s.meta}
                    rank={s.rank}
                    active={isActive}
                    loadBackdrop={distance <= 1}
                    full={full}
                    fullQuality={fullQuality}
                    playTrailer={playTrailers && isActive && !dragging}
                    bottomAlign={bottomAlign}
                    playSquare={playSquare}
                    moreInfo={moreInfo}
                  />
                ) : (
                  <div
                    className={`harbor-hero-stage w-full bg-elevated/30 ${full ? "h-[78vh] min-h-[640px] rounded-none" : "h-[560px] rounded-2xl"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((a) => (a - 1 + slides.length) % slides.length)}
              aria-label={t("Previous")}
              className="group/hl absolute inset-y-0 start-0 z-30 my-auto flex h-14 w-14 items-center justify-center"
            >
              <NavChevron
                dir="left"
                size={40}
                className="text-white/90 opacity-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] transition-all duration-200 group-hover/hl:opacity-100 group-active/hl:scale-90"
              />
            </button>
            <button
              type="button"
              onClick={() => setActive((a) => (a + 1) % slides.length)}
              aria-label={t("Next")}
              className="group/hr absolute inset-y-0 end-0 z-30 my-auto flex h-14 w-14 items-center justify-center"
            >
              <NavChevron
                dir="right"
                size={40}
                className="text-white/90 opacity-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] transition-all duration-200 group-hover/hr:opacity-100 group-active/hr:scale-90"
              />
            </button>
          </>
        )}
      </div>
      {slides.length > 1 && (
        <div
          className={`flex justify-center gap-2.5 ${full ? "absolute bottom-4 inset-x-0" : "pt-1"}`}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={t("Slide {n}", { n: i + 1 })}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === safeActive ? "w-12 bg-ink" : "w-6 bg-ink-muted/70 hover:bg-ink-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function rubberBand(distance: number, dim: number, c = 0.55): number {
  return (1 - 1 / (distance / dim / c + 1)) * dim * c;
}
