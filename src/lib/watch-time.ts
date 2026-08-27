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
  t: number;
};

const EMPTY: Ledger = { ms: 0, baseMs: 0, seeded: false, t: 0 };

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

export function seedWatchTimeBaseline(legacyMs: number): void {
  const l = read();
  if (l.seeded) return;
  l.seeded = true;
  l.baseMs = Number.isFinite(legacyMs) && legacyMs > 0 ? Math.floor(legacyMs) : 0;
  l.t = Date.now();
  write(l);
}

export function totalWatchTimeMs(): number {
  const l = read();
  return l.baseMs + l.ms;
}
