import { ChevronUp } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useT } from "@/lib/i18n";

export function ScrollToTop({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
  const t = useT();
  const [show, setShow] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      setShow(el.scrollTop > 640);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetRef]);

  const toTop = () => {
    targetRef.current?.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={t("Scroll to top")}
      className={`fixed bottom-6 right-6 z-30 grid h-11 w-11 place-items-center rounded-full bg-elevated text-ink shadow-[0_14px_32px_-12px_rgba(0,0,0,0.7)] ring-1 ring-edge-soft transition duration-200 hover:bg-raised motion-safe:hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        show ? "opacity-100" : "pointer-events-none opacity-0 motion-safe:translate-y-2.5"
      }`}
    >
      <ChevronUp size={20} strokeWidth={2.4} />
    </button>
  );
}
