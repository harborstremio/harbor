import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import type { AwardType } from "@/lib/providers/wikidata";
import { useT } from "@/lib/i18n";

export function AwardLaurelStrip({
  chips,
  onOpen,
}: {
  chips: { type: AwardType; wins: number; nominations: number }[];
  onOpen: (t: AwardType, anchor: DOMRect) => void;
}) {
  const tr = useT();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const draggedRef = useRef(false);

  const refresh = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    setAtStart(!overflow || el.scrollLeft < 4);
    setAtEnd(!overflow || el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  };

  useEffect(() => {
    refresh();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => refresh();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(refresh);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [chips.length]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollerRef.current;
    if (!el || e.button !== 0) return;
    draggedRef.current = false;
    const startX = e.clientX;
    const startScroll = el.scrollLeft;
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!draggedRef.current && Math.abs(dx) > 4) draggedRef.current = true;
      if (draggedRef.current) el.scrollLeft = startScroll - dx;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.6), behavior: "smooth" });
  };

  const fadeMask = `linear-gradient(to right, ${atStart ? "black" : "transparent"} 0, black 36px, black calc(100% - 36px), ${atEnd ? "black" : "transparent"} 100%)`;

  return (
    <div className="relative -mx-1">
      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
        className="flex cursor-grab select-none items-center gap-3 overflow-x-auto px-1 pb-1 pt-1 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((c) => (
          <AwardChip
            key={c.type}
            type={c.type}
            wins={c.wins}
            noms={c.nominations}
            onClick={(rect) => {
              if (draggedRef.current) return;
              onOpen(c.type, rect);
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label={tr("Scroll awards left")}
        className={`absolute start-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-edge-soft/40 bg-canvas/70 text-ink-muted backdrop-blur-md transition-opacity duration-200 hover:bg-canvas hover:text-ink ${
          atStart ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <ChevronLeft size={14} strokeWidth={2.2} className="dir-icon" />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label={tr("Scroll awards right")}
        className={`absolute end-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-edge-soft/40 bg-canvas/70 text-ink-muted backdrop-blur-md transition-opacity duration-200 hover:bg-canvas hover:text-ink ${
          atEnd ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <ChevronRight size={14} strokeWidth={2.2} className="dir-icon" />
      </button>
    </div>
  );
}

function AwardChip({
  type,
  wins,
  noms,
  onClick,
}: {
  type: AwardType;
  wins: number;
  noms: number;
  onClick: (rect: DOMRect) => void;
}) {
  const tr = useT();
  const tint = laurelColorFor(type);
  return (
    <button
      type="button"
      onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
      title={tr("{label} details", { label: labelFor(type) })}
      className="group relative flex h-14 shrink-0 items-center gap-2.5 rounded-full border border-edge-soft bg-canvas/50 ps-1.5 pe-4 transition-all hover:border-edge hover:bg-canvas/80 hover:scale-[1.03]"
    >
      <span className="text-ink-muted" style={tint ? { color: tint } : undefined}>
        <Laurel size={48}>
          <AwardLogo type={type} size={20} />
        </Laurel>
      </span>
      <div className="flex flex-col leading-tight text-start">
        <span className="text-[12.5px] font-semibold text-ink">
          {wins > 0
            ? wins === 1
              ? tr("{n} win", { n: wins })
              : tr("{n} wins", { n: wins })
            : noms === 1
              ? tr("{n} nom", { n: noms })
              : tr("{n} noms", { n: noms })}
          {wins > 0 && noms > 0 && (
            <span className="ms-1.5 font-medium text-ink-subtle">
              {noms === 1 ? tr("· {n} nom", { n: noms }) : tr("· {n} noms", { n: noms })}
            </span>
          )}
        </span>
        <span className="text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">{labelFor(type)}</span>
      </div>
    </button>
  );
}

function labelFor(type: AwardType): string {
  switch (type) {
    case "oscar":
      return "Oscar";
    case "emmy":
      return "Emmy";
    case "golden_globe":
      return "Golden Globe";
    case "bafta":
      return "BAFTA";
    case "sag":
      return "SAG";
    case "critics_choice":
      return "Critics' Choice";
    case "cannes":
      return "Cannes";
    case "venice":
      return "Venice";
    case "berlin":
      return "Berlin";
    case "bafta_tv":
      return "BAFTA TV";
    case "annie":
      return "Annie";
    case "spirit":
      return "Spirit";
    case "saturn":
      return "Saturn";
    case "cesar":
      return "César";
    case "goya":
      return "Goya";
    case "blue_dragon":
      return "Blue Dragon";
    case "baeksang":
      return "Baeksang";
    case "bifa":
      return "BIFA";
    default:
      return "Award";
  }
}
