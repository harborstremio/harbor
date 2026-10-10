// The horizontal row scroll, owned rather than handed to the browser.
//
// centerScroll jumped the track in one frame on every horizontal press, which is
// roughly ninety percent of all presses. Its own comment rejected
// behavior:"smooth" for the right reason, that the browser owns a duration we
// cannot shorten, and then named the answer for the vertical rail one line
// later: it is a transform, it is ours to time. This is that answer applied to
// the axis the viewer actually travels along. A Right press used to animate
// exactly one thing, a card growing six percent, because the row fade is zeroed
// on television. Now the ring stays put and the shelf glides under it, which is
// what a set-top box feels like. A teleporting shelf reads as a page redraw.
//
// UNMEASURED ON DEVICE. Nobody has run this on a Stick 4K Max. The cost model
// says it should be close to free, because a programmatic scrollLeft write is a
// compositor scroll rather than a repaint and the rejected behavior:"smooth"
// would have done the same work, but that is an argument and not a number. If a
// bench ever shows horizontal travel getting worse, set DUR_MS to 0: every press
// then takes the snap path below and the behaviour is exactly what shipped
// before this file existed.
const DUR_MS = 190;

// Two presses closer together than this on the same track are a hold, not two
// decisions, so the second one snaps. Android autorepeats at about ninety
// milliseconds and use-bp-focus gates repeats to the same interval, so a glide
// would otherwise be cancelled and restarted eleven times a second and never
// travel anywhere. Same doctrine as bp-ring-motion: a burst collapses.
const BURST_MS = 200;

// Mirrors --bp-ease, cubic-bezier(0.22, 1, 0.36, 1), which is an ease-out quint
// to within a pixel over this distance. A real bezier solver here would be forty
// lines to move a number that nobody can see the difference in.
function ease(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

type Glide = { raf: number; last: number };

const live = new WeakMap<HTMLElement, Glide>();

/**
 * True while this track is mid-glide.
 *
 * TRAP, and it is the reason this is exported. bp-row pages ten more tiles in
 * from the track's own scroll event. A jump fires that event once per press; a
 * glide fires it on every frame, and setShown adds a CHUNK each time, so one
 * press would have mounted a hundred tiles instead of ten. That is the
 * twenty-simultaneous-decode regression arriving through a new door. The row
 * listener asks this and declines while a glide is running, and the final frame
 * below clears the entry BEFORE its last write so the settling scroll event
 * still pages exactly once.
 */
export function bpTrackGliding(track: HTMLElement): boolean {
  return (live.get(track)?.raf ?? 0) !== 0;
}

function stop(g: Glide | undefined): void {
  if (g && g.raf !== 0) {
    cancelAnimationFrame(g.raf);
    g.raf = 0;
  }
}

/**
 * Scroll `track` to `to`, over time when the press was a decision and instantly
 * when it was part of a hold.
 *
 * The caller computes `to` from a rect it has already read, and that arithmetic
 * is scroll-position invariant (scrollLeft + (e.left - t.left) is the element's
 * offset inside the scroll content), so a target computed mid-glide is correct
 * and no snap-to-previous-target guard is needed before the measurement.
 */
export function glideBpTrack(track: HTMLElement, to: number, reduce: boolean): void {
  const isRtl = getComputedStyle(track).direction === "rtl";
  const max = Math.max(0, track.scrollWidth - track.clientWidth);
  const target = isRtl ? Math.max(-max, Math.min(to, 0)) : Math.max(0, Math.min(to, max));
  const now = performance.now();
  const g = live.get(track);
  const from = track.scrollLeft;
  const burst = g !== undefined && now - g.last < BURST_MS;

  stop(g);
  const entry: Glide = { raf: 0, last: now };
  live.set(track, entry);

  if (reduce || burst || DUR_MS <= 0 || Math.abs(target - from) < 2) {
    track.scrollLeft = target;
    return;
  }

  const start = now;
  const step = () => {
    const p = Math.min(1, (performance.now() - start) / DUR_MS);
    if (p >= 1) {
      // Cleared BEFORE the last write on purpose. The scroll event this write
      // queues is what bp-row pages on, and it must arrive with the guard down.
      entry.raf = 0;
      track.scrollLeft = target;
      return;
    }
    track.scrollLeft = from + (target - from) * ease(p);
    entry.raf = requestAnimationFrame(step);
  };
  entry.raf = requestAnimationFrame(step);
}
