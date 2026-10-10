import { useCallback, useEffect, useRef, useState } from "react";
import { NavChevron } from "@/components/nav-arrow";
import { useT } from "@/lib/i18n";

const GAP = 16;

export function MediaRail({ children, min = 300 }: { children: React.ReactNode; min?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [cellWidth, setCellWidth] = useState<number | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const isRtl = (el: HTMLDivElement) => getComputedStyle(el).direction === "rtl";
  const readPos = (el: HTMLDivElement) => (isRtl(el) ? -el.scrollLeft : el.scrollLeft);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (el) {
      const pos = readPos(el);
      setCanPrev(pos > 1);
      setCanNext(el.scrollWidth - el.clientWidth - pos > 1);
    }
    const c = containerRef.current;
    if (c && c.clientWidth > 0) {
      const fits = Math.max(1, Math.floor((c.clientWidth + GAP) / (min + GAP)));
      setCellWidth((c.clientWidth - (fits - 1) * GAP) / fits);
    }
  }, [min]);

  useEffect(() => {
    const el = trackRef.current;
    const c = containerRef.current;
    if (!el || !c) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure, children]);

  const rafId = useRef<number | null>(null);
  const cancelGlide = () => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  const glideTo = (el: HTMLDivElement, target: number) => {
    const rtl = isRtl(el);
    const start = rtl ? -el.scrollLeft : el.scrollLeft;
    const distance = target - start;
    if (Math.abs(distance) < 2) {
      el.style.scrollSnapType = "";
      return;
    }
    const startTime = performance.now();
    const duration = Math.max(260, Math.min(600, 240 + Math.abs(distance) * 0.45));
    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = start + distance * eased;
      el.scrollLeft = rtl ? -next : next;
      if (p < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        rafId.current = null;
        el.style.scrollSnapType = "";
      }
    };
    rafId.current = requestAnimationFrame(tick);
  };

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    cancelGlide();
    el.scrollBy({ left: (isRtl(el) ? -dir : dir) * el.clientWidth, behavior: "smooth" });
  };

  const drag = useRef({
    active: false,
    moved: false,
    startX: 0,
    startScroll: 0,
    pointerId: -1,
    lastX: 0,
    lastT: 0,
    vel: 0,
  });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    if (!(e.target as Element).closest("button")) return;
    const el = trackRef.current;
    if (!el) return;
    cancelGlide();
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastT: performance.now(),
      vel: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      try {
        el.setPointerCapture(d.pointerId);
      } catch {}
    }
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) {
      const instant = (e.clientX - d.lastX) / dt;
      d.vel = d.vel * 0.55 + instant * 0.45;
    }
    d.lastX = e.clientX;
    d.lastT = now;
    el.scrollLeft = d.startScroll - dx;
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    d.active = false;
    if (!d.moved || !el) {
      setTimeout(() => {
        drag.current.moved = false;
      }, 0);
      return;
    }
    try {
      if (e) el.releasePointerCapture(d.pointerId);
    } catch {}
    el.style.scrollBehavior = "";
    const friction = 0.004;
    const projection = -((d.vel * Math.abs(d.vel)) / (2 * friction));
    const projectedRaw = el.scrollLeft + projection;
    const projected = isRtl(el) ? -projectedRaw : projectedRaw;
    const max = el.scrollWidth - el.clientWidth;
    const stride = (cellWidth ?? min) + GAP;
    const aligned = Math.round(projected / stride) * stride;
    const target = max - projected < stride * 0.5 ? max : Math.max(0, Math.min(aligned, max));
    glideTo(el, target);
    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div ref={containerRef} className="group/rail relative min-w-0">
      <div
        ref={trackRef}
        data-tauri-drag-region="false"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className="grid grid-flow-col items-start gap-4 overflow-x-auto p-5 -m-5 scroll-ps-5 scroll-pe-5 [scroll-snap-type:x_proximity] [&>*]:[scroll-snap-align:start] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_img]:select-none [&_img]:[-webkit-user-drag:none]"
        style={{ gridAutoColumns: cellWidth != null ? `${cellWidth}px` : `${min}px` }}
      >
        {children}
      </div>
      <RailArrow side="start" visible={canPrev} onClick={() => scroll(-1)} />
      <RailArrow side="end" visible={canNext} onClick={() => scroll(1)} />
    </div>
  );
}

function RailArrow({ side, visible, onClick }: { side: "start" | "end"; visible: boolean; onClick: () => void }) {
  const t = useT();
  const isStart = side === "start";
  const label = t(isStart ? "Scroll left" : "Scroll right");
  const enter = isStart ? "-translate-x-2.5" : "translate-x-2.5";
  const chev = !visible
    ? "opacity-0"
    : `opacity-0 ${enter} scale-[0.6] group-hover/edge:opacity-100 group-hover/edge:translate-x-0 group-hover/edge:scale-100 group-focus-visible/edge:opacity-100 group-focus-visible/edge:translate-x-0 group-focus-visible/edge:scale-100`;
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-30 flex w-16 items-center ${
        isStart ? "start-[-48px] justify-start" : "end-[-48px] justify-end"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        tabIndex={visible ? 0 : -1}
        className={`group/edge grid h-full w-full place-items-center ${
          visible ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <span
          className={`grid place-items-center text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] transition-all duration-[320ms] ease-[cubic-bezier(0.34,1.45,0.5,1)] group-active/edge:scale-90 ${chev}`}
        >
          <NavChevron dir={isStart ? "left" : "right"} size={54} />
        </span>
      </button>
    </div>
  );
}
