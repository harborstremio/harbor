import { bpArtSweep } from "./bp-art-distance";

// How long after the last move the ring counts as settled. Long enough to span
// a held key, which Android autorepeats at roughly ninety milliseconds, short
// enough that a single deliberate press never feels like it withheld anything.
const QUIET_MS = 190;

// A held direction key is the worst case Big Picture has. Traced on a Fire TV
// Stick 4K Max over twenty two repeats: one ImageDecodeTask per press at 38.7ms,
// 2.2s of decode across the burst, on top of 2.3s of garbage collection from the
// churn. Every one of those decodes was a poster for a card the ring passed
// through in ninety milliseconds and the viewer never looked at.
//
// So art waits for the ring to stop. This is the whole mechanism: one flag, set
// by applyBpFocus, cleared on a timer.
let moving = false;
let timer = 0;
const subs = new Set<() => void>();

function publish(): void {
  for (const fn of subs) fn();
}

// The velocity-modulated durations are GONE, and this comment is the reason,
// because the idea is tempting enough that someone will try it again.
//
// setDurations wrote three inherited custom properties on [data-bp-root]. That
// looks like three cheap style writes. Measured in isolation on a Fire TV Stick
// 4K Max, ten iterations reading a rect immediately after each write:
//
//     plain read, nothing dirtied                        0.1ms
//     rewriting the SAME custom property values          0.1ms
//     flipping a plain attribute on [data-bp-root]       0.0ms
//     changing --bp-focus-dur/--bp-rail-dur/--bp-dur   104.8ms median, 139.3 max
//
// Everything under the root inherits those, so a genuine change invalidates
// style for the whole subtree: 105ms, once per change.
//
// It was meant to cost that twice per burst, entering and leaving. It did not.
// QUIET_MS is 190ms, so as soon as one press blocks longer than that the settle
// timer becomes due while keydowns are still queued behind the blocked main
// thread, the settle wins the race, and 105ms fires mid-hold. Each stall then
// manufactures the next one. Attributed over eight presses, two of them cost
// 316.8ms and 272.9ms: 82 percent of all forced layout on the hold path.
//
// And it bought nothing even when it worked. Measured before removal: held-key
// long tasks 140 against 136 with it, inside the run-to-run band.
//
// If someone wants burst-collapsed motion again, do NOT do it with inherited
// custom properties on the root. Key it off an attribute and a rule that
// references that attribute, and measure the invalidation cost of that rule
// before shipping it, because the cost depends entirely on what selectors read
// the attribute, not on the attribute write itself.
export function markBpRingMoved(): void {
  window.clearTimeout(timer);
  // Two states, not a continuum. A per-press scaled value would be a different
  // number nearly every press, so the guard above would never hit and every
  // move would pay the invalidation it exists to avoid.
  if (!moving) {
    moving = true;
    publish();
  }
  timer = window.setTimeout(() => {
    moving = false;
    releaseFar();
    flush();
    publish();
  }, QUIET_MS);
}

export function bpRingMoving(): boolean {
  return moving;
}

// Deliberately not a hook. A hook here would put 262 subscribers on the home
// screen and re-render every one of them twice per move, which costs more than
// the decodes it saves. Tiles hand their img element over instead and the src
// is assigned imperatively, so a move touches only the elements that are
// actually waiting on art.
const queued = new Map<HTMLImageElement, string>();

// A 1x1 transparent gif, and it must be a real image rather than a cleared src.
// removeAttribute("src") makes the selected source null, which fires `error`,
// which bp-tile wires to art.onError, which adds the url to the broken set,
// which flips `missing`, which fires hydrateLibraryMeta. One bad release leaves
// that tile permanently blank AND makes a network call; across a hundred and
// thirty tiles that is a visibly broken home screen with nothing in any log.
// This fires `load` instead, and `loaded` is already true so React bails.
const BLANK =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

// Measured on device: 167 poster tiles, each already at the correct small tier,
// 300x450 at 0.515MB decoded, for 86MB of the 127MB resident. The art is not
// oversized. There is simply far more of it mounted than a stick can hold, so
// the browser evicts and re-decodes continuously, which is the GC line, the
// decode churn and the held-key collapse all at once. Stremio avoids this by
// mounting ten items a row and rendering placeholders with no img at all.
//
// Harbor keeps its rows scrollable, so instead the bitmap goes: a tile far from
// the viewport keeps its element, its box and its focusability, and loses only
// the pixels. Everything the focus engine measures is on the button, not the
// image, so releasing changes nothing it can see.
const wanted = new WeakMap<HTMLImageElement, string>();
const watched = new Set<HTMLImageElement>();

