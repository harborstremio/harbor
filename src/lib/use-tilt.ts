import { useCallback, useRef } from "react";

const MAX_DEG = 3.2;
const LIFT = 7;
const SCALE = 1.028;

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useTilt<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const raf = useRef(0);
  const clearTimer = useRef(0);
  const rect = useRef<DOMRect | null>(null);

  const base = `perspective(1300px) translate3d(0,-${LIFT}px,0) scale(${SCALE})`;

  const onPointerEnter = useCallback(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    rect.current = el.getBoundingClientRect();
    window.clearTimeout(clearTimer.current);
    el.style.willChange = "transform";
    el.style.transition = "transform 160ms cubic-bezier(0.32,0.72,0.24,1)";
    el.style.transform = base;
  }, [base]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    const r = rect.current;
    if (!el || !r || reduced()) return;
    if (!r.width) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const rx = (-py * 2 * MAX_DEG).toFixed(2);
      const ry = (px * 2 * MAX_DEG).toFixed(2);
      el.style.transform = `${base} rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
  }, [base]);

  const onPointerLeave = useCallback(() => {
    cancelAnimationFrame(raf.current);
    rect.current = null;
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 380ms cubic-bezier(0.32,0.72,0.24,1)";
    el.style.transform = "";
    window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => {
      const node = ref.current;
      if (node) node.style.willChange = "";
    }, 420);
  }, []);

  return { ref, onPointerEnter, onPointerMove, onPointerLeave };
}
