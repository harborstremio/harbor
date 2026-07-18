import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";

export function MediaRail({ children }: { children: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const isRtl = (el: HTMLDivElement) => getComputedStyle(el).direction === "rtl";
  const readPos = (el: HTMLDivElement) => (isRtl(el) ? -el.scrollLeft : el.scrollLeft);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const pos = readPos(el);
    setCanPrev(pos > 1);
    setCanNext(el.scrollWidth - el.clientWidth - pos > 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure, children]);

  const scroll = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: (isRtl(el) ? -dir : dir) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="group/rail relative min-w-0">
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto p-5 -m-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <RailArrow side="start" visible={canPrev} onClick={() => scroll(-1)} />
      <RailArrow side="end" visible={canNext} onClick={() => scroll(1)} />
    </div>
  );
}

function RailArrow({
  side,
  visible,
  onClick,
}: {
  side: "start" | "end";
  visible: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const sideClass = side === "start" ? "start-0 justify-start" : "end-0 justify-end";
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-20 flex w-14 items-center ${sideClass}`}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={side === "start" ? t("Scroll left") : t("Scroll right")}
        tabIndex={visible ? 0 : -1}
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-canvas/85 text-ink backdrop-blur-md transition-all duration-200 hover:scale-105 hover:bg-canvas ${
          visible
            ? "pointer-events-auto opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        {side === "start" ? (
          <ChevronLeft size={22} strokeWidth={2.2} className="dir-icon" />
        ) : (
          <ChevronRight size={22} strokeWidth={2.2} className="dir-icon" />
        )}
      </button>
    </div>
  );
}
