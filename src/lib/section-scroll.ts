const TICK_MS = 100;
const MAX_TICKS = 50;
const HOLD_TICKS = 2;
const WAIT_TICKS = 12;

let cancelActive: (() => void) | null = null;

export function scrollToDetailSection(sectionKey: string, id: string) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  cancelActive?.();
  const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  const pick = (root: ParentNode) =>
    root.querySelector<HTMLElement>(`[id="${id}"]`) ??
    root.querySelector<HTMLElement>(`[data-section="${sectionKey}"]`);
  const first = pick(document);
  if (!first) return;
  const box = scrollerOf(first);
  first.scrollIntoView({ behavior, block: "start" });

  let timer = 0;
  let ticks = 0;
  let stillTicks = 0;
  let lastPos = Number.NaN;
  let lastTop = Number.NaN;
  let lastEl: HTMLElement | null = null;
  const stop = () => {
    window.clearTimeout(timer);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
    if (cancelActive === stop) cancelActive = null;
  };
  const chase = () => {
    const el = box.isConnected ? pick(box) : null;
    if (!el) return stop();
    if (el !== lastEl) stillTicks = 0;
    lastEl = el;
    const pos = box.scrollTop;
    const top = Math.round(el.getBoundingClientRect().top);
    const still = pos === lastPos && top === lastTop;
    lastPos = pos;
    lastTop = top;
    if (!still) stillTicks = 0;
    else if (++stillTicks >= (el.id === id ? HOLD_TICKS : WAIT_TICKS)) return stop();
    else el.scrollIntoView({ behavior, block: "start" });
    if (++ticks > MAX_TICKS) return stop();
    timer = window.setTimeout(chase, TICK_MS);
  };
  cancelActive = stop;
  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  timer = window.setTimeout(chase, TICK_MS);
}

function scrollerOf(el: HTMLElement): HTMLElement {
  let p = el.parentElement;
  while (p) {
    const overflow = getComputedStyle(p).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}
