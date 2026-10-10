import { useCallback, useEffect, useRef, useState, type UIEvent } from "react";

export function useVirtualWindow(count: number, rowHeight: number, overscan = 8) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const scrollToRow = useCallback(
    (row: number) => {
      const el = ref.current;
      if (!el) return;
      el.scrollTo({ top: Math.max(0, row * rowHeight - el.clientHeight / 2 + rowHeight / 2) });
    },
    [rowHeight],
  );

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);

  return { ref, onScroll, scrollToRow, scrollTop, start, end, padTop: start * rowHeight, totalHeight: count * rowHeight };
}
