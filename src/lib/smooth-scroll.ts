import { useEffect, type RefObject } from "react";

const EASE_MS = 55;
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let target = el.scrollTop;
    let raf = 0;
    let lastFrame = 0;

    const step = (time: number) => {
      const current = el.scrollTop;
      target = Math.max(0, Math.min(target, el.scrollHeight - el.clientHeight));
      const diff = target - current;
      if (Math.abs(diff) < SETTLE_PX) {
        el.scrollTop = target;
        raf = 0;
        return;
      }
      // Time-based easing stays consistent when moving between 60/120/144Hz screens.
      const elapsed = Math.max(0, time - lastFrame);
      lastFrame = time;
      const amount = 1 - Math.exp(-elapsed / EASE_MS);
      el.scrollTop = current + diff * amount;
      // Some webviews round scrollTop; don't spin forever on the last pixel.
      if (elapsed > 0 && el.scrollTop === current) {
        if (Math.abs(diff) <= 1) {
          el.scrollTop = target;
          raf = 0;
          return;
        }
        el.scrollTop = current + Math.sign(diff);
      }
      raf = requestAnimationFrame(step);
    };

    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented || !e.cancelable || reducedMotion.matches) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.deltaMode !== 0) return;
      if (!Number.isFinite(e.deltaY) || e.deltaY === 0) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      if (scrollableAncestorBefore(e.target, el)) return;
      const current = el.scrollTop;
      // Reversing the wheel should reverse motion immediately, not drain old momentum.
      const continuing = raf && Math.sign(target - current) === Math.sign(e.deltaY);
      const next = Math.max(
        0,
        Math.min(max, (continuing ? target : current) + e.deltaY * MULTIPLIER),
      );
      if (next === target && raf) {
        e.preventDefault();
        return;
      }
      target = next;
      if (target === current && !raf) return;
      e.preventDefault();
      if (!raf) {
        lastFrame = performance.now();
        raf = requestAnimationFrame(step);
      }
    };

    const cancel = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", cancel, { passive: true, capture: true });
    el.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel, { capture: true });
    reducedMotion.addEventListener("change", cancel);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", cancel, true);
      el.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel, true);
      reducedMotion.removeEventListener("change", cancel);
      cancel();
    };
  }, [ref, enabled]);
}
