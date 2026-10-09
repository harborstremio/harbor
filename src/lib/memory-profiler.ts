import { bridgeRows, resetBridgeStats } from "./fetch-bridge-stats";
import {
  buildDumpText,
  type DumpCapabilities,
  type DumpDrift,
  type RenderReportRow,
} from "./memory-dump-text";
import { getNativeMem, getRamTier } from "./native-memory";

type MemoryStats = {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
};

declare global {
  interface Performance {
    memory?: MemoryStats;
  }
  interface Window {
    __harborProfiler?: ProfilerApi;
  }
}

export type SampleKind =
  | "tick"
  | "nav"
  | "fetch"
  | "click"
  | "mount"
  | "unmount"
  | "mark"
  | "warn"
  | "longtask"
  | "render";

export type Sample = {
  ts: number;
  kind: SampleKind;
  label: string;
  heapMB: number;
  domNodes: number;
  imgs: number;
  vids: number;
  detail?: Record<string, unknown>;
};

export type CacheReport = { name: string; size: number };

const MAX_SAMPLES = 600;
const TICK_INTERVAL_MS = 1000;
const REPORT_INTERVAL_MS = 5000;

const samples: Sample[] = [];
const fullHistory: Sample[] = [];
const listeners = new Set<() => void>();
const cacheGetters = new Map<string, () => number>();
const cacheSizeHistory = new Map<string, number[]>();
const navStack: { label: string; at: number; heap: number }[] = [];
let lastReportAt = 0;
let tickHandle: number | null = null;
let started = false;
let baselineHeapMB = 0;
let peakHeapMB = 0;
let networkBytes = 0;
let resetAt = 0;
let lastDumpAt = 0;
const FULL_HISTORY_MAX = 60_000;
const DRIFT_STALL_MS = 500;
let lastTickAt = 0;
let driftTicks = 0;
let maxDriftMs = 0;
let driftStalls = 0;
let hiddenTicks = 0;

function bytesToMB(b: number): number {
  return Math.round((b / 1024 / 1024) * 100) / 100;
}

function nowMs(): number {
  return performance.now();
}

function snapshotHeapMB(): number {
  const mem = performance.memory;
  if (!mem) return 0;
  return bytesToMB(mem.usedJSHeapSize);
}

function snapshotDom(): { nodes: number; imgs: number; vids: number } {
  if (typeof document === "undefined") return { nodes: 0, imgs: 0, vids: 0 };
  const nodes = document.getElementsByTagName("*").length;
  const imgs = document.images.length;
  const vids = document.getElementsByTagName("video").length;
  return { nodes, imgs, vids };
}

function pushSample(kind: SampleKind, label: string, detail?: Record<string, unknown>) {
  const heapMB = snapshotHeapMB();
  const dom = snapshotDom();
  const sample: Sample = {
    ts: Date.now(),
    kind,
    label,
    heapMB,
    domNodes: dom.nodes,
    imgs: dom.imgs,
    vids: dom.vids,
    detail,
  };
  samples.push(sample);
  fullHistory.push(sample);
  if (samples.length > MAX_SAMPLES) samples.shift();
  if (fullHistory.length > FULL_HISTORY_MAX) fullHistory.shift();
  if (heapMB > peakHeapMB) peakHeapMB = heapMB;
  if (baselineHeapMB === 0) baselineHeapMB = heapMB;
  listeners.forEach((fn) => fn());
}

export function getInstrumentationSupport(): DumpCapabilities {
  let longTasks = false;
  try {
    const types = PerformanceObserver.supportedEntryTypes as string[] | undefined;
    longTasks = Array.isArray(types) && types.includes("longtask");
  } catch {}
  return {
    jsHeap: typeof performance !== "undefined" && !!performance.memory,
    longTasks,
    nativeRss: getNativeMem().total > 0,
  };
}

function driftStats(): DumpDrift {
  return {
    ticks: driftTicks,
    maxDriftMs: Math.round(maxDriftMs),
    stalls: driftStalls,
    hiddenTicks,
  };
}

function noteTick(): void {
  const now = Date.now();
  const previous = lastTickAt;
  lastTickAt = now;
  if (previous === 0) return;
  if (typeof document !== "undefined" && document.hidden) {
    hiddenTicks += 1;
    return;
  }
  driftTicks += 1;
  const drift = now - previous - TICK_INTERVAL_MS;
  if (drift > maxDriftMs) maxDriftMs = drift;
  if (drift > DRIFT_STALL_MS) driftStalls += 1;
}

