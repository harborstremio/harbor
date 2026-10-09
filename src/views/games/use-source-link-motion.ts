import { useLayoutEffect, type RefObject } from "react";

/** Animate natural content-height changes without scaling text or changing scroll ownership. */
export function useSourceLinkMotion(root: RefObject<HTMLDivElement | null>, closing: boolean) {
  useLayoutEffect(() => {
    const content = root.current, panel = content?.closest<HTMLElement>('[role="dialog"]');
    if (!content || !panel || closing) return;
    let previous = content.offsetHeight, animation: Animation | undefined;
    const observer = new ResizeObserver(() => {
      const next = content.offsetHeight;
      if (Math.abs(next - previous) < 1) return;
      const from = animation?.playState === "running" ? parseFloat(getComputedStyle(panel).height) : previous;
      previous = next;
      animation?.cancel();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      animation = panel.animate([{ height: `${from}px` }, { height: `${next}px` }], { duration: 200, easing: "ease-in-out" });
    });
    observer.observe(content);
    return () => { observer.disconnect(); animation?.cancel(); };
  }, [root, closing]);
}
