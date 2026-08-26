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

type PressureListener = (high: boolean) => void;
const pressureListeners = new Set<PressureListener>();
let pressureHigh = false;

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

function pollPressure(): void {
  const rss = getNativeRssMB();
  if (rss > 0) {
    const ceiling = tierCeilingMB(getRamTier());
    if (!pressureHigh && rss > ceiling) setPressure(true);
    else if (pressureHigh && rss < ceiling * 0.7) setPressure(false);
    return;
  }
  const mb = readHeapMB();
  if (mb == null) return;
  if (!pressureHigh && mb > PRESSURE_HIGH_MB) setPressure(true);
  else if (pressureHigh && mb < PRESSURE_LOW_MB) setPressure(false);
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

  let pressureInterval: number | null = null;
  const startPressurePolling = () => {
    if (pressureInterval != null || document.visibilityState === "hidden") return;
    pollPressure();
    pressureInterval = window.setInterval(pollPressure, PRESSURE_POLL_MS);
  };
  const stopPressurePolling = () => {
    if (pressureInterval == null) return;
    window.clearInterval(pressureInterval);
    pressureInterval = null;
  };
  startPressurePolling();
  const stopNative = startNativeMemory();
  const unsubNative = subscribeNativeMemory(pollPressure);

  let hiddenTimer: number | null = null;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      stopPressurePolling();
      hiddenTimer = window.setTimeout(() => runMaintenance(isMemoryPressureHigh()), HIDDEN_GRACE_MS);
    } else {
      startPressurePolling();
      if (hiddenTimer != null) {
        window.clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    started = false;
    window.clearInterval(interval);
    stopPressurePolling();
    stopNative();
    unsubNative();
    if (hiddenTimer != null) window.clearTimeout(hiddenTimer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
