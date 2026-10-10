import { useEffect, useRef, type RefObject } from "react";

// Past the hero the art has scrolled away, so the page settles onto a solid
// ground instead of leaving the backdrop showing behind the rows.
//
// Onto the node, never back into useState: this component renders the hero
// and every rail row, so a ramp in state re-rendered the whole detail tree
// once per frame for the length of every glide. Alpha in the PAINT and never
// element opacity, the trade bp-tokens records at its shimmer rule, because
// a partial opacity is a render surface and this element is the whole
// viewport. Whole percents, and no transition: the value is already frame
// accurate, and a transition only made it chase the scroll and held the
// surface live for another 420ms after the scroll stopped.
export function useBpGroundFade(
  scrollRef: RefObject<HTMLDivElement | null>,
  metaId: string | undefined,
): RefObject<HTMLDivElement | null> {
  const groundRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    let painted = -1;
    const paint = () => {
      raf = 0;
      const span = Math.max(1, el.clientHeight * 0.45);
      const next = Math.round(Math.min(1, el.scrollTop / span) * 100);
      if (next === painted) return;
      painted = next;
      const ground = groundRef.current;
      if (ground) {
        ground.style.backgroundColor = `color-mix(in oklab, var(--bp-page) ${next}%, transparent)`;
      }
    };
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(paint);
    };
    paint();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [scrollRef, metaId]);

  return groundRef;
}
