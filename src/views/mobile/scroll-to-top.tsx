import { ChevronUp } from "lucide-react";

export function ScrollToTop({
  scrollRef,
  visible,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
}) {
  const toTop = () => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? 0 : -1}
      onClick={toTop}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)" }}
      className={`fixed right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-elevated/80 text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft/60 backdrop-blur-xl transition-[opacity,transform] duration-300 ease-out active:scale-95 motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <ChevronUp size={20} strokeWidth={2.25} />
    </button>
  );
}
