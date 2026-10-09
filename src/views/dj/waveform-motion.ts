const LOCK_TAU = 2.5;
const REST_TAU = 0.12;
const CATCH = 0.25;
const SEEK_STEP = 0.35;
const LAND_GAP = 0.5;
const LATCH_MS = 1200;
const LATCH_EPS = 0.25;
const MAX_STEP = 0.1;

type Scroll = {
  shown: number;
  sample: number;
  primed: boolean;
  held: number | null;
  aim: number | null;
  since: number;
};

type Frame = {
  elapsed: number;
  truth: number;
  rate: number;
  playing: boolean;
  length: number;
  now: number;
};

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

export function createScroll(): Scroll {
  return { shown: 0, sample: 0, primed: false, held: null, aim: null, since: 0 };
}

export function resetScroll(scroll: Scroll): void {
  scroll.primed = false;
  scroll.held = null;
  scroll.aim = null;
  scroll.shown = 0;
  scroll.sample = 0;
}

export function holdScroll(scroll: Scroll, seconds: number): void {
  scroll.held = seconds;
  scroll.aim = null;
}

export function settleScroll(scroll: Scroll, seconds: number, now: number): void {
  scroll.held = seconds;
  scroll.aim = seconds;
  scroll.since = now;
}

export function stepScroll(scroll: Scroll, frame: Frame): number {
  const top = frame.length > 0 ? frame.length : Number.POSITIVE_INFINITY;
  const elapsed = clamp(frame.elapsed, 0, MAX_STEP);
  const truth = clamp(frame.truth, 0, top);
  const pace = frame.playing ? elapsed * frame.rate : 0;
  const jumped = Math.abs(truth - (scroll.sample + pace)) > SEEK_STEP;
  scroll.sample = truth;

  if (!scroll.primed) {
    scroll.primed = true;
    if (scroll.held === null) {
      scroll.shown = truth;
      return truth;
    }
  }

  if (scroll.held !== null) {
    const rolled = scroll.aim !== null && frame.playing ? (frame.now - scroll.since) / 1000 : 0;
    const here = clamp(scroll.held + rolled * frame.rate, 0, top);
    if (scroll.aim === null) {
      scroll.shown = here;
      return here;
    }
    const landed = Math.abs(truth - clamp(scroll.aim + rolled * frame.rate, 0, top)) <= LATCH_EPS;
    const expired = frame.now - scroll.since > LATCH_MS;
    if (!landed && !expired) {
      scroll.shown = here;
      return here;
    }
    scroll.held = null;
    scroll.aim = null;
    scroll.shown = landed ? here : truth;
    return scroll.shown;
  }

  if (jumped) {
    scroll.shown = truth;
    return truth;
  }

  const next = scroll.shown + pace;
  const gap = truth - next;
  if (Math.abs(gap) > LAND_GAP) {
    scroll.shown = truth;
    return truth;
  }
  const pull = gap * (1 - Math.exp(-elapsed / (frame.playing ? LOCK_TAU : REST_TAU)));
  const room = frame.playing ? elapsed * frame.rate * CATCH : Math.abs(pull);
  scroll.shown = clamp(next + clamp(pull, -room, room), 0, top);
  return scroll.shown;
}
