import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RailChevron } from "@/components/nav-arrow";
import { useDragScroll } from "@/lib/use-drag-scroll";

/** The filter strips outran their width, so they fell back to native scrollbars. This gives them
 *  the same hidden-scrollbar rail plus edge arrows every other Harbor row already uses. */
export function PillRail({
  className,
  label,
  children,
}: {
  className: string;
  label: string;
  children: ReactNode;
}) {
  const rail = useDragScroll<HTMLDivElement>();
  const [edges, setEdges] = useState({ start: true, end: true });
  const ref = rail.ref;
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const travel = el.scrollWidth - el.clientWidth;
    const offset = Math.abs(el.scrollLeft);
    setEdges({ start: offset <= 1, end: travel <= 1 || offset >= travel - 1 });
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        measure();
      });
    };
    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [measure, ref]);

  const move = (step: number) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({
      left: (rtl ? -1 : 1) * step * el.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  };

  return (
    <div className="sh-pill-rail group/edge">
      <div
        ref={ref}
        {...rail.handlers}
        className={className}
        role="group"
        aria-label={label}
        data-start={edges.start || undefined}
        data-end={edges.end || undefined}
      >
        {children}
      </div>
      <RailChevron side="left" visible={!edges.start} onClick={() => move(-1)} outset={6} size={38} nudgeY={-12} />
      <RailChevron side="right" visible={!edges.end} onClick={() => move(1)} outset={6} size={38} nudgeY={-12} />
    </div>
  );
}
