import { useEffect, useState, type CSSProperties, type RefObject } from "react";
import { heroBoxFor, type HeroBox } from "./hero-dock-box";
import { isHubKind, useHeroDock } from "./hero-dock";
import { nativeTvAvailable } from "./player/native-tv/bridge";
import { useSettings } from "./settings";
import { useView } from "./view";

export type HeroDockMode = "wallpaper" | "hero";

/**
 * How the pinned video is showing right now, or null when nothing is pinned on this page. The TV
 * app draws its native video over the page, so there it can only sit in the hero box.
 */
export function useActiveHeroDockMode(): HeroDockMode | null {
  const { player, topKind } = useView();
  const dock = useHeroDock();
  const { settings } = useSettings();
  if (!dock || player || !isHubKind(topKind)) return null;
  return nativeTvAvailable() ? "hero" : settings.heroDockMode;
}

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
      for (const v of ["--hd-top", "--hd-bottom", "--hd-x", "--hd-y", "--hd-w", "--hd-h"]) root.style.removeProperty(v);
      return;
    }
    // Measured from the top of the content area, which is where the page layer starts.
    root.style.setProperty("--hd-top", `${topOffset}px`);
    root.style.setProperty("--hd-bottom", `${topOffset + box.height}px`);
    // The same box in window coordinates, for the theme backdrop (see .theme-backdrop-hero).
    root.style.setProperty("--hd-x", `${box.left}px`);
    root.style.setProperty("--hd-y", `${box.top}px`);
    root.style.setProperty("--hd-w", `${box.width}px`);
    root.style.setProperty("--hd-h", `${box.height}px`);
  }, [box, topOffset]);

  return box ? { left: box.left, top: box.top, width: box.width, height: box.height } : undefined;
}
