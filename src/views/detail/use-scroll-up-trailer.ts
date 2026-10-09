import { useEffect, useRef, type RefObject } from "react";

const THRESHOLD = 160;
const WINDOW_MS = 700;
const REARM_SCROLL = 40;

export function useScrollUpTrailer(
  scrollRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onTrigger: () => void,
): void {
  const fired = useRef(false);
  const pulled = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    const reset = () => {
      pulled.current = 0;
      last.current = 0;
    };

    const onScroll = () => {
      if (el.scrollTop > REARM_SCROLL) {
        fired.current = false;
        reset();
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (el.scrollTop > 0 || e.deltaY >= 0) {
        reset();
        return;
      }
      if (fired.current) return;
      const now = e.timeStamp;
      if (now - last.current > WINDOW_MS) pulled.current = 0;
      last.current = now;
      pulled.current += -e.deltaY;
      if (pulled.current >= THRESHOLD) {
        fired.current = true;
        reset();
        onTrigger();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, [scrollRef, enabled, onTrigger]);
}
