import { useEffect, type RefObject } from "react";

const EASE = 0.18;
const MULTIPLIER = 1;
const SETTLE_PX = 0.5;

function scrollableAncestorBefore(from: EventTarget | null, stop: HTMLElement): boolean {
  let node = from instanceof HTMLElement ? from : null;
  while (node && node !== stop) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 1)
      return true;
    node = node.parentElement;
  }
  return false;
}

export function useSmoothWheel(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let target = el.scrollTop;
    let raf = 0;

    const step = () => {
      const current = el.scrollTop;
      const diff = target - current;
      if (Math.abs(diff) < SETTLE_PX) {
        el.scrollTop = target;
        raf = 0;
        return;
      }
      el.scrollTop = current + diff * EASE;
      raf = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.deltaMode !== 0) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      if (scrollableAncestorBefore(e.target, el)) return;
      const next = Math.max(
        0,
        Math.min(max, (raf ? target : el.scrollTop) + e.deltaY * MULTIPLIER),
      );
      if (next === target && raf) {
        e.preventDefault();
        return;
      }
      target = next;
      e.preventDefault();
      if (!raf) raf = requestAnimationFrame(step);
    };

    const cancel = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", cancel, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", cancel);
      cancel();
    };
  }, [ref, enabled]);
}
