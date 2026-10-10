import { useEffect, useRef, useState } from "react";
import { NO_REVERT, revealBpRows, type BpRevert } from "./bp-focus-core";
import { bpRingMoving } from "./bp-ring-motion";
import { publishBpBand, type BpBandId } from "./use-bp-sections";

// bp-tokens puts content-visibility:auto on every row without the ring, so the
// row you are about to enter has never been laid out and the browser does all
// of it inside the keypress. Measured on a Stick 4K Max that is up to 1.5s for
// one Down, and on a held key every repeat pays it again.
//
// Only ever on a row change, and only writing rows whose value actually moves.
// The first version ran on every focusin, so a horizontal press rewrote inline
// style on all twenty five rail rows and invalidated twenty five subtrees for
// no reason. A trace put UpdateLayer at 7490 events over 22 presses.
//
// Three further things it had wrong, which is why it never once warmed a row:
//
// The property has to land on the [data-bp-row] inside the rail row. The rail
// row carries data-bp-rail-row and data-bp-band and no data-bp-row, only
// [data-bp-row] is contained, and content-visibility does not inherit, so
// writing the wrapper set "visible" on an element already computing visible.
// revealBpRows owns that selector and its paired revert: never re-query either.
//
// Exactly one row, the next one in the direction of travel. Turning the
// containment off wholesale took long tasks from 70ms to 152ms, so un-skipping
// is the same poison in a smaller dose, and both neighbours is twice the dose
// for the one row you are not about to enter.
//
// And only once the ring has settled. Un-skipping swaps contain-intrinsic-size
// for the row's real height, which moves offsetTop for every row below it and
// fires the ResizeObserver that drives the rail transform, so mid-move it fights
// the move it exists to help. requestIdleCallback used to gate this, which on a
// device at 86% blocked meant it always ran late on the 240ms timeout path, in
// exactly the case it was written for.
const WARM_AFTER_MS = 220;

const SEE_ALL_OVERHANG_CLEARANCE = 12;

// Per rail, never module scope. As a module-level index this early-returned
// forever on the second visit to Home, because the fresh rail came back to the
// row number the previous one had already recorded.
function createBpWarmer(rail: HTMLElement) {
  let planned = -1;
  let revert: BpRevert = NO_REVERT;
  let timer = 0;

  const warm = (idx: number, step: number) => {
    revert();
    const next = rail.querySelector<HTMLElement>(`[data-bp-rail-row="${idx + step}"]`);
    revert = next ? revealBpRows(next) : NO_REVERT;
  };

  const at = (idx: number) => {
    if (idx === planned) return;
    // No travel to read on the first call, so guess down: it is the only way out
    // of row 0, and a restore landing mid rail still tends to continue downward.
    const step = planned >= 0 && idx < planned ? -1 : 1;
    planned = idx;
    window.clearTimeout(timer);
    // bpRingMoving is the settle authority and this timer only asks it, sitting
    // past the 190ms quiet window in bp-ring-motion so a single deliberate press
    // gets one shot while a held key keeps pushing the warm past the burst.
    const tick = () => {
      if (bpRingMoving()) {
        timer = window.setTimeout(tick, WARM_AFTER_MS);
        return;
      }
      warm(idx, step);
    };
    timer = window.setTimeout(tick, WARM_AFTER_MS);
  };

  const stop = () => {
    window.clearTimeout(timer);
    revert();
    revert = NO_REVERT;
    planned = -1;
  };

  return { at, stop };
}

export function useBpRail(signature: string): {
  railRef: React.RefObject<HTMLDivElement | null>;
  activeRow: number;
  railShift: number;
} {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [activeRow, setActiveRow] = useState(0);
  const [railShift, setRailShift] = useState(-SEE_ALL_OVERHANG_CLEARANCE);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const warmer = createBpWarmer(rail);
    // The row the last sync resolved, per rail rather than module scope for the
    // same reason createBpWarmer's index is: a second visit to Home gets a fresh
    // rail and must not inherit the previous one's row number.
    let lastRow = -1;

    const sync = (target?: EventTarget | null) => {
      const focused =
        (target instanceof HTMLElement ? target : null) ??
        rail.querySelector<HTMLElement>("[data-bp-focus='true']");
      const section = focused?.closest<HTMLElement>("[data-bp-rail-row]");
      if (!section) return;
      const idx = Number(section.dataset.bpRailRow ?? -1);
      if (idx < 0) return;
      // Only a focusin is gated, and only on an unchanged row. Every consumer
      // below already bails on an equal index, and the transform write has been
      // guarded since the Layerize-per-press trace, but section.offsetTop is a
      // forced synchronous layout and it was left running on EVERY focusin,
      // including the roughly ninety percent that are horizontal and cannot move
      // the rail. It is taken inside el.focus(), so :focus and :focus-within are
      // pending up the whole ancestor chain and revealAncestors' inline
      // content-visibility write is still applied: the tree is dirty by
      // construction and this is never a cheap read.
      //
      // sync() with NO target is the mount pass and the ResizeObserver, which
      // are exactly the cases where a row's offsetTop moved without the focus
      // changing rows, so the guard cannot go stale.
      if (target && idx === lastRow) return;
      lastRow = idx;
      setActiveRow(idx);
      // Read off the same element on the same event that drives the transform,
      // so the band and the rail can never disagree by a frame.
      publishBpBand((section.dataset.bpBand as BpBandId | undefined) ?? null);
      // Applied straight to the node: routing this through state made the
      // transform trail a row behind the focus that caused it.
      const shift = section.offsetTop - SEE_ALL_OVERHANG_CLEARANCE;
      setRailShift(shift);
      // Guarded. setActiveRow and setRailShift both bail on an equal value; this
      // was the one write that did not, and it ran on every focusin including
      // the roughly ninety percent that are horizontal and do not move the rail.
      // Dirtying the transform of a permanently promoted layer is a paint
      // property update, so it cost a Layerize per press for nothing.
      const nextTransform = `translate3d(0, ${-shift}px, 0)`;
      if (rail.style.transform !== nextTransform) rail.style.transform = nextTransform;
      warmer.at(idx);
    };

    const onFocus = (e: FocusEvent) => sync(e.target);
    sync();
    rail.addEventListener("focusin", onFocus);

    // Rows grow as their art resolves, which moves every offsetTop below them.
    // Without this the shift is stale and the active row sits part off screen
    // until the next keypress corrects it.
    const ro = new ResizeObserver(() => sync());
    ro.observe(rail);
    for (const row of rail.querySelectorAll<HTMLElement>("[data-bp-rail-row]")) ro.observe(row);

    return () => {
      rail.removeEventListener("focusin", onFocus);
      ro.disconnect();
      // Hands back the row this rail un-skipped. A renumber re-runs this effect
      // against the same DOM, so a warm left behind would be an un-skipped row
      // with no owner and nothing that would ever revert it.
      warmer.stop();
    };
  }, [signature]);

  return { railRef, activeRow, railShift };
}