function buildDump(): string {
  const now = Date.now();
  const sinceReset = resetAt || (fullHistory[0]?.ts ?? now);
  return buildDumpText({
    now,
    elapsedSec: (now - sinceReset) / 1000,
    baselineHeapMB,
    currentHeapMB: snapshotHeapMB(),
    peakHeapMB,
    dom: snapshotDom(),
    networkBytes,
    events: fullHistory.filter((s) => s.ts >= sinceReset),
    navStack,
    caches: reportCaches(),
    cacheHistory: cacheSizeHistory,
    renderReport: getRenderReport(),
    nativeMem: getNativeMem(),
    ramTier: getRamTier(),
    capabilities: getInstrumentationSupport(),
    drift: driftStats(),
    bridges: bridgeRows(),
  });
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportCaches() {
  const out: CacheReport[] = [];
  for (const [name, getter] of cacheGetters) {
    try {
      const size = getter();
      out.push({ name, size });
      const history = cacheSizeHistory.get(name) ?? [];
      history.push(size);
      if (history.length > 60) history.shift();
      cacheSizeHistory.set(name, history);
    } catch {}
  }
  out.sort((a, b) => b.size - a.size);
  return out;
}

function periodicReport() {
  const now = Date.now();
  if (now - lastReportAt < REPORT_INTERVAL_MS) return;
  lastReportAt = now;
  const heap = snapshotHeapMB();
  const dom = snapshotDom();
  const caches = reportCaches();
  const delta = heap - baselineHeapMB;
  const recent = samples.slice(-12);
  const heapJumps = recent
    .map((s, i) => (i === 0 ? null : { s, jump: s.heapMB - recent[i - 1].heapMB }))
    .filter((x): x is { s: Sample; jump: number } => !!x && x.jump > 5);

  console.groupCollapsed(
    `%c[profiler] heap ${heap}MB (Δ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} from ${baselineHeapMB}MB, peak ${peakHeapMB}MB) · dom ${dom.nodes} · imgs ${dom.imgs} · vids ${dom.vids} · net ${bytesToMB(networkBytes)}MB`,
    "color:#7eb6ff;font-weight:bold",
  );
  if (caches.length > 0) {
    console.table(caches.slice(0, 20));
  }
  if (heapJumps.length > 0) {
    console.warn("Heap jumps (>5MB) in last window:");
    for (const { s, jump } of heapJumps) {
      console.warn(`  +${jump.toFixed(1)}MB @ ${new Date(s.ts).toLocaleTimeString()} after ${s.kind}: ${s.label}`);
    }
  }
  if (navStack.length > 0) {
    const lastNav = navStack[navStack.length - 1];
    const since = (Date.now() - lastNav.at) / 1000;
    const heapDeltaSinceNav = heap - lastNav.heap;
    console.info(`Last nav: ${lastNav.label} (${since.toFixed(0)}s ago, Δ${heapDeltaSinceNav >= 0 ? "+" : ""}${heapDeltaSinceNav.toFixed(1)}MB since)`);
  }
  console.groupEnd();
}

function instrumentFetch() {
  if (typeof window === "undefined") return;
  const origFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const startHeap = snapshotHeapMB();
    const startTs = nowMs();
    try {
      const res = await origFetch(input as RequestInfo, init);
      const cl = Number(res.headers.get("content-length") ?? 0);
      if (cl > 0) networkBytes += cl;
      const elapsed = Math.round(nowMs() - startTs);
      const endHeap = snapshotHeapMB();
      const heapDelta = endHeap - startHeap;
      if (heapDelta > 2 || cl > 256 * 1024 || elapsed > 1500) {
        pushSample("fetch", shortenUrl(url), {
          status: res.status,
          bytes: cl,
          elapsedMs: elapsed,
          heapDeltaMB: heapDelta,
        });
      }
      return res;
    } catch (err) {
      pushSample("fetch", shortenUrl(url), { error: String(err) });
      throw err;
    }
  };
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url, window.location.href);
    const path = u.pathname.length > 60 ? u.pathname.slice(0, 60) + "…" : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url.length > 80 ? url.slice(0, 80) + "…" : url;
  }
}

function instrumentClicks() {
  if (typeof document === "undefined") return;
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const label = target.getAttribute("aria-label") ||
        target.textContent?.trim().slice(0, 40) ||
        target.tagName.toLowerCase();
      pushSample("click", label);
    },
    { capture: true, passive: true },
  );
}

function instrumentLongTasks() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration < 50) continue;
        pushSample("longtask", `${entry.duration.toFixed(0)}ms long task`, {
          durationMs: Math.round(entry.duration),
          startTime: Math.round(entry.startTime),
        });
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {}
}

const renderTimings = new Map<string, { count: number; totalMs: number; maxMs: number; lastMs: number }>();

