import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useDragScroll } from "@/lib/use-drag-scroll";

export function DragStrip({
  children,
  itemCount,
  stride = 260,
  arrowOffset = "top-[69px]",
  onReachEnd,
}: {
  children: React.ReactNode;
  itemCount: number;
  stride?: number;
  arrowOffset?: string;
  onReachEnd?: () => void;
}) {
  const { ref, handlers } = useDragScroll<HTMLDivElement>({ stride });
  const barTrackRef = useRef<HTMLDivElement | null>(null);
  const reachedRef = useRef(0);
  const barDrag = useRef<{ x: number; s: number } | null>(null);
  const [bar, setBar] = useState({ left: false, right: false, thumb: 0, pos: 0, show: false });

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const show = max > 2;
    let thumb = 0;
    let pos = 0;
    const track = barTrackRef.current;
    if (show && track) {
      const tw = track.clientWidth;
      thumb = Math.max(64, (el.clientWidth / el.scrollWidth) * tw);
      pos = (el.scrollLeft / max) * (tw - thumb);
    }
    setBar({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4, thumb, pos, show });
    if (onReachEnd && max > 0 && el.scrollLeft >= max - 600) {
      if (reachedRef.current !== el.scrollWidth) {
        reachedRef.current = el.scrollWidth;
        onReachEnd();
      }
    }
  }, [ref, onReachEnd]);

  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [itemCount, sync]);

  const page = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const onBarDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    barDrag.current = { x: e.clientX, s: el.scrollLeft };
  };
  const onBarMove = (e: React.PointerEvent) => {
    const d = barDrag.current;
    const el = ref.current;
    const track = barTrackRef.current;
    if (!d || !el || !track) return;
    const max = el.scrollWidth - el.clientWidth;
    const ratio = max / Math.max(1, track.clientWidth - bar.thumb);
    el.scrollLeft = d.s + (e.clientX - d.x) * ratio;
  };
  const onBarUp = (e: React.PointerEvent) => {
    barDrag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="group/eps relative">
      <div
        ref={ref}
        onScroll={sync}
        {...handlers}
        className="flex cursor-grab gap-4 overflow-x-auto [scroll-snap-type:x_proximity] [&>*]:[scroll-snap-align:start] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] active:cursor-grabbing [&_img]:select-none [&_img]:[-webkit-user-drag:none]"
      >
        {children}
      </div>
      {bar.left && <StripArrow dir={-1} offset={arrowOffset} onClick={() => page(-1)} />}
      {bar.right && <StripArrow dir={1} offset={arrowOffset} onClick={() => page(1)} />}
      {bar.show && (
        <div ref={barTrackRef} className="relative mt-3.5 h-3 w-full rounded-full bg-edge-soft/25">
          <div
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerUp={onBarUp}
            onPointerCancel={onBarUp}
            className="absolute top-0 h-full cursor-grab touch-none rounded-full bg-ink-subtle/55 transition-colors hover:bg-ink-subtle/80 active:cursor-grabbing active:bg-ink-subtle/95"
            style={{ width: bar.thumb, left: bar.pos }}
          />
        </div>
      )}
    </div>
  );
}

function StripArrow({
  dir,
  offset,
  onClick,
}: {
  dir: -1 | 1;
  offset: string;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={dir === -1 ? t("Previous episodes") : t("More episodes")}
      className={`absolute ${offset} z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-canvas/85 text-ink opacity-0 shadow-[0_4px_18px_-4px_rgba(0,0,0,0.55)] backdrop-blur-md transition-opacity duration-200 group-hover/eps:opacity-100 ${
        dir === -1 ? "start-1.5" : "end-1.5"
      }`}
    >
      {dir === -1 ? (
        <ChevronLeft size={22} strokeWidth={2.4} className="dir-icon" />
      ) : (
        <ChevronRight size={22} strokeWidth={2.4} className="dir-icon" />
      )}
    </button>
  );
}