// Two observers with different margins, not one, and a release that only ever
// happens inside the far observer's own callback.
//
// The first version armed on a single margin and then released, on settle,
// anything missing from a `near` set. That set is written asynchronously by the
// observer, so a card scrolled into view a frame earlier was not in it yet and
// got released while it was on screen: the focused card and its two neighbours
// went blank. Never decide to release from a snapshot the observer has not
// caught up with.
//
// Hysteresis matters as much as the ordering. Arming and releasing on the same
// boundary makes a card that sits near the edge re-decode every time the row
// twitches, and a decode is 27 to 40ms. The drop margin is far wider than the
// arm margin, so a card has to travel a long way past useful before it costs
// anything to bring back.
// NOT IntersectionObserver. This is the trap that cost a visibly broken home
// screen: bp-tokens puts content-visibility:auto on every row without the ring,
// and a skipped subtree is INVISIBLE to IntersectionObserver, which reports it
// as not intersecting. So every unfocused row was released even while on
// screen, and could never re-arm, because the observer still could not see it.
// Measured: 14 of 24 on-screen tiles blank, 212 held, 8 armed.
//
// Distance in rail rows is the thing content-visibility cannot hide. It is an
// integer read off an attribute the focus engine already maintains, it costs no
// layout, and it means exactly what we want it to mean: how far the ring would
// have to travel to look at this.
const KEEP_ROWS = 2;
const KEEP_COLS = 9;

function arm(el: HTMLImageElement): void {
  const url = wanted.get(el);
  if (!url || el.dataset.bpArt === url) return;
  delete el.dataset.bpHeld;
  el.dataset.bpArt = url;
  el.src = url;
  queued.delete(el);
}

declare global {
  interface Window {
    __bpArtCancelled?: { count: number; urls: string[] };
  }
}

// INSTRUMENTATION, not a fix, and it has to be read before release() is touched.
//
// Eleven images per cold anime load report net::ERR_FAILED, and metahub answers
// every one of those urls with a 200, so the urls are not dead and bp-art is not
// minting bad links. An aborted image load is what net::ERR_FAILED means in a
// network trace, and this function is the only place Big Picture aborts one: a
// release assigns BLANK over a first load that is still in flight.
//
// `complete` is false only while a load is outstanding, so this counts exactly
// the loads Harbor cancels itself. Read window.__bpArtCancelled over harbor_eval
// after a cold anime load. Near eleven means the finding is ours and release()
// should wait for the element's own load event; near zero means it is not, and
// changing release() would risk the banked memory work for nothing.
const cancelled: { count: number; urls: string[] } = { count: 0, urls: [] };
const CANCELLED_LOG = 40;

if (typeof window !== "undefined") window.__bpArtCancelled = cancelled;

function release(el: HTMLImageElement): void {
  if (el.dataset.bpHeld === "1") return;
  const url = el.dataset.bpArt;
  if (!url) return;
  // The ring is never allowed to be looking at a blank card, whatever any
  // observer thinks. Cheap: one closest() on an element already being released.
  if (el.closest('[data-bp-focus="true"]')) return;
  if (!el.complete) {
    cancelled.count += 1;
    if (cancelled.urls.length < CANCELLED_LOG) cancelled.urls.push(url);
  }
  el.dataset.bpHeld = "1";
  delete el.dataset.bpArt;
  queued.delete(el);
  el.src = BLANK;
}

const IDLE_MS = 400;
const SWEEP_BUDGET = 40;
const NEAREST = -1e9;

let dirty = false;
let idle = 0;
let sweeps = SWEEP_BUDGET;
let sweptRoot: HTMLElement | null | undefined;

function onIdle(): void {
  idle = 0;
  if (moving) {
    idle = window.setTimeout(onIdle, IDLE_MS);
    return;
  }
  if (!dirty) return;
  sweeps -= 1;
  releaseFar();
}

function markDirty(): void {
  dirty = true;
  if (idle || sweeps <= 0) return;
  idle = window.setTimeout(onIdle, IDLE_MS);
}

/**
 * The hold flag is not optional.
 *
 * bp-tile passes this as an inline arrow ref, so React calls it on EVERY render,
 * and a tile re-renders on settings, visibility, badges, card state and glow.
 * Clearing only dataset.bpArt means the next incidental render re-assigns the
 * src and the release silently evaporates.
 */
export function bpArtSrc(el: HTMLImageElement | null, url: string | undefined): void {
  if (!el || !url) return;
  if (!watched.has(el) || wanted.get(el) !== url) markDirty();
  wanted.set(el, url);
  watched.add(el);
  if (el.dataset.bpHeld === "1") return;
  if (el.dataset.bpArt === url) return;
  if (!moving) {
    arm(el);
    return;
  }
  queued.set(el, url);
}

/**
 * Rows more than KEEP_ROWS from the ring give their pixels back; rows within it
 * take them. Run on settle and on the idle sweep, never mid-move, so a held key
 * never pays for it and a card is never released in the frame the ring is
 * arriving at.
 */
