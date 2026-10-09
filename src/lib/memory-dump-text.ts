import { formatBridgeSection, type BridgeRow } from "./fetch-bridge-stats";
import type { CacheReport, Sample } from "./memory-profiler";

export type DumpCapabilities = {
  jsHeap: boolean;
  longTasks: boolean;
  nativeRss: boolean;
};

export type DumpDrift = {
  ticks: number;
  maxDriftMs: number;
  stalls: number;
  hiddenTicks: number;
};

export type RenderReportRow = {
  id: string;
  count: number;
  totalMs: number;
  maxMs: number;
  avgMs: number;
  lastMs: number;
};

export type DumpInput = {
  now: number;
  elapsedSec: number;
  baselineHeapMB: number;
  currentHeapMB: number;
  peakHeapMB: number;
  dom: { nodes: number; imgs: number; vids: number };
  networkBytes: number;
  events: Sample[];
  navStack: { label: string; at: number; heap: number }[];
  caches: CacheReport[];
  cacheHistory: Map<string, number[]>;
  renderReport: RenderReportRow[];
  nativeMem: { harborRss: number; webviewRss: number; total: number };
  ramTier: string;
  capabilities: DumpCapabilities;
  drift: DumpDrift;
  bridges: BridgeRow[];
};

function toMB(bytes: number): number {
  return Math.round((bytes / 1024 / 1024) * 100) / 100;
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

function heapLines(input: DumpInput): string[] {
  if (!input.capabilities.jsHeap) {
    return [
      "  js heap:       unavailable on this webview, performance.memory is not implemented",
      "  heap history:  not collected, every heap figure below reads 0.0 MB",
    ];
  }
  const delta = input.currentHeapMB - input.baselineHeapMB;
  return [
    `  baseline heap: ${input.baselineHeapMB.toFixed(1)} MB`,
    `  current heap:  ${input.currentHeapMB.toFixed(1)} MB`,
    `  peak heap:     ${input.peakHeapMB.toFixed(1)} MB`,
    `  delta:         ${delta >= 0 ? "+" : ""}${delta.toFixed(1)} MB`,
  ];
}

function rssLine(input: DumpInput): string {
  const { harborRss, webviewRss, total } = input.nativeMem;
  if (total <= 0) return "  native rss:    unavailable on this platform build";
  const webview =
    webviewRss > 0
      ? `webview ${webviewRss.toFixed(0)}`
      : "webview not attributed on this platform";
  return `  native rss:    ${total.toFixed(0)} MB (app ${harborRss.toFixed(0)}, ${webview}) tier ${input.ramTier}`;
}

function instrumentationSection(input: DumpInput): string[] {
  const { capabilities: caps, drift } = input;
  const lines: string[] = [];
  lines.push("PLATFORM INSTRUMENTATION (read this before trusting a zero above)");
  lines.push(`  performance.memory:      ${caps.jsHeap ? "available" : "MISSING"}`);
  lines.push(`  longtask observer:       ${caps.longTasks ? "available" : "MISSING"}`);
  lines.push(`  native rss command:      ${caps.nativeRss ? "available" : "MISSING"}`);
  lines.push(
    `  webview timer drift:     ${drift.ticks} ticks, max ${drift.maxDriftMs}ms, ${drift.stalls} over 500ms, ${drift.hiddenTicks} skipped while hidden`,
  );
  lines.push(
    "  how to read it: high bridge latency with low timer drift means the webview was healthy and",
  );
  lines.push(
    "  the stall was on the native side or in the IPC. High drift means the webview itself blocked.",
  );
  return lines;
}

export function buildDumpText(input: DumpInput): string {
  const lines: string[] = [];
  lines.push("==========================================================");
  lines.push("  HARBOR MEMORY PROFILE DUMP");
  lines.push(`  Dumped at: ${new Date(input.now).toLocaleString()}`);
  lines.push(`  Window: last ${input.elapsedSec.toFixed(1)}s since reset`);
  lines.push("==========================================================");
  lines.push("");
  lines.push("SUMMARY");
  for (const line of heapLines(input)) lines.push(line);
  lines.push(`  dom nodes:     ${input.dom.nodes}`);
  lines.push(`  images:        ${input.dom.imgs}`);
  lines.push(`  videos:        ${input.dom.vids}`);
  lines.push(`  net downloaded: ${toMB(input.networkBytes).toFixed(2)} MB`);
  lines.push(`  total events:  ${input.events.length}`);
  lines.push(rssLine(input));
  lines.push("");

  for (const line of instrumentationSection(input)) lines.push(line);
  lines.push("");

  lines.push("TOP MEMORY JUMPS (>3MB between consecutive events)");
  lines.push("  #  time         delta    heap     kind     label");
  let prev: Sample | null = null;
  let jumpCount = 0;
  for (const s of input.events) {
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
  if (jumpCount === 0) {
    lines.push(
      input.capabilities.jsHeap
        ? "  (none, no individual event jumped >3MB)"
        : "  (cannot be measured, this webview reports no heap size)",
    );
  }
  lines.push("");

  lines.push("NAVIGATION TIMELINE");
  lines.push("  time         delta-since-nav  heap-at-nav   route");
  for (let i = 0; i < input.navStack.length; i++) {
    const n = input.navStack[i];
    const next = input.navStack[i + 1];
    const endHeap = next ? next.heap : input.currentHeapMB;
    const delta = endHeap - n.heap;
    lines.push(
      `  ${formatTime(n.at)}  ${delta >= 0 ? "+" : ""}${delta.toFixed(1).padStart(5, " ")}MB        ${formatMB(n.heap)}     ${n.label}`,
    );
  }
  if (input.navStack.length === 0) lines.push("  (no navigations)");
  lines.push("");

  lines.push("CACHE SIZES (sorted)");
  lines.push("  size   name");
  for (const c of input.caches) {
    lines.push(`  ${formatLineNumber(c.size, 5)}  ${c.name}`);
  }
  lines.push("");

  lines.push("CACHE GROWTH (last 60 samples per cache)");
  for (const [name, history] of input.cacheHistory) {
    if (history.length < 2) continue;
    const start = history[0];
    const end = history[history.length - 1];
    const max = Math.max(...history);
    const arrow = end > start ? "up" : end < start ? "down" : "flat";
    lines.push(
      `  ${arrow.padEnd(4)} ${name.padEnd(30)} start=${start} end=${end} max=${max} samples=${history.length}`,
    );
  }
  lines.push("");

  for (const line of formatBridgeSection(input.bridges)) lines.push(line);
  lines.push("");

  lines.push("FETCH ACTIVITY (non-trivial)");
  lines.push("  time         status  bytes      elapsed  heap-delta  url");
  const fetches = input.events.filter((s) => s.kind === "fetch");
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
  const clicks = input.events.filter((s) => s.kind === "click");
  for (const c of clicks) {
    lines.push(`  ${formatTime(c.ts)}  ${formatMB(c.heapMB)}   ${c.label}`);
  }
  if (clicks.length === 0) lines.push("  (none)");
  lines.push("");

  lines.push("WEBVIEW STALLS (>50ms of blocked script)");
  lines.push("  time         duration  label");
  const longTasks = input.events.filter((s) => s.kind === "longtask");
  for (const t of longTasks) {
    lines.push(
      `  ${formatTime(t.ts)}  ${String((t.detail?.durationMs as number) ?? 0).padStart(5, " ")}ms    ${t.label}`,
    );
  }
  if (longTasks.length === 0) {
    lines.push(
      input.capabilities.longTasks
        ? "  (none, the webview never blocked for 50ms)"
        : "  (no longtask observer on this webview, the timer drift figure above is the only script stall evidence)",
    );
  }
  lines.push("");

  lines.push("SLOW RENDERS (>16ms, missed-frame candidates)");
  lines.push("  time         duration  component");
  const slowRenders = input.events.filter((s) => s.kind === "render");
  for (const r of slowRenders) {
    lines.push(
      `  ${formatTime(r.ts)}  ${String((r.detail?.durationMs as number) ?? 0).padStart(5, " ")}ms    ${r.detail?.componentId ?? r.label}`,
    );
  }
  if (slowRenders.length === 0) {
    lines.push(
      input.renderReport.length === 0
        ? "  (no component reports render timings, this section measures nothing yet)"
        : "  (none, every tracked render under 16ms)",
    );
  }
  lines.push("");

  lines.push("RENDER COST (cumulative per component, sorted by total time)");
  lines.push("  total      count  avg     max     last    component");
  for (const r of input.renderReport) {
    lines.push(
      `  ${String(r.totalMs).padStart(7, " ")}ms ${String(r.count).padStart(5, " ")}  ${String(r.avgMs).padStart(5, " ")}ms ${String(r.maxMs).padStart(5, " ")}ms ${String(r.lastMs).padStart(5, " ")}ms  ${r.id}`,
    );
  }
  if (input.renderReport.length === 0) lines.push("  (nothing calls recordRender)");
  lines.push("");

  lines.push("FULL EVENT TIMELINE (every sample)");
  lines.push("  time          kind     heap     dom     imgs   label");
  for (const s of input.events) {
    lines.push(
      `  ${formatTime(s.ts)}  [${s.kind.padEnd(6)}] ${formatMB(s.heapMB)}  ${String(s.domNodes).padStart(5, " ")}  ${String(s.imgs).padStart(4, " ")}   ${s.label}`,
    );
  }

  return lines.join("\n");
}
