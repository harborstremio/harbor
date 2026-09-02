import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useT } from "@/lib/i18n";

export function BackToTop({
  scrollRef,
  threshold = 600,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  threshold?: number;
}) {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShow(el.scrollTop > threshold);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, threshold]);

  return (
    <button
      onClick={() =>
        scrollRef.current?.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
      }
      aria-label={t("Back to top")}
      className={`fixed bottom-5 end-5 z-40 flex h-9 w-9 items-center justify-center rounded-md bg-elevated text-ink-muted ring-1 ring-edge-soft shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] transition-[transform,opacity,background-color,color] duration-200 ease-in-out hover:bg-raised hover:text-ink active:scale-[0.97] ${
        show
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp size={14} strokeWidth={2.2} />
    </button>
  );
}