function releaseFar(): void {
  dirty = false;
  const sweep = bpArtSweep(KEEP_ROWS, KEEP_COLS);
  if (sweep.root !== sweptRoot) {
    sweptRoot = sweep.root;
    sweeps = SWEEP_BUDGET;
  }
  try {
    const back: { el: HTMLImageElement; d: number }[] = [];
    const far: HTMLImageElement[] = [];
    for (const el of watched) {
      if (!el.isConnected) {
        watched.delete(el);
        continue;
      }
      // A tile outside any rail row, a grid cell or an overlay, is never released.
      // There is no distance to reason about and being wrong means a blank card.
      const over = sweep.distance(el);
      if (over > 0) {
        far.push(el);
        continue;
      }
      // Re-arming used to happen right here, in this loop, for every element the
      // move brought back inside the window. That is the twenty-simultaneous-
      // decode regression recorded below arriving through the other door: a row
      // change promotes a whole row at once (CHUNK is 10), and arm() ends with
      // queued.delete(el), so a re-arm could never reach the flush that exists to
      // pace exactly this. The pacer only ever guarded the departure path.
      const url = wanted.get(el);
      if (!url || el.dataset.bpArt === url) continue;
      // Already in the flush's own queue, which is paced and runs immediately
      // after this. Collecting it here as well would assign the same src twice.
      if (queued.has(el)) continue;
      // An unknown distance sorts first, for the same reason it is never
      // released: there is nothing to reason about and being wrong shows a blank.
      const d = Number.isFinite(over) ? over : NEAREST;
      back.push({ el, d });
    }
    // Nearest row first, so the row the ring has just landed on arms in the first
    // stepped frame. blankOnScreen is the acceptance test for this mechanism, not
    // the memory number, and this sort is what protects it.
    for (const el of far) release(el);
    back.sort((a, b) => a.d - b.d);
    rearm(back.map((n) => n.el));
  } finally {
    sweep.done();
  }
}

// Released a few per frame, never all at once. Assigning every held src in one
// go turned a row change into about twenty simultaneous decodes: measured on a
// Fire TV Stick 4K Max that took a Down press from 49ms to 1946ms, which is
// worse than the problem the holding solved. Three a frame keeps the decoder
// busy without ever handing the compositor a burst it cannot finish inside a
// frame, and a new move parks whatever is left rather than competing with it.
const PER_FRAME = 3;
let flushing = false;

// ONE ration per frame, shared by both steppers. A settle runs releaseFar() and
// then flush(), which are two independent rAF loops, so a settle carrying both
// arrivals and re-arrivals was assigning six srcs a frame: twice the rate the
// measurement above says a frame can absorb. rAF hands every callback in a
// frame the same timestamp, which is what makes this one line of arithmetic
// enough to keep them honest with each other.
let frameAt = 0;
let frameLeft = PER_FRAME;

function spend(now: number): boolean {
  if (now !== frameAt) {
    frameAt = now;
    frameLeft = PER_FRAME;
  }
  if (frameLeft <= 0) return false;
  frameLeft -= 1;
  return true;
}

// The arrival half of the same pacing, for the tiles a row change brings back
// inside the window.
//
// TRAP: this calls arm() per frame rather than pushing into `queued` and
// letting flush() drain it, and the shortcut is not available. flush() writes
// dataset.bpArt and src but never clears dataset.bpHeld, so an element re-armed
// through it would stay held for good: release() early-returns on held, and so
// does bpArtSrc, so that tile keeps whatever art it has and every later url
// change misses it silently. Nothing can reach that today only because
// bpArtSrc refuses to queue a held element. Routing re-arms through the queue
// is what would activate it.
let rearmSeq = 0;

function rearm(list: HTMLImageElement[]): void {
  if (list.length === 0) return;
  // A move smaller than one frame's ration would pay the stepper's latency for
  // nothing, and a single card arriving late is the blank this mechanism exists
  // to avoid. It is off whenever a flush is pending or running, because this
  // runs inside the settle timer rather than inside a frame, so it cannot see
  // the ration the flush is about to spend.
  if (list.length <= PER_FRAME && queued.size === 0 && !flushing) {
    for (const el of list) arm(el);
    return;
  }
  rearmSeq += 1;
  const mine = rearmSeq;
  let i = 0;
  const step = (now: number) => {
    // A newer settle owns the arrivals now, or the ring set off again. Nothing
    // is handed back: the next settle re-walks `watched` and collects whatever
    // is still unarmed, which is the same list minus what has already landed.
    if (mine !== rearmSeq || moving) return;
    while (i < list.length && spend(now)) {
      const el = list[i];
      i += 1;
      if (el.isConnected) arm(el);
    }
    if (i < list.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function flush(): void {
  if (flushing) return;
  const pending = [...queued.entries()];
  queued.clear();
  if (pending.length === 0) return;
  flushing = true;
  let i = 0;
  const step = (now: number) => {
    if (moving) {
      // The ring set off again. Hand the rest back and wait for the next settle.
      for (; i < pending.length; i += 1) queued.set(pending[i][0], pending[i][1]);
      flushing = false;
      return;
    }
    while (i < pending.length && spend(now)) {
      const [el, url] = pending[i];
      i += 1;
      if (!el.isConnected) continue;
      el.dataset.bpArt = url;
      el.src = url;
    }
    if (i < pending.length) requestAnimationFrame(step);
    else flushing = false;
  };
  requestAnimationFrame(step);
}
