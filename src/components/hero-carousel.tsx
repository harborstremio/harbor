import { useEffect, useRef, useState } from "react";
import { observe, usePageVisible } from "@/lib/visibility";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { Hero } from "./hero";
import type { Meta } from "@/lib/cinemeta";

export type Slide = { meta: Meta; rank: { label: string; position: number } };

const EASE_OUT = "cubic-bezier(0.32, 0.72, 0.24, 1)";
const DRAG_BUDGE = 6;
const SNAP_RATIO = 0.18;
const FLICK_VELOCITY = 0.45;
const SLIDE_GAP_PX = 22;

export function HeroCarousel({
  slides,
  full = false,
  fullQuality = false,
}: {
  slides: Slide[];
  full?: boolean;
  fullQuality?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);
  const [inViewport, setInViewport] = useState(true);
  const pageVisible = usePageVisible();
  const t = useT();
  const rtl = isRtl(useUiLanguage());

  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    return observe(el, setInViewport);
  }, []);
  const startX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const velocity = useRef(0);
  const moved = useRef(false);
  const widthRef = useRef(0);

  useEffect(() => {
    if (paused || dragging || !inViewport || !pageVisible || slides.length < 2)
      return;
    const id = setInterval(
      () => setActive((a) => (a + 1) % slides.length),
      13000,
    );
    return () => clearInterval(id);
  }, [paused, dragging, inViewport, pageVisible, slides.length]);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [slides.length, active]);

  if (slides.length === 0) {
    return (
      <div
        className={`animate-pulse border border-edge-soft bg-elevated/30 ${full ? "min-h-[clamp(560px,82vh,920px)] rounded-none" : "min-h-[560px] rounded-[28px]"}`}
      />
    );
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (slides.length < 2) return;
    widthRef.current = viewportRef.current?.clientWidth ?? 1000;
    setDragging(true);
    moved.current = false;
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    velocity.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > DRAG_BUDGE) {
      if (!moved.current) {
        try {
          viewportRef.current?.setPointerCapture(e.pointerId);
        } catch {}
      }
      moved.current = true;
    }
    const now = performance.now();
    const dt = now - lastT.current;
    if (dt > 0) {
      const inst = (e.clientX - lastX.current) / dt;
      velocity.current = velocity.current * 0.6 + inst * 0.4;
    }
    lastX.current = e.clientX;
    lastT.current = now;

    const W = widthRef.current || 1000;
    let next = dx;
    if (active === 0 && dx > 0) next = rubberBand(dx, W);
    else if (active === slides.length - 1 && dx < 0) next = -rubberBand(-dx, W);
    setOffset(next);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    try {
      if (viewportRef.current?.hasPointerCapture?.(e.pointerId)) {
        viewportRef.current.releasePointerCapture(e.pointerId);
      }
    } catch {}
    setDragging(false);
    const W = widthRef.current || 1000;
    const distance = offset;
    const threshold = W * SNAP_RATIO;
    const v = velocity.current;
    const wantNext =
      (distance < -threshold || v < -FLICK_VELOCITY) &&
      active < slides.length - 1;
    const wantPrev = (distance > threshold || v > FLICK_VELOCITY) && active > 0;
    if (wantNext) setActive(active + 1);
    else if (wantPrev) setActive(active - 1);
    setOffset(0);
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (moved.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const trackTransform = `translate3d(calc(${-active * 100}% + ${offset - active * SLIDE_GAP_PX}px), 0, 0)`;

  return (
    <div
      className="flex flex-col gap-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={viewportRef}
        dir="ltr"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className={`relative overflow-hidden ${full ? "rounded-none" : "rounded-[28px]"} ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        } select-none`}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex"
          dir="ltr"
          style={{
            gap: `${SLIDE_GAP_PX}px`,
            transform: trackTransform,
            transition: dragging ? "none" : `transform 720ms ${EASE_OUT}`,
            willChange: "transform",
          }}
        >
          {slides.map((s, i) => {
            const isActive = i === active;
            const distance = Math.abs(i - active);
            const shouldMount = distance <= 1 || dragging;
            return (
              <div
                key={`${s.meta.id}-${i}`}
                dir={rtl ? "rtl" : "ltr"}
                aria-hidden={!isActive}
                className="w-full shrink-0"
                style={{
                  opacity: dragging ? 1 : isActive ? 1 : 0.42,
                  transition: dragging ? "none" : `opacity 700ms ${EASE_OUT}`,
                  pointerEvents: isActive ? "auto" : "none",
                  zIndex: 10 - distance,
                }}
              >
                {shouldMount ? (
                  <Hero
                    meta={s.meta}
                    rank={s.rank}
                    active={isActive}
                    loadBackdrop={distance === 0}
                    full={full}
                    fullQuality={fullQuality}
                  />
                ) : (
                  <div
                    className={`w-full bg-elevated/30 ${full ? "h-[clamp(560px,82vh,920px)] rounded-none" : "h-[560px] rounded-[28px]"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="flex justify-center gap-2.5 pt-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={t("Slide {n}", { n: i + 1 })}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active
                  ? "w-12 bg-ink"
                  : "w-6 bg-ink-muted/70 hover:bg-ink-muted"
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
