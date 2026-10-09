const RING = '[data-bp-focus="true"]';
const RAIL_ROW = "[data-bp-rail-row]";
const TRACK = "[data-bp-scroll-x]";
const GRID = "[data-bp-grid]";
const SCROLL_Y = "[data-bp-scroll-y]";

const GRID_LOOKAHEAD = 300;
const GRID_MIN_KEEP = 3;

const trackAnchor = new WeakMap<HTMLElement, number>();
const railAnchor = new WeakMap<HTMLElement, number>();

type BpGridPlan = { columns: number; keep: number; ref: number; at: Map<Element, number> };
type BpBand = { top: number; height: number; shift: number };

export type BpArtSweep = {
  root: HTMLElement | null;
  distance(el: HTMLElement): number;
  done(): void;
};

function ordinals(box: Element): Map<Element, number> {
  const at = new Map<Element, number>();
  const kids = box.children;
  for (let i = 0; i < kids.length; i += 1) at.set(kids[i], i);
  return at;
}

function cellOf(box: Element, el: HTMLElement): Element | null {
  let node: Element | null = el;
  while (node && node.parentElement !== box) node = node.parentElement;
  return node;
}

function ordinalIn(box: HTMLElement, el: HTMLElement, at: Map<Element, number>): number {
  const cell = cellOf(box, el);
  const found = cell ? at.get(cell) : undefined;
  return found === undefined ? Number.NaN : found;
}

// `shift` is zero for the normal case, a grid laid out inside a scroller, where
// the grid's own rect already moves with the scroll. When the grid IS the
// scroller its rect does not move and its rows do, so the band has to be walked
// back by scrollTop instead or the reference row is pinned at the top forever.
function bandOf(grid: HTMLElement, bands: Map<Element, BpBand>): BpBand {
  const scroller = grid.closest<HTMLElement>(SCROLL_Y);
  if (!scroller) return { top: 0, height: window.innerHeight, shift: 0 };
  const known = bands.get(scroller);
  if (known && scroller !== grid) return known;
  const band = {
    top: scroller.getBoundingClientRect().top,
    height: scroller.clientHeight,
    shift: scroller === grid ? scroller.scrollTop : 0,
  };
  bands.set(scroller, band);
  return band;
}

function planGrids(): Map<Element, BpGridPlan | null> {
  const plans = new Map<Element, BpGridPlan | null>();
  const bands = new Map<Element, BpBand>();
  for (const grid of document.querySelectorAll<HTMLElement>(GRID)) {
    const at = ordinals(grid);
    const box = grid.getBoundingClientRect();
    if (at.size === 0 || box.height < 2) {
      plans.set(grid, null);
      continue;
    }
    // Only the USED track list counts. Inside a content-visibility:auto subtree
    // the computed value can still be the authored repeat(auto-fill, minmax(...))
    // which splits into a nonsense count and mis-rows every cell under it, so an
    // unresolved list plans nothing and that grid is never released.
    const tracks = getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean);
    if (tracks.length === 0 || tracks.some((t) => !t.endsWith("px"))) {
      plans.set(grid, null);
      continue;
    }
    const columns = tracks.length;
    const pitch = Math.max(1, box.height / Math.max(1, Math.ceil(at.size / columns)));
    const band = bandOf(grid, bands);
    plans.set(grid, {
      columns,
      keep: Math.max(GRID_MIN_KEEP, Math.ceil((band.height / 2 + GRID_LOOKAHEAD) / pitch)),
      ref: Math.floor((band.top + band.height / 2 - box.top + band.shift) / pitch),
      at,
    });
  }
  return plans;
}

export function bpArtSweep(keepRows: number, keepCols: number): BpArtSweep {
  const ring = document.querySelector<HTMLElement>(RING);
  const ringRow = ring?.closest<HTMLElement>(RAIL_ROW) ?? null;
  const ringRail = ringRow?.parentElement ?? null;
  const ringAt = ringRow ? Number(ringRow.dataset.bpRailRow) : Number.NaN;
  if (ringRail && Number.isFinite(ringAt)) railAnchor.set(ringRail, ringAt);

  const plans = planGrids();
  const tracks = new Map<Element, Map<Element, number>>();

  const cellsOf = (track: HTMLElement): Map<Element, number> => {
    let known = tracks.get(track);
    if (!known) {
      known = ordinals(track);
      tracks.set(track, known);
    }
    return known;
  };

  const ringTrack = ring?.closest<HTMLElement>(TRACK) ?? null;
  if (ring && ringTrack) {
    const at = ordinalIn(ringTrack, ring, cellsOf(ringTrack));
    if (Number.isFinite(at)) trackAnchor.set(ringTrack, at);
  }

  return {
    root: ring ? (ring.closest<HTMLElement>(SCROLL_Y) ?? ringRail) : null,

    distance(el: HTMLElement): number {
      const grid = el.closest<HTMLElement>(GRID);
      if (grid) {
        const plan = plans.get(grid);
        if (!plan) return Number.NaN;
        const at = ordinalIn(grid, el, plan.at);
        if (!Number.isFinite(at)) return Number.NaN;
        return Math.abs(Math.floor(at / plan.columns) - plan.ref) - plan.keep;
      }

      const row = el.closest<HTMLElement>(RAIL_ROW);
      const rail = row?.parentElement;
      if (!row || !rail) return Number.NaN;
      const idx = Number(row.dataset.bpRailRow);
      // Row 0 when the ring has never entered this rail, the same default the
      // track uses below: a rail only ever scrolls because the ring moved in it.
      // Without it a page whose autofocus sits OUTSIDE the rail, which is every
      // catalog page with a hero, had no anchor, so every distance was NaN and
      // the sweep released nothing at all in the state a page load settles into.
      const from =
        rail === ringRail && Number.isFinite(ringAt) ? ringAt : (railAnchor.get(rail) ?? 0);
      if (!Number.isFinite(idx)) return Number.NaN;
      const over = Math.abs(idx - from) - keepRows;

      const track = el.closest<HTMLElement>(TRACK);
      if (!track) return over;
      const at = ordinalIn(track, el, cellsOf(track));
      if (!Number.isFinite(at)) return over;
      return Math.max(over, Math.abs(at - (trackAnchor.get(track) ?? 0)) - keepCols);
    },

    done(): void {
      plans.clear();
      tracks.clear();
    },
  };
}
