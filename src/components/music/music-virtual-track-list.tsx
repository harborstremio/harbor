import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Keep long playlists in the page's existing scroller, with the full queue in memory. */
export function MusicVirtualTrackList({ keys, compact, renderRow }: {
  keys: string[];
  compact: boolean;
  renderRow: (index: number) => ReactNode;
}) {
  "use no memo";
  const host = useRef<HTMLDivElement>(null);
  const focusFrame = useRef(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const focusedIndex = useMemo(() => focusedKey === null ? -1 : keys.indexOf(focusedKey), [keys, focusedKey]);
  const getItemKey = useCallback((index: number) => keys[index], [keys]);
  const rangeExtractor = useCallback((range: Parameters<typeof defaultRangeExtractor>[0]) => {
    const visible = defaultRangeExtractor(range);
    // A focused row or its portaled menu must survive scrolling out of view.
    return focusedIndex < 0 || visible.includes(focusedIndex)
      ? visible : [...visible, focusedIndex].sort((a, b) => a - b);
  }, [focusedIndex]);
  const rowHeight = compact ? 48 : 68;
  const virtual = useVirtualizer<HTMLElement, HTMLDivElement>({
    count: keys.length,
    getScrollElement: () => host.current?.closest("main") ?? null,
    estimateSize: () => rowHeight,
    getItemKey,
    rangeExtractor,
    scrollMargin,
    // Leave room for the existing sticky title when navigating with the keyboard.
    scrollPaddingStart: 140,
    scrollPaddingEnd: 90,
    overscan: 6,
  });

  useLayoutEffect(() => {
    const element = host.current;
    const scroller = element?.closest("main");
    if (!element || !scroller) return;
    const measure = () => setScrollMargin(
      element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - scroller.clientTop,
    );
    measure();
    const observer = new ResizeObserver(measure);
    // The hero/toolbar above us can resize without changing the viewport.
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      observer.observe(node);
      if (node === scroller) break;
    }
    return () => { observer.disconnect(); cancelAnimationFrame(focusFrame.current); };
  }, []);
  useLayoutEffect(() => { virtual.measure(); }, [virtual, rowHeight]);

  const focusRow = (index: number, control: number) => {
    setFocusedKey(keys[index]);
    virtual.scrollToIndex(index, { align: "auto" });
    cancelAnimationFrame(focusFrame.current);
    let attempts = 0;
    const focus = () => {
      const row = host.current?.querySelector<HTMLElement>(`[data-virtual-track="${index}"]`);
      const buttons = row?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      const button = buttons?.[control < 0 ? buttons.length - 1 : Math.min(control, buttons.length - 1)];
      if (button) button.focus({ preventScroll: true });
      else if (++attempts < 6) focusFrame.current = requestAnimationFrame(focus);
    };
    focusFrame.current = requestAnimationFrame(focus);
  };

  return (
    <div ref={host} role="list" style={{ position: "relative", height: virtual.getTotalSize(), overflowAnchor: "none" }}
      onFocusCapture={event => {
        const row = (event.target as HTMLElement).closest<HTMLElement>("[data-virtual-track]");
        if (row) setFocusedKey(keys[Number(row.dataset.virtualTrack)]);
      }}
      onContextMenuCapture={event => {
        const row = (event.target as HTMLElement).closest<HTMLElement>("[data-virtual-track]");
        if (row) setFocusedKey(keys[Number(row.dataset.virtualTrack)]);
      }}
      onBlurCapture={event => {
        const next = event.relatedTarget as HTMLElement | null;
        if (next && !event.currentTarget.contains(next) && !next.closest('[role="menu"]')) setFocusedKey(null);
      }}
      onKeyDown={event => {
        const target = event.target as HTMLElement;
        const row = target.closest<HTMLElement>("[data-virtual-track]");
        if (!row || event.altKey || event.ctrlKey || event.metaKey) return;
        const index = Number(row.dataset.virtualTrack);
        const buttons = [...row.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const control = buttons.indexOf(target as HTMLButtonElement);
        let next = index, nextControl = control;
        if (event.key === "ArrowDown") next += 1;
        else if (event.key === "ArrowUp") next -= 1;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = keys.length - 1;
        else if (event.key === "Tab" && ((!event.shiftKey && control === buttons.length - 1) || (event.shiftKey && control === 0))) {
          next += event.shiftKey ? -1 : 1;
          nextControl = event.shiftKey ? -1 : 0;
        } else return;
        if (next < 0 || next >= keys.length) return;
        event.preventDefault();
        event.stopPropagation();
        focusRow(next, nextControl);
      }}>
      {virtual.getVirtualItems().map(row => (
        <div key={row.key} ref={virtual.measureElement} data-index={row.index} data-virtual-track={row.index}
          role="listitem" aria-posinset={row.index + 1} aria-setsize={keys.length}
          style={{ position: "absolute", top: row.start - scrollMargin, insetInline: 0 }}>
          {renderRow(row.index)}
        </div>
      ))}
    </div>
  );
}
