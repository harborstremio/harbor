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
const probeCleanups: Array<() => void> = [];

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

function formatLineNumber(n: number, width = 4): string {
  return String(n).padStart(width, " ");
}

function formatMB(mb: number, width = 7): string {
  return `${mb.toFixed(1).padStart(width - 2, " ")}MB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString("en-GB")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function buildDumpText(): string {
  const now = Date.now();
  const sinceReset = resetAt || (fullHistory[0]?.ts ?? now);
  const eventsSinceReset = fullHistory.filter((s) => s.ts >= sinceReset);
  const elapsedSec = (now - sinceReset) / 1000;
  const currentHeap = snapshotHeapMB();
  const dom = snapshotDom();
  const caches = reportCaches();

  const lines: string[] = [];
  lines.push("==========================================================");
  lines.push("  HARBOR MEMORY PROFILE DUMP");
  lines.push(`  Dumped at: ${new Date(now).toLocaleString()}`);
  lines.push(`  Window: last ${elapsedSec.toFixed(1)}s since reset`);
  lines.push("==========================================================");
  lines.push("");
  lines.push("SUMMARY");
  if (performance.memory) {
    lines.push(`  baseline heap: ${baselineHeapMB.toFixed(1)} MB`);
    lines.push(`  current heap:  ${currentHeap.toFixed(1)} MB`);
    lines.push(`  peak heap:     ${peakHeapMB.toFixed(1)} MB`);
    lines.push(
      `  delta:         ${currentHeap - baselineHeapMB >= 0 ? "+" : ""}${(currentHeap - baselineHeapMB).toFixed(1)} MB`,
    );
  } else {
    lines.push("  JS heap:       unavailable in this WebView; use RSS below");
  }
  lines.push(`  dom nodes:     ${dom.nodes}`);
  lines.push(`  images:        ${dom.imgs}`);
  lines.push(`  videos:        ${dom.vids}`);
  lines.push(`  net downloaded: ${bytesToMB(networkBytes).toFixed(2)} MB`);
  lines.push(`  total events:  ${eventsSinceReset.length}`);
  const nm = getNativeMem();
  if (nm.total > 0) {
    lines.push(
      `  RSS total:     ${nm.total.toFixed(0)} MB (Harbor.exe ${nm.harborRss.toFixed(0)} + webview ${nm.webviewRss.toFixed(0)}) tier ${getRamTier()}`,
    );
  }
  lines.push("");

  lines.push("TOP MEMORY JUMPS (>3MB between consecutive events)");
  lines.push("  #  time         delta    heap     kind     label");
  let prev: Sample | null = null;
  let jumpCount = 0;
  for (const s of eventsSinceReset) {
    if (prev) {
      const delta = s.heapMB - prev.heapMB;
      if (delta > 3) {
        jumpCount += 1;
        lines.push(
          `  ${formatLineNumber(jumpCount, 3)} ${formatTime(s.ts)}  +${delta.toFixed(1)}MB  ${formatMB(s.heapMB)}  [${s.kind.padEnd(7)}] ${s.label}`,
        );
      }
    }
    prev = s;
  }
  if (jumpCount === 0) lines.push("  (none — no individual event jumped >3MB)");
  lines.push("");

  lines.push("NAVIGATION TIMELINE");
  lines.push("  time         delta-since-nav  heap-at-nav   route");
  for (let i = 0; i < navStack.length; i++) {
    const n = navStack[i];
    const next = navStack[i + 1];
    const endHeap = next ? next.heap : currentHeap;
    const delta = endHeap - n.heap;
    lines.push(
      `  ${formatTime(n.at)}  ${delta >= 0 ? "+" : ""}${delta.toFixed(1).padStart(5, " ")}MB        ${formatMB(n.heap)}     ${n.label}`,
    );
  }
  if (navStack.length === 0) lines.push("  (no navigations)");
  lines.push("");

  lines.push("CACHE SIZES (sorted)");
  lines.push("  size   name");
  for (const c of caches) {
    lines.push(`  ${formatLineNumber(c.size, 5)}  ${c.name}`);
  }
  lines.push("");

  lines.push("CACHE GROWTH (last 60 samples per cache, ▲ if growing, ▼ shrinking, ─ flat)");
  for (const [name, history] of cacheSizeHistory) {
    if (history.length < 2) continue;
    const start = history[0];
    const end = history[history.length - 1];
    const max = Math.max(...history);
    const arrow = end > start ? "▲" : end < start ? "▼" : "─";
    lines.push(
      `  ${arrow} ${name.padEnd(30)} start=${start} end=${end} max=${max} samples=${history.length}`,
    );
  }
  lines.push("");

  lines.push("FETCH ACTIVITY (non-trivial)");
  lines.push("  time         status  bytes      elapsed  heap-delta  url");
  const fetches = eventsSinceReset.filter((s) => s.kind === "fetch");
  for (const f of fetches) {
    const d = f.detail ?? {};
    const status = (d.status as number) ?? 0;
    const bytes = (d.bytes as number) ?? 0;
    const elapsed = (d.elapsedMs as number) ?? 0;
    const heapDelta = (d.heapDeltaMB as number) ?? 0;
    lines.push(
      `  ${formatTime(f.ts)}  ${String(status).padStart(3, " ")}    ${String(bytes).padStart(8, " ")}B  ${String(elapsed).padStart(5, " ")}ms  ${heapDelta >= 0 ? "+" : ""}${heapDelta.toFixed(1)}MB    ${f.label}`,
    );
  }
  if (fetches.length === 0) lines.push("  (none in window)");
  lines.push("");

  lines.push("CLICK EVENTS");
  const clicks = eventsSinceReset.filter((s) => s.kind === "click");
  for (const c of clicks) {
    lines.push(`  ${formatTime(c.ts)}  ${formatMB(c.heapMB)}   ${c.label}`);
  }
  if (clicks.length === 0) lines.push("  (none)");
  lines.push("");

  lines.push("LONG TASKS (>50ms, main thread blocked)");
  lines.push("  time         duration  label");
  const longTasks = eventsSinceReset.filter((s) => s.kind === "longtask");
  for (const t of longTasks) {
    lines.push(
      `  ${formatTime(t.ts)}  ${String((t.detail?.durationMs as number) ?? 0).padStart(5, " ")}ms    ${t.label}`,
    );
  }
  if (longTasks.length === 0) lines.push("  (none — main thread stayed responsive)");
  lines.push("");

  lines.push("SLOW RENDERS (>16ms, missed-frame candidates)");
  lines.push("  time         duration  component");
  const slowRenders = eventsSinceReset.filter((s) => s.kind === "render");
  for (const r of slowRenders) {
    lines.push(
      `  ${formatTime(r.ts)}  ${String((r.detail?.durationMs as number) ?? 0).padStart(5, " ")}ms    ${r.detail?.componentId ?? r.label}`,
    );
  }
  if (slowRenders.length === 0) lines.push("  (none — every tracked render under 16ms)");
  lines.push("");

  lines.push("RENDER COST (cumulative per component, sorted by total time)");
  lines.push("  total      count  avg     max     last    component");
  for (const r of getRenderReport()) {
    lines.push(
      `  ${String(r.totalMs).padStart(7, " ")}ms ${String(r.count).padStart(5, " ")}  ${String(r.avgMs).padStart(5, " ")}ms ${String(r.maxMs).padStart(5, " ")}ms ${String(r.lastMs).padStart(5, " ")}ms  ${r.id}`,
    );
  }
  lines.push("");

  lines.push("FULL EVENT TIMELINE (every sample)");
  lines.push("  time          kind     heap     dom     imgs   label");
  for (const s of eventsSinceReset) {
    lines.push(
      `  ${formatTime(s.ts)}  [${s.kind.padEnd(6)}] ${formatMB(s.heapMB)}  ${String(s.domNodes).padStart(5, " ")}  ${String(s.imgs).padStart(4, " ")}   ${s.label}`,
    );
  }

  return lines.join("\n");
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
      console.warn(
        `  +${jump.toFixed(1)}MB @ ${new Date(s.ts).toLocaleTimeString()} after ${s.kind}: ${s.label}`,
      );
    }
  }
  if (navStack.length > 0) {
    const lastNav = navStack[navStack.length - 1];
    const since = (Date.now() - lastNav.at) / 1000;
    const heapDeltaSinceNav = heap - lastNav.heap;
    console.info(
      `Last nav: ${lastNav.label} (${since.toFixed(0)}s ago, Δ${heapDeltaSinceNav >= 0 ? "+" : ""}${heapDeltaSinceNav.toFixed(1)}MB since)`,
    );
  }
  console.groupEnd();
}

function instrumentFetch(): () => void {
  if (typeof window === "undefined") return () => {};
  const origFetch = window.fetch;
  const instrumentedFetch: typeof window.fetch = async (input, init) => {
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
  window.fetch = instrumentedFetch;
  return () => {
    if (window.fetch === instrumentedFetch) window.fetch = origFetch;
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

function instrumentClicks(): () => void {
  if (typeof document === "undefined") return () => {};
  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const label =
      target.getAttribute("aria-label") ||
      target.textContent?.trim().slice(0, 40) ||
      target.tagName.toLowerCase();
    pushSample("click", label);
  };
  document.addEventListener("click", onClick, { capture: true, passive: true });
  return () => document.removeEventListener("click", onClick, { capture: true });
}

function instrumentLongTasks(): () => void {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return () => {};
  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver((list) => {
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
  return () => {
    if (observer) observer.disconnect();
  };
}

const renderTimings = new Map<
  string,
  { count: number; totalMs: number; maxMs: number; lastMs: number }
>();

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

export function getRenderReport(): Array<{
  id: string;
  count: number;
  totalMs: number;
  maxMs: number;
  avgMs: number;
  lastMs: number;
}> {
  const out: Array<{
    id: string;
    count: number;
    totalMs: number;
    maxMs: number;
    avgMs: number;
    lastMs: number;
  }> = [];
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
  probeCleanups.push(instrumentFetch(), instrumentClicks(), instrumentLongTasks());
  if (typeof window !== "undefined") {
    tickHandle = window.setInterval(() => {
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
  for (const cleanup of probeCleanups.splice(0)) cleanup();
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
  const text = buildDumpText();
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
    pushSample("mark", "profiler:reset");
  },
  subscribe: subscribeProfiler,
  dumpReport,
};

if (typeof window !== "undefined") {
  window.__harborProfiler = api;
}
