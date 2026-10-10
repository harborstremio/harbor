import { useEffect, useRef, useState } from "react";

export function useHeroMotion(active: boolean, ready: boolean, enabled: boolean) {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(preference.matches);
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const el = root.current;
    if (!el || !ready) return;
    let inView = false;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; update(); }, { threshold: .08 });
    observer.observe(el); document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, [ready]);
  useEffect(() => {
    const el = root.current, scroller = el?.closest<HTMLElement>(".games-view");
    if (!el || !scroller || !ready) return;
    let frame = 0;
    const draw = () => {
      frame = 0;
      // Playback never changes the composition. The hero starts behind the titlebar,
      // so measure actual scrolling rather than its negative top inset.
      const progress = !reduced ? Math.max(0, Math.min(1, scroller.scrollTop / el.offsetHeight)) : 0;
      el.style.setProperty("--hero-art-y", `${(progress * 80).toFixed(2)}px`);
      el.style.setProperty("--hero-copy-y", `${(progress * 22).toFixed(2)}px`);
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(draw); };
    draw(); scroller.addEventListener("scroll", scroll, { passive: true }); window.addEventListener("resize", scroll);
    return () => { cancelAnimationFrame(frame); scroller.removeEventListener("scroll", scroll); window.removeEventListener("resize", scroll); };
  }, [ready, reduced]);
  return { root, playing: active && visible && enabled && !reduced, reduced, visible };
}
