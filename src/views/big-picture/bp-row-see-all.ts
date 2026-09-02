// The two presses that open and close a row.
//
// Left at the start of a row already reached the nav. This is the other end:
// Right at the last cell reaches the row's own see-all, and Left off the see-all
// comes straight back to the cell that opened it. A remote can now walk out of
// either end of a row and walk back in.
//
// This lives outside candidatesFor on purpose. bp-row-header's data-bp-row-see-all
// is NOT a cell in the track, it is a sibling of the track, and the whole reason
// it is safe to focus is that the geometric pool never contains it. Widening
// bpTrackScope to find it would re-open the candidate pool use-bp-focus keeps
// narrow, and stripping data-bp-scroll-x from the track to put them in one scope
// would kill centerScroll's one-cell-per-press paging. An explicit hop taken only
// after a horizontal step has already dead-ended costs one querySelector on the
// presses that were going to shake the card anyway, and nothing at all on the
// ninety percent that land normally.
import { focusFirstOf, measureFocusables, type BpDir } from "./bp-focus-core";

const LINK = "[data-bp-row-see-all]";
const ROW = "[data-bp-row]";
const TRACK = "[data-bp-scroll-x]";

export function isBpRowSeeAll(el: HTMLElement | null): boolean {
  return el !== null && el.matches(LINK);
}

/**
 * Right at the end of a row: the ring goes up to that row's see-all.
 *
 * Null for every other direction and for a row with no see-all, so the caller
 * falls through to the shake exactly as it did before.
 */
export function bpSeeAllEnter(from: HTMLElement, dir: BpDir): HTMLElement | null {
  if (dir !== "right") return null;
  const row = from.closest<HTMLElement>(ROW);
  if (!row) return null;
  const link = row.querySelector<HTMLElement>(LINK);
  // Rows nest, and closest() answered with the INNERMOST one. A row with no
  // see-all of its own must not borrow the one belonging to a row inside it.
  if (!link || link === from || link.closest(ROW) !== row) return null;
  return focusFirstOf([link], { dir });
}

/**
 * Left off a see-all: back to the last cell of its own row.
 *
 * Deliberately not geometric. bpTrackScope resolves the see-all to the whole
 * row rather than to the track, because the see-all is not inside
 * [data-bp-scroll-x], so a rank from up here would pick a cell by score and
 * usually get the rightmost one right. Usually is how a remote ends up in the
 * top bar instead: score the wrong cell once and the press falls through to the
 * nav escape, which is a very long way from where Right just came.
 *
 * Reversed and offered whole rather than picked, so a cell that refuses focus
 * falls through to its neighbour instead of dropping the press.
 */
export function bpSeeAllExit(link: HTMLElement, dir: BpDir): HTMLElement | null {
  if (dir !== "left") return null;
  const track = link.closest<HTMLElement>(ROW)?.querySelector<HTMLElement>(TRACK);
  if (!track) return null;
  const cells = measureFocusables(track).map((m) => m.el);
  cells.reverse();
  return focusFirstOf(cells, { dir });
}
