import { ArrowUp } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import { useT } from "@/lib/i18n";

export function ScrollToTop({
  scrollRef,
  threshold = 700,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
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
      type="button"
      aria-label={t("Scroll to top")}
      tabIndex={show ? 0 : -1}
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      className={`absolute bottom-6 end-6 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-edge-soft bg-elevated/85 text-ink-muted shadow-[0_14px_34px_-14px_rgba(0,0,0,0.7)] backdrop-blur-md transition-[opacity,transform,color,border-color] duration-300 ease-out hover:-translate-y-0.5 hover:border-edge hover:text-ink active:scale-95 motion-reduce:transition-none ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp size={18} strokeWidth={2.4} />
    </button>
  );
}
