import { useT } from "@/lib/i18n";
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

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
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("Back to top")}
      className={`fixed bottom-5 end-5 z-40 flex h-8 w-8 items-center justify-center rounded-md border border-edge-soft/40 bg-canvas/90 text-ink-muted transition-[transform,opacity,background-color,color] duration-300 hover:bg-canvas hover:text-ink ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ArrowUp size={14} strokeWidth={2.2} />
    </button>
  );
}
