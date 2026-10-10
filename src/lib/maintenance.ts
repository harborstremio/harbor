import {
  getNativeRssMB,
  getRamTier,
  startNativeMemory,
  subscribeNativeMemory,
  type RamTier,
} from "./native-memory";
import { pulseWebviewMemoryLow } from "./webview-memory";

type Evictor = (aggressive: boolean) => void;

const evictors = new Map<string, Evictor>();

export function registerEvictable(name: string, evict: Evictor): void {
  evictors.set(name, evict);
}

export function runMaintenance(aggressive = false): void {
  for (const evict of evictors.values()) {
    try {
      evict(aggressive);
    } catch {}
  }
  void gcNativeSessions();
}

async function gcNativeSessions(): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("proxy_gc_idle");
  } catch {}
}

export function purgeNow(): void {
  runMaintenance(true);
}

const INTERVAL_MS = 5 * 60 * 1000;
const HIDDEN_GRACE_MS = 30 * 1000;
const AGGRESSIVE_HEAP_DELTA_MB = 350;

const PRESSURE_POLL_MS = 8 * 1000;
const PRESSURE_HIGH_MB = 460;
const PRESSURE_LOW_MB = 330;

/** How many polls in a row have to be over the ceiling before this counts as pressure.
 *
 * One reading over the line is a spike — a poster decode, a garbage collection not yet run, a page
 * the plugin runtime is parsing — and acting on it throws away the view the user was just looking
 * at. Requiring three readings in a row means pressure has to last about half a minute before any
 * view is discarded for it, which a spike does not.
 *
 * Coming *out* of pressure needs no such patience: the first reading back under the line releases
 * it, because holding the state costs nothing and releasing it early only means views are kept. */
const PRESSURE_POLLS_TO_TRIGGER = 3;

type PressureListener = (high: boolean) => void;
const pressureListeners = new Set<PressureListener>();
let pressureHigh = false;
let overCeilingPolls = 0;

function readHeapMB(): number | null {
  const mem = performance.memory;
  return mem ? mem.usedJSHeapSize / (1024 * 1024) : null;
}

function tierCeilingMB(tier: RamTier): number {
  switch (tier) {
    case "tiny":
      return 700;
    case "low":
      return 1100;
    case "mid":
      return 1600;
    default:
      return 2500;
  }
}

function setPressure(high: boolean): void {
  if (high === pressureHigh) return;
  pressureHigh = high;
  for (const cb of pressureListeners) {
    try {
      cb(high);
    } catch {}
  }
  if (high) {
    runMaintenance(true);
    pulseWebviewMemoryLow();
  }
}

/** Whether the native reading is over its ceiling, or null when there is no reading.
 *
 * There is a gap between the level that counts as over and the level that releases it, so a reading
 * sitting on the line does not flap the state on every poll. */
function overNativeCeiling(rssMB: number): boolean {
  if (rssMB <= 0) return false;
  const ceiling = tierCeilingMB(getRamTier());
  return pressureHigh ? rssMB >= ceiling * 0.7 : rssMB > ceiling;
}

/** The fallback reading, with the same kind of gap of its own. Null when the heap cannot be read. */
function overHeapCeiling(): boolean | null {
  const mb = readHeapMB();
  if (mb == null) return null;
  return pressureHigh ? mb >= PRESSURE_LOW_MB : mb > PRESSURE_HIGH_MB;
}

function pollPressure(): void {
  const rss = getNativeRssMB();
  if (rss > 0) {
    const over = overNativeCeiling(rss);
    if (!pressureHigh) {
      // Three readings in a row, so a spike cannot discard a view on its own.
      overCeilingPolls = over ? overCeilingPolls + 1 : 0;
      if (overCeilingPolls >= PRESSURE_POLLS_TO_TRIGGER) setPressure(true);
      return;
    }
    // Out on the first reading under the line: holding the state costs nothing.
    overCeilingPolls = 0;
    if (!over) setPressure(false);
    return;
  }
  const over = overHeapCeiling();
  if (over === null) return;
  if (!pressureHigh) {
    overCeilingPolls = over ? overCeilingPolls + 1 : 0;
    if (overCeilingPolls >= PRESSURE_POLLS_TO_TRIGGER) setPressure(true);
    return;
  }
  overCeilingPolls = 0;
  if (!over) setPressure(false);
}

export function subscribeMemoryPressure(cb: PressureListener): () => void {
  pressureListeners.add(cb);
  cb(pressureHigh);
  return () => {
    pressureListeners.delete(cb);
  };
}

export function isMemoryPressureHigh(): boolean {
  return pressureHigh;
}

let started = false;

export function startMaintenance(): () => void {
  if (started) return () => {};
  started = true;

  const heapDelta = (): number => {
    const api = window.__harborProfiler;
    return api ? api.getHeapMB() - api.getBaselineMB() : 0;
  };

  const interval = window.setInterval(() => {
    runMaintenance(heapDelta() > AGGRESSIVE_HEAP_DELTA_MB);
  }, INTERVAL_MS);

  const pressureInterval = window.setInterval(pollPressure, PRESSURE_POLL_MS);
  const stopNative = startNativeMemory();
  const unsubNative = subscribeNativeMemory(pollPressure);

  let hiddenTimer: number | null = null;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenTimer = window.setTimeout(() => runMaintenance(isMemoryPressureHigh()), HIDDEN_GRACE_MS);
    } else if (hiddenTimer != null) {
      window.clearTimeout(hiddenTimer);
      hiddenTimer = null;
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    started = false;
    window.clearInterval(interval);
    window.clearInterval(pressureInterval);
    stopNative();
    unsubNative();
    if (hiddenTimer != null) window.clearTimeout(hiddenTimer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
