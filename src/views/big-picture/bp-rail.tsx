import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { BpBandId } from "./use-bp-sections";

export type BpRailEntry = { key: string; band?: BpBandId; node: ReactNode };

// One expression of the number, which is the whole point of the token. The
// non-TV half used to be a parallel clamp, which is exactly the bug class
// --bp-page-top was created to end: at a 1080 tall window --bp-bar-h resolves to
// 97.2px and --bp-page-top to 112.3px while that clamp resolved to 79.9px, so
// the page padded 17px LESS than the bar is tall and the first row sat under it.
// Android TV never caught it because both halves land on 82px at 641px of
// height. If desktop ever wants a shorter offset, redefine --bp-page-top under a
// media query in bp-tokens rather than restating it here.
export const BP_PAGE_TOP = "pt-[var(--bp-page-top)]";

const BP_RAIL_LEAD = 6;
const BP_RAIL_FILL = 4;
const BP_RAIL_FILL_MS = 220;


export function BpRail({
  railRef,
  entries,
  activeRow,
  railShift,
}: {
  railRef: RefObject<HTMLDivElement | null>;
  entries: readonly BpRailEntry[];
  activeRow: number;
  railShift: number;
}) {
  const [reach, setReach] = useState(BP_RAIL_LEAD);
  const reachRef = useRef(BP_RAIL_LEAD);
  const totalRef = useRef(entries.length);
  totalRef.current = entries.length;

  useEffect(() => {
    if (reachRef.current < activeRow + BP_RAIL_LEAD) reachRef.current = activeRow + BP_RAIL_LEAD;
    setReach((r) => (r < reachRef.current ? reachRef.current : r));
  }, [activeRow]);

  useEffect(() => {
    let id = 0;
    const step = () => {
      if (reachRef.current >= totalRef.current) return;
      reachRef.current += BP_RAIL_FILL;
      setReach(reachRef.current);
      id = window.setTimeout(step, BP_RAIL_FILL_MS);
    };
    id = window.setTimeout(step, BP_RAIL_FILL_MS);
    return () => window.clearTimeout(id);
  }, [entries.length]);

  const mounted = Math.max(reach, activeRow + BP_RAIL_LEAD);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        ref={railRef}
        data-bp-scroll-y
        className="absolute inset-x-0 top-0 flex flex-col gap-[var(--bp-row-gap)] transition-transform duration-[240ms] ease-[var(--bp-ease)] will-change-transform motion-reduce:transition-none"
        style={{ transform: `translate3d(0, ${-railShift}px, 0)` }}
      >
        {entries.map((entry, i) => (
          <BpRailRow
            key={entry.key}
            index={i}
            active={activeRow}
            band={entry.band}
            lead={i > 0 && entries[i - 1].band !== entry.band}
          >
            {i <= mounted ? entry.node : null}
          </BpRailRow>
        ))}
      </div>
    </div>
  );
}

function BpRailRow({
  index,
  active,
  band,
  lead,
  children,
}: {
  index: number;
  active: number;
  band?: BpBandId;
  lead: boolean;
  children: ReactNode;
}) {
  const above = index < active;
  return (
    // Faded, never hidden: rows above the active one stay reachable by Up, and
    // aria-hidden or visibility would make the engine focus something it cannot.
    <div
      data-bp-rail-row={index}
      data-bp-band={band}
      data-bp-band-lead={lead ? "true" : undefined}
      className={`ease-[var(--bp-ease)] empty:hidden motion-reduce:transition-none ${
        lead ? "mt-[clamp(10px,1.4vh,24px)] " : ""
      }${
        above
          ? "pointer-events-none opacity-0 transition-opacity duration-[var(--bp-dur-fast)]"
          : "opacity-100 transition-opacity duration-[var(--bp-dur)]"
      }`}
    >
      {children}
    </div>
  );
}
