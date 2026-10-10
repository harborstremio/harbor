import { useRef } from "react";
import { horizontalScrollState } from "./horizontal-scroll";

export function useDragScroll<T extends HTMLElement>(opts: { stride?: number } = {}) {
  const ref = useRef<T | null>(null);
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
  const rafId = useRef<number | null>(null);

  const cancelGlide = () => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent<T>) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const el = ref.current;
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

  const onPointerMove = (e: React.PointerEvent<T>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d.active || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) {
      d.moved = true;
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      try {
        el.setPointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
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

  const endDrag = (e?: React.PointerEvent<T>) => {
    const d = drag.current;
    const el = ref.current;
    d.active = false;
    if (!d.moved || !el) {
      setTimeout(() => {
        drag.current.moved = false;
      }, 0);
      return;
    }
    try {
      if (e) el.releasePointerCapture(d.pointerId);
    } catch {
      /* ignore */
    }
    const friction = 0.004;
    const v = d.vel;
    const projection = -((v * Math.abs(v)) / (2 * friction));
    const { max, rtl } = horizontalScrollState(el);
    const projected = el.scrollLeft + projection;
    const logical = rtl ? -projected : projected;
    const snapped = opts.stride && opts.stride > 0
      ? Math.round(logical / opts.stride) * opts.stride
      : logical;
    const target =
      (rtl ? -1 : 1) * Math.max(0, Math.min(snapped, max));
    const start = el.scrollLeft;
    const distance = target - start;
    const startTime = performance.now();
    const duration = Math.max(280, Math.min(620, 260 + Math.abs(distance) * 0.45));
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.scrollLeft = start + distance * eased;
      if (t < 1) {
        rafId.current = requestAnimationFrame(tick);
      } else {
        rafId.current = null;
        el.style.scrollSnapType = "";
        el.style.scrollBehavior = "";
      }
    };
    rafId.current = requestAnimationFrame(tick);
    setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };

  const onClickCapture = (e: React.MouseEvent<T>) => {
    if (drag.current.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
    },
  };
}
