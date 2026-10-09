import { ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Scroller = HTMLElement | (Window & typeof globalThis);

function findScroller(from: HTMLElement | null): Scroller {
  let el = from?.parentElement ?? null;
  while (el) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 4) return el;
    el = el.parentElement;
  }
  return window;
}

export function ScrollTopButton({
  threshold = 420,
  z = 60,
  label = "Back to top",
}: {
  threshold?: number;
  z?: number;
  label?: string;
}) {
  const sentinel = useRef<HTMLSpanElement>(null);
  const scroller = useRef<Scroller | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = findScroller(sentinel.current);
    scroller.current = target;
    const top = () => (target === window ? window.scrollY : (target as HTMLElement).scrollTop);
    const onScroll = () => setShow(top() > threshold);
    onScroll();
    const et: EventTarget = target;
    et.addEventListener("scroll", onScroll, { passive: true });
    return () => et.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const toTop = () => {
    const target = scroller.current;
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    if (target === window) window.scrollTo({ top: 0, behavior });
    else (target as HTMLElement).scrollTo({ top: 0, behavior });
  };

  return (
    <>
      <span ref={sentinel} aria-hidden className="hidden" />
      {createPortal(
        <button
          type="button"
          onClick={toTop}
          aria-label={label}
          title={label}
          style={{
            zIndex: z,
            bottom:
              "calc(24px + var(--harbor-music-dock, 0px) + var(--harbor-viewport-bottom, 0px))",
          }}
          className={`fixed bottom-6 end-6 flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-elevated/90 text-ink shadow-[0_16px_44px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-[opacity,transform] duration-200 hover:bg-raised active:scale-[0.94] motion-reduce:transition-none ${
            show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          }`}
        >
          <ArrowUp size={18} strokeWidth={2.2} />
        </button>,
        document.body,
      )}
    </>
  );
}