export function recordRender(componentId: string, actualDurationMs: number): void {
  const entry = renderTimings.get(componentId) ?? { count: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
  entry.count += 1;
  entry.totalMs += actualDurationMs;
  entry.lastMs = actualDurationMs;
  if (actualDurationMs > entry.maxMs) entry.maxMs = actualDurationMs;
  renderTimings.set(componentId, entry);
  if (actualDurationMs > 16) {
    pushSample("render", `${componentId} ${actualDurationMs.toFixed(1)}ms`, {
      componentId,
      durationMs: Math.round(actualDurationMs * 10) / 10,
    });
  }
}

export function getRenderReport(): RenderReportRow[] {
  const out: RenderReportRow[] = [];
  for (const [id, t] of renderTimings) {
    out.push({
      id,
      count: t.count,
      totalMs: Math.round(t.totalMs * 10) / 10,
      maxMs: Math.round(t.maxMs * 10) / 10,
      avgMs: Math.round((t.totalMs / t.count) * 10) / 10,
      lastMs: Math.round(t.lastMs * 10) / 10,
    });
  }
  out.sort((a, b) => b.totalMs - a.totalMs);
  return out;
}

type ProfilerApi = {
  start: () => void;
  stop: () => void;
  mark: (label: string, detail?: Record<string, unknown>) => void;
  recordNav: (label: string) => void;
  registerCache: (name: string, getter: () => number) => void;
  unregisterCache: (name: string) => void;
  getSamples: () => Sample[];
  getCacheReports: () => CacheReport[];
  getCacheHistory: () => Map<string, number[]>;
  getHeapMB: () => number;
  getBaselineMB: () => number;
  getPeakMB: () => number;
  getNetworkMB: () => number;
  reset: () => void;
  subscribe: (fn: () => void) => () => void;
  dumpReport: () => { filename: string; bytes: number; events: number };
};

export function startProfiler(): void {
  if (started) return;
  started = true;
  baselineHeapMB = snapshotHeapMB();
  peakHeapMB = baselineHeapMB;
  resetAt = Date.now();
  pushSample("mark", "profiler:start");
  instrumentFetch();
  instrumentClicks();
  instrumentLongTasks();
  if (typeof window !== "undefined") {
    lastTickAt = Date.now();
    tickHandle = window.setInterval(() => {
      noteTick();
      pushSample("tick", "interval");
      periodicReport();
    }, TICK_INTERVAL_MS);
  }
  console.info(
    `%c[profiler] started — baseline ${baselineHeapMB}MB. Console reports every ${REPORT_INTERVAL_MS / 1000}s. Call window.__harborProfiler.dumpReport() for instant snapshot.`,
    "color:#7eb6ff;font-weight:bold",
  );
}

export function stopProfiler(): void {
  if (!started) return;
  started = false;
  if (tickHandle != null) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

export function markEvent(label: string, detail?: Record<string, unknown>): void {
  pushSample("mark", label, detail);
}

export function recordNav(label: string): void {
  const heap = snapshotHeapMB();
  navStack.push({ label, at: Date.now(), heap });
  if (navStack.length > 20) navStack.shift();
  pushSample("nav", label, { heapMB: heap });
}

export function registerCache(name: string, getter: () => number): void {
  cacheGetters.set(name, getter);
}

export function unregisterCache(name: string): void {
  cacheGetters.delete(name);
  cacheSizeHistory.delete(name);
}

export function getSamples(): Sample[] {
  return samples.slice();
}

export function getCacheReports(): CacheReport[] {
  return reportCaches();
}

export function subscribeProfiler(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function dumpReport(): { filename: string; bytes: number; events: number } {
  const text = buildDump();
  const ts = new Date();
  const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, "0")}${String(ts.getDate()).padStart(2, "0")}-${String(ts.getHours()).padStart(2, "0")}${String(ts.getMinutes()).padStart(2, "0")}${String(ts.getSeconds()).padStart(2, "0")}`;
  const filename = `harbor-profile-${stamp}.txt`;
  downloadText(text, filename);
  lastDumpAt = Date.now();
  const sinceReset = resetAt || (fullHistory[0]?.ts ?? Date.now());
  const events = fullHistory.filter((s) => s.ts >= sinceReset).length;
  console.info(
    `%c[profiler] dumped ${filename} (${(text.length / 1024).toFixed(1)} KB, ${events} events). Check your Downloads folder.`,
    "color:#7eb6ff;font-weight:bold;font-size:14px",
  );
  listeners.forEach((fn) => fn());
  return { filename, bytes: text.length, events };
}

export function getLastDumpAt(): number {
  return lastDumpAt;
}

const api: ProfilerApi = {
  start: startProfiler,
  stop: stopProfiler,
  mark: markEvent,
  recordNav,
  registerCache,
  unregisterCache,
  getSamples,
  getCacheReports,
  getCacheHistory: () => cacheSizeHistory,
  getHeapMB: snapshotHeapMB,
  getBaselineMB: () => baselineHeapMB,
  getPeakMB: () => peakHeapMB,
  getNetworkMB: () => bytesToMB(networkBytes),
  reset: () => {
    samples.length = 0;
    fullHistory.length = 0;
    navStack.length = 0;
    renderTimings.clear();
    baselineHeapMB = snapshotHeapMB();
    peakHeapMB = baselineHeapMB;
    networkBytes = 0;
    resetAt = Date.now();
    resetBridgeStats();
    lastTickAt = Date.now();
    driftTicks = 0;
    maxDriftMs = 0;
    driftStalls = 0;
    hiddenTicks = 0;
    pushSample("mark", "profiler:reset");
  },
  subscribe: subscribeProfiler,
  dumpReport,
};

if (typeof window !== "undefined") {
  window.__harborProfiler = api;
}
