// Accumulated watch time, in ms of media actually played on this device.
//
// Profile "watch time" used to be derived from resume positions plus the
// Stremio library's overallTimeWatched. Neither is a running total: finishing
// a video clears its resume entry, and overallTimeWatched only moves when the
// library row switches to a different video. So the number froze the moment
// someone started finishing things. This ledger is the running total.
const KEY = "harbor.watchtime.v1";

type Ledger = {
  ms: number;
  // One-time seed from the old heuristic so the visible total never drops
  // below what the profile already showed before this ledger existed.
  baseMs: number;
  seeded: boolean;
  // Second one-shot raise to the movies/episodes estimate the profile pill
  // used to show, so switching the pill to tracked time never lowers it.
  estSeeded: boolean;
  t: number;
};

const EMPTY: Ledger = { ms: 0, baseMs: 0, seeded: false, estSeeded: false, t: 0 };

function read(): Ledger {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<Ledger>;
    return {
      ms: typeof p.ms === "number" && Number.isFinite(p.ms) && p.ms > 0 ? p.ms : 0,
      baseMs:
        typeof p.baseMs === "number" && Number.isFinite(p.baseMs) && p.baseMs > 0 ? p.baseMs : 0,
      seeded: p.seeded === true,
      estSeeded: p.estSeeded === true,
      t: typeof p.t === "number" ? p.t : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

function write(l: Ledger): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* noop */
  }
}

export function addWatchTimeMs(deltaMs: number): void {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return;
  const l = read();
  l.ms += Math.floor(deltaMs);
  l.t = Date.now();
  write(l);
}

export function seedWatchTimeBaseline(legacyMs: number, estimateMs: number): void {
  const l = read();
  const legacy = Number.isFinite(legacyMs) && legacyMs > 0 ? Math.floor(legacyMs) : 0;
  const est = Number.isFinite(estimateMs) && estimateMs > 0 ? Math.floor(estimateMs) : 0;
  let changed = false;
  if (!l.seeded) {
    l.seeded = true;
    l.baseMs = Math.max(l.baseMs, legacy);
    changed = true;
  }
  if (!l.estSeeded) {
    l.estSeeded = true;
    if (est > l.baseMs + l.ms) l.baseMs = est - l.ms;
    changed = true;
  }
  if (!changed) return;
  l.t = Date.now();
  write(l);
}

export function totalWatchTimeMs(): number {
  const l = read();
  return l.baseMs + l.ms;
}
