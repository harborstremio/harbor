import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/**
 * Multi-column CSS-grid style virtualizer for large poster grids.
 * Only mounts visible rows (+ overscan) for smooth scroll on big catalogs.
 */
export function VirtualGrid<T>({
  items,
  scrollRef,
  estimateRowHeight = 280,
  minColumnWidth = 150,
  gapX = 16,
  gapY = 32,
  overscan = 3,
  renderItem,
  className = "",
  getKey,
}: {
  items: T[];
  scrollRef: RefObject<HTMLElement | null>;
  estimateRowHeight?: number;
  minColumnWidth?: number;
  gapX?: number;
  gapY?: number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  getKey?: (item: T, index: number) => string | number;
}) {
  "use no memo";

  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const next = Math.max(1, Math.floor((w + gapX) / (minColumnWidth + gapX)));
      setCols(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gapX, minColumnWidth]);

  const rowCount = Math.max(1, Math.ceil(items.length / cols));
  const rowVirtualizer = useVirtualizer({
    count: items.length === 0 ? 0 : rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight + gapY,
    // Each virtual item contains exactly one CSS-grid row, so `rowGap` would
    // not create spacing between virtual rows. Include the gap in measurement
    // as well as the estimate, otherwise measured rows stack flush together.
    measureElement: (element) => element.getBoundingClientRect().height + gapY,
    overscan,
  });

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className={className}>
      <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((row) => {
          const start = row.index * cols;
          const slice = items.slice(start, start + cols);
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={rowVirtualizer.measureElement}
              className="absolute start-0 grid w-full"
              style={{
                transform: `translateY(${row.start}px)`,
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                columnGap: gapX,
              }}
            >
              {slice.map((item, i) => {
                const index = start + i;
                const key = getKey ? getKey(item, index) : index;
                return <div key={key}>{renderItem(item, index)}</div>;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
