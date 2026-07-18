import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
} from "react";

type ActiveDrag = { from: number; pointerId: number; y: number };

export type DragList = {
  dragIndex: number | null;
  overIndex: number | null;
  rowRef: (index: number) => (el: HTMLDivElement | null) => void;
  handleProps: (index: number) => HTMLAttributes<HTMLElement>;
};

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

export function useDragList(count: number, onDrop: (from: number, to: number) => void): DragList {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const rows = useRef(new Map<number, HTMLElement>());
  const scroller = useRef<HTMLElement | null>(null);
  const active = useRef<ActiveDrag | null>(null);
  const raf = useRef(0);
  const countRef = useRef(count);
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    countRef.current = count;
    onDropRef.current = onDrop;
  });

  const computeOver = (y: number, from: number): number => {
    let ins = 0;
    for (let i = 0; i < countRef.current; i++) {
      const el = rows.current.get(i);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y > r.top + r.height / 2) ins = i + 1;
    }
    const target = ins > from ? ins - 1 : ins;
    return Math.max(0, Math.min(countRef.current - 1, target));
  };

  const finish = (commit: boolean) => {
    const st = active.current;
    active.current = null;
    cancelAnimationFrame(raf.current);
    scroller.current = null;
    setDragIndex(null);
    setOverIndex(null);
    if (st && commit) {
      const target = computeOver(st.y, st.from);
      if (target !== st.from) onDropRef.current(st.from, target);
    }
  };

  const tick = () => {
    const st = active.current;
    if (!st) return;
    const sc = scroller.current;
    if (sc) {
      const r = sc.getBoundingClientRect();
      if (st.y < r.top + 48) sc.scrollBy(0, -8);
      else if (st.y > r.bottom - 48) sc.scrollBy(0, 8);
    }
    setOverIndex(computeOver(st.y, st.from));
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && active.current) {
        e.preventDefault();
        finish(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  const rowRef = (index: number) => (el: HTMLDivElement | null) => {
    if (el) rows.current.set(index, el);
    else rows.current.delete(index);
  };

  const handleProps = (index: number): HTMLAttributes<HTMLElement> => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (active.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      active.current = { from: index, pointerId: e.pointerId, y: e.clientY };
      scroller.current = findScrollParent(rows.current.get(index) ?? null);
      setDragIndex(index);
      setOverIndex(index);
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(tick);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const st = active.current;
      if (!st || e.pointerId !== st.pointerId) return;
      st.y = e.clientY;
      setOverIndex(computeOver(e.clientY, st.from));
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const st = active.current;
      if (!st || e.pointerId !== st.pointerId) return;
      st.y = e.clientY;
      finish(true);
    },
    onPointerCancel: () => finish(false),
  });

  return { dragIndex, overIndex, rowRef, handleProps };
}
