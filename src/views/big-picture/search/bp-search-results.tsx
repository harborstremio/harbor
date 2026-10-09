import { useEffect, useMemo, useRef, useState } from "react";
import { bpRailSignature, useBpLayoutReflow } from "../use-bp-row-layout";
import {
  BpSearchGroup,
  bpGroupRenders,
  type BpGroupCell,
  type BpGroupShape,
  type BpGroupSource,
  type BpGroupState,
} from "./bp-search-group";

export type BpSearchSlot = {
  key: string;
  band?: string;
  title: string;
  state: BpGroupState;
  shape: BpGroupShape;
  cells: BpGroupCell[];
  count?: number;
  source?: BpGroupSource;
  portrait?: string;
  onRetry?: () => void;
};

const VIEWPORT = "relative -mx-[var(--bp-gutter)] min-h-0 flex-1 overflow-hidden";

const RAIL =
  "absolute inset-x-0 top-0 flex flex-col gap-[var(--bp-row-gap)] transition-transform duration-[300ms] ease-[var(--bp-ease)] will-change-transform motion-reduce:transition-none";

const LEAD = "mt-[clamp(10px,1.4vh,24px)] ";

const ABOVE = "pointer-events-none opacity-0 transition-opacity duration-[140ms]";

const BELOW = "opacity-100 transition-opacity duration-[320ms]";

// Every slot the query can produce is known before the first request goes out,
// so the row set never depends on what arrived. Only row contents do. A slot
// that has settled with nothing in it is the one case that renders nothing, and
// empty:hidden collapses it without taking its index away from the rail.
export function bpSearchSlotsEmpty(slots: readonly BpSearchSlot[]): boolean {
  return !slots.some((s) => bpGroupRenders(s.state, s.cells.length));
}

// A band break only earns its extra air above the first row of the band that
// actually renders. Reading it off the previous slot instead leaves the gap
// stranded above a collapsed row.
function railLeads(slots: readonly BpSearchSlot[]): boolean[] {
  const out: boolean[] = [];
  let previous: string | null = null;
  for (const s of slots) {
    const band = s.band ?? "";
    const renders = bpGroupRenders(s.state, s.cells.length);
    out.push(renders && previous !== null && band !== previous);
    if (renders) previous = band;
  }
  return out;
}

export function BpSearchResults({
  slots,
  routeKey = "search",
  resetKey = "",
  viewportClassName,
}: {
  slots: BpSearchSlot[];
  routeKey?: string;
  resetKey?: string;
  /** Replaces VIEWPORT wholesale. The default assumes a parent that already
   *  pays the page gutter, exactly as the search page does today. */
  viewportClassName?: string;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [activeRow, setActiveRow] = useState(0);
  const [railShift, setRailShift] = useState(0);

  // Keys alone are not enough. The slot list is fixed for the whole query, so a
  // row that empties out under the ring would never change the signature and
  // the reflow net below would never hear about the cell it just deleted.
  const signature = useMemo(
    () =>
      bpRailSignature(
        slots.map((s) => `${s.key}:${bpGroupRenders(s.state, s.cells.length) ? "1" : "0"}`),
      ),
    [slots],
  );
  const leads = useMemo(() => railLeads(slots), [slots]);

  // Only acts when the new layout deleted the ring outright. Sources answering
  // at different speeds is the ordinary case and the rail handles that itself.
  useBpLayoutReflow({ railRef, signature, routeKey });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let lastRow = -1;

    const sync = (target?: EventTarget | null) => {
      const focused =
        (target instanceof HTMLElement ? target : null) ??
        rail.querySelector<HTMLElement>("[data-bp-focus='true']");
      const section = focused?.closest<HTMLElement>("[data-bp-rail-row]");
      if (!section) return;
      const idx = Number(section.dataset.bpRailRow ?? -1);
      if (idx < 0) return;
      // Nothing below can change while the row does not, and both writes are
      // expensive on a television: offsetTop is a forced synchronous layout taken
      // inside el.focus() with the tree already dirty, and rewriting the transform
      // of a permanently promoted layer is a paint property update per press.
      // bp-home carries the full record. Only a focusin is gated; a slot settling
      // from skeleton to cards reaches sync() through the ResizeObserver below
      // with no target, which is ungated and still re-pins the row.
      if (target && idx === lastRow) return;
      lastRow = idx;
      setActiveRow(idx);
      // Written straight to the node. Routing this through state alone made the
      // transform trail a row behind the focus that caused it.
      const shift = section.offsetTop;
      setRailShift(shift);
      rail.style.transform = `translate3d(0, ${-shift}px, 0)`;
    };

    const onFocus = (e: FocusEvent) => sync(e.target);
    sync();
    rail.addEventListener("focusin", onFocus);

    // A slot settling from skeleton to cards changes its height, which makes
    // every offsetTop below it stale. Re-pinning the focused row on the same
    // frame is what keeps a late addon from shoving the ring off screen.
    const ro = new ResizeObserver(() => sync());
    ro.observe(rail);
    for (const row of rail.querySelectorAll<HTMLElement>("[data-bp-rail-row]")) ro.observe(row);

    return () => {
      rail.removeEventListener("focusin", onFocus);
      ro.disconnect();
    };
  }, [signature]);

  // A new query rebuilds every slot. Leaving the rail parked where the last one
  // ended puts the field above a band of empty air. The ring is in the field or
  // the keyboard at this point; if it is somehow still in the rail, the sync
  // above owns the transform and this must not fight it.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    if (rail.querySelector("[data-bp-focus='true']")) return;
    setActiveRow(0);
    setRailShift(0);
    rail.style.transform = "translate3d(0, 0, 0)";
  }, [resetKey]);

  return (
    <div className={viewportClassName ?? VIEWPORT}>
      {/* No data-bp-scroll-y. The rail translates itself, and centerScroll
          early-returns for anything inside [data-bp-rail-row], so marking this a
          scroller is a lie the next reader would act on and it would not scroll
          anyway. */}
      <div
        ref={railRef}
        className={RAIL}
        style={{ transform: `translate3d(0, ${-railShift}px, 0)` }}
      >
        {slots.map((slot, i) => (
          // Indices come from position in this list, never from arithmetic, and
          // every slot is pushed whether or not it has data. A gap in
          // data-bp-rail-row breaks vertical navigation outright.
          <div
            key={slot.key}
            data-bp-rail-row={i}
            className={`ease-[var(--bp-ease)] empty:hidden motion-reduce:transition-none ${
              leads[i] ? LEAD : ""
            }${i < activeRow ? ABOVE : BELOW}`}
          >
            <BpSearchGroup
              rowKey={slot.key}
              title={slot.title}
              state={slot.state}
              shape={slot.shape}
              cells={slot.cells}
              count={slot.count}
              source={slot.source}
              portrait={slot.portrait}
              onRetry={slot.onRetry}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
