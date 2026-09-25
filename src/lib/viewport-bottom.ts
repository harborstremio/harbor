export const VIEWPORT_BOTTOM_VAR = "--harbor-viewport-bottom";

const KEYBOARD_FLOOR = 24;

export function viewportBottomGap(
  layoutHeight: number,
  visualHeight: number,
  offsetTop: number,
): number {
  if (![layoutHeight, visualHeight, offsetTop].every(Number.isFinite)) return 0;
  const gap = layoutHeight - (visualHeight + Math.max(0, offsetTop));
  if (!(gap >= KEYBOARD_FLOOR)) return 0;
  return Math.min(Math.floor(gap), Math.max(0, Math.floor(layoutHeight)));
}

export function trackViewportBottom(): () => void {
  if (typeof window === "undefined") return () => {};
  const view = window.visualViewport;
  const root = document.documentElement;
  let frame = 0;
  const measure = () =>
    view ? viewportBottomGap(root.clientHeight, view.height, view.offsetTop) : 0;
  const commit = (gap: number) => root.style.setProperty(VIEWPORT_BOTTOM_VAR, `${gap}px`);
  const apply = () => commit(measure());
  // A window resize fires before the visual viewport settles, so a gap measured mid-resize is
  // stale. Zero commits at once; lifting the dock waits for the same gap on a second frame.
  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const first = measure();
      if (first === 0) {
        frame = 0;
        commit(0);
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        const second = measure();
        commit(second === first ? second : 0);
      });
    });
  };
  apply();
  view?.addEventListener("resize", schedule);
  view?.addEventListener("scroll", schedule);
  window.addEventListener("resize", schedule);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    view?.removeEventListener("resize", schedule);
    view?.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    root.style.removeProperty(VIEWPORT_BOTTOM_VAR);
  };
}
