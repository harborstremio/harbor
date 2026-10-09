import { useEffect } from "react";
import { isBpFocusable, type BpDir } from "../bp-focus-core";
import { setBpOnboardKeyHandler } from "./bp-onboard-key";
import { focusBpOnboardPrimary } from "./bp-onboard-ring";

/**
 * Down walks the screen and a held Down leaves it. Every press steps one row,
 * and the press that runs out of rows lands on the primary rather than on
 * whichever action geometry happens to score first, so one sustained hold
 * sweeps the longest step here onto Continue in about two thirds of a second.
 *
 * No repeat counter and no cadence test. Both were built and both were wrong.
 * Counting repeats ejects out of a six row list at row four, so the rows the
 * hold was meant to cross became unreachable while the key was down. Treating
 * "two presses inside 140ms" as a hold fires on ordinary fast tapping and
 * steals a press mid list, and on a pad it never fires at all because the pad's
 * own repeat interval defaults to exactly that number. e.repeat is the only
 * signal that separates a hold from taps, which is why dispatchTvNav now
 * carries it.
 *
 * The action rail is not a sibling of the decision rows and bpRailStep resolves
 * a rail as row.parentElement, so the two can never share an index space. That
 * is why this is a key handler and not a rail index.
 */

const PRIMARY = "[data-bp-onboard-primary]";
const DECISION_RING = "[data-bp-onboard-decision] [data-bp-focus='true']";
const MARK = "[data-bp-focus='true']";
const FOCUSABLE = "[data-bp-focusable]:not([data-bp-disabled='true'])";
const COLUMN = "[data-bp-onboard-decision]";
const TRACK = "[data-bp-scroll-x]";
const GRID = "[data-bp-grid]";

function holdsFocusable(el: HTMLElement): boolean {
  return isBpFocusable(el) || el.querySelector(FOCUSABLE) !== null;
}

/**
 * A grid's cells are all siblings, so a sibling walk answers "something is
 * below" for every cell but the very last one and the whole last row then
 * scores Skip and Continue against each other by horizontal distance. The
 * declared column count turns that into arithmetic. A grid that does not
 * declare one falls through to the walk below rather than guessing.
 */
function gridHasRowBelow(grid: HTMLElement, ring: HTMLElement): boolean | null {
  const cols = Number(grid.dataset.bpGridCols ?? 0);
  if (!Number.isFinite(cols) || cols < 1) return null;
  const cells = Array.from(grid.querySelectorAll<HTMLElement>(FOCUSABLE));
  const at = cells.indexOf(ring);
  if (at < 0 || cells.length === 0) return null;
  return at < cells.length - (((cells.length - 1) % cols) + 1);
}

/**
 * Structure, never measurement. content-visibility:auto on every row not
 * holding the ring means asking "is anything below me" with a rect costs a full
 * reveal, while querySelector still sees inside skipped content for free.
 */
function hasFocusableBelow(ring: HTMLElement): boolean {
  const grid = ring.closest<HTMLElement>(GRID);
  const byIndex = grid ? gridHasRowBelow(grid, ring) : null;
  if (byIndex !== null) return byIndex;

  const stop = ring.closest<HTMLElement>(COLUMN);
  // Start at the horizontal track, never at the ring itself. Everything inside
  // a [data-bp-scroll-x] sits beside the ring, so a sibling walk that begins on
  // the cell answers "something is below" for every chip but the last in its
  // row and the deterministic last press then never fires.
  let node: HTMLElement | null = ring.closest<HTMLElement>(TRACK) ?? ring;
  while (node && node !== stop) {
    const at = Number(node.dataset.bpRailRow ?? NaN);
    // Annotated on purpose. Without it the branch below assigns rail to node,
    // so node's narrowed type depends on rail and rail's on node, and tsc
    // reports that cycle as TS7022 implicit any rather than as the loop it is.
    const rail: HTMLElement | null = node.parentElement;
    // Indexed rows first: language reorders itself with flex `order`, so DOM
    // order is not visual order there and only the index reads the real one.
    if (Number.isFinite(at) && rail) {
      for (const sib of rail.querySelectorAll<HTMLElement>("[data-bp-rail-row]")) {
        if (Number(sib.dataset.bpRailRow) > at && holdsFocusable(sib)) return true;
      }
      node = rail;
      continue;
    }
    for (let sib = node.nextElementSibling; sib; sib = sib.nextElementSibling) {
      if (holdsFocusable(sib as HTMLElement)) return true;
    }
    node = node.parentElement;
  }
  return false;
}

function onOnboardDir(dir: BpDir, repeat: boolean): boolean {
  // Up out of the rail stays geometric and lands in the last decision row, and
  // horizontal stays trapped in its track, which is what every other Big
  // Picture surface teaches. This claims Down and nothing else.
  if (dir !== "down") return false;

  const primary = document.querySelector<HTMLElement>(PRIMARY);
  if (!primary) return false;
  // A dialog layered over the frame owns navigation, the same refusal
  // focusBpTopBar makes. The leave dialog is the live case: its ring sits
  // outside the decision column, so a jump would land behind it.
  const dialogs = document.querySelectorAll<HTMLElement>("[data-bp-dialog]");
  const scope = dialogs[dialogs.length - 1];
  if (scope && !scope.contains(primary)) return false;

  const ring = document.querySelector<HTMLElement>(DECISION_RING);
  if (!ring) {
    // The tail of a hold, after the ring has already arrived on the rail.
    // Swallowing it is what stops the remaining repeats machine-gunning the
    // shake and SFX.hover. A deliberate single Down still falls through and
    // gets its one shake, which is the honest answer to "nothing below".
    const rail = primary.parentElement;
    return repeat && rail !== null && rail.querySelector(MARK) !== null;
  }

  if (hasFocusableBelow(ring)) return false;
  return focusBpOnboardPrimary({ dir: "down", silent: false });
}

export function useBpOnboardEscape(): void {
  useEffect(() => {
    setBpOnboardKeyHandler(onOnboardDir);
    // React runs every effect cleanup before any setup on a keyed swap, so the
    // outgoing frame clearing this cannot clobber the incoming frame's
    // registration. Registering from a host with a different lifetime can.
    return () => setBpOnboardKeyHandler(null);
  }, []);
}
