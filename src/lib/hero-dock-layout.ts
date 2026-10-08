import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { heroBoxFor, type HeroBox } from "./hero-dock-box";

/**
 * Measures the hero box over the content area while a video is docked, and publishes its edges as
 * CSS variables (`--hd-top`, `--hd-bottom`) so the page layer can be masked out underneath it.
 */
export function useHeroDockBox(
  areaRef: RefObject<HTMLElement | null>,
  active: boolean,
  topOffset: number,
): CSSProperties | undefined {
  const [box, setBox] = useState<HeroBox | null>(null);

  useEffect(() => {
    const el = areaRef.current;
    if (!active || !el) {
      setBox(null);
      return;
    }
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = heroBoxFor({ left: r.left, top: r.top, width: r.width }, window.innerHeight, topOffset);
      setBox((prev) =>
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [areaRef, active, topOffset]);

  useEffect(() => {
    const root = document.documentElement;
    if (!box) {
      root.style.removeProperty("--hd-top");
      root.style.removeProperty("--hd-bottom");
      return;
    }
    // Measured from the top of the content area, which is where the page layer starts.
    root.style.setProperty("--hd-top", `${topOffset}px`);
    root.style.setProperty("--hd-bottom", `${topOffset + box.height}px`);
  }, [box, topOffset]);

  return box ? { left: box.left, top: box.top, width: box.width, height: box.height } : undefined;
}
