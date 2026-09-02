import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type PanelPosition = { x: number; y: number };

const DEFAULT_WIDTH = 416;
const DEFAULT_GAP = 24;

export function usePanelDrag(opts?: { width?: number; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PanelPosition>(() => {
    const w = opts?.width ?? DEFAULT_WIDTH;
    const g = opts?.gap ?? DEFAULT_GAP;
    return { x: Math.max(g, window.innerWidth - w - g), y: g };
  });
  const [dragging, setDragging] = useState(false);

  const clamp = (x: number, y: number): PanelPosition => {
    const g = opts?.gap ?? DEFAULT_GAP;
    const el = ref.current;
    const w = el?.offsetWidth || opts?.width || DEFAULT_WIDTH;
    const h = el?.offsetHeight ?? 0;
    const maxX = Math.max(g, window.innerWidth - w - g);
    const maxY = Math.max(g, window.innerHeight - h - g);
    return { x: Math.min(Math.max(g, x), maxX), y: Math.min(Math.max(g, y), maxY) };
  };

  const onPointerDown: React.PointerEventHandler<HTMLElement> = (e) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement;
    if (el.closest('button, input, textarea, a, select, [role="button"]')) return;
    const start = { px: e.clientX, py: e.clientY, x: position.x, y: position.y };
    setDragging(true);
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) =>
      setPosition(clamp(start.x + (ev.clientX - start.px), start.y + (ev.clientY - start.py)));
    const up = () => {
      setDragging(false);
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const g = opts?.gap ?? DEFAULT_GAP;
    const w = el.offsetWidth || opts?.width || DEFAULT_WIDTH;
    const h = el.offsetHeight;
    const maxX = Math.max(g, window.innerWidth - w - g);
    const maxY = Math.max(g, window.innerHeight - h - g);
    const centered = Math.round((window.innerHeight - h) / 2);
    setPosition({ x: maxX, y: Math.min(Math.max(g, centered), maxY) });
    const ro = new ResizeObserver(() => setPosition((p) => clamp(p.x, p.y)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => setPosition((p) => clamp(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";
    };
  }, []);

  return { ref, position, handleProps: { onPointerDown }, dragging };
}
