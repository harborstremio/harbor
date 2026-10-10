import { bridgeRows, formatBridgeSection } from "../fetch-bridge-stats";
import { getInstrumentationSupport } from "../memory-profiler";

const CONSOLE_RING_MAX = 400;
const consoleRing: string[] = [];
let patched = false;

function stringifyArg(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function patchConsole(): void {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const methods: Array<"log" | "info" | "warn" | "error"> = ["log", "info", "warn", "error"];
  for (const m of methods) {
    const orig = console[m].bind(console);
    console[m] = (...args: unknown[]) => {
      try {
        consoleRing.push(`${new Date().toISOString()} [${m}] ${args.map(stringifyArg).join(" ")}`);
        if (consoleRing.length > CONSOLE_RING_MAX) consoleRing.shift();
      } catch {}
      orig(...args);
    };
  }
}

patchConsole();

function collectRedactionValues(): string[] {
  const out = new Set<string>();
  const redactKeyRe = /token|authkey|apikey|api_key|secret|password|bearer|email/i;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const raw = localStorage.getItem(k) || "";
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        walkForRedaction(parsed, redactKeyRe, out);
      } catch {
        if (redactKeyRe.test(k) && raw.length >= 12) out.add(raw);
      }
    }
  } catch {}
  return [...out].filter((v) => v.length >= 8);
}

function walkForRedaction(node: unknown, redactKeyRe: RegExp, out: Set<string>): void {
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === "string" && redactKeyRe.test(key) && value.length >= 8) out.add(value);
    else if (value && typeof value === "object") walkForRedaction(value, redactKeyRe, out);
  }
}

function scrubClient(text: string): string {
  let out = text;
  for (const secret of collectRedactionValues()) {
    out = out.split(secret).join("[REDACTED]");
  }
  return out;
}

function serializeSupport(): string {
  const support = getInstrumentationSupport();
  return [
    `performance.memory ${support.jsHeap ? "available" : "MISSING"}`,
    `longtask observer ${support.longTasks ? "available" : "MISSING"}`,
    `native rss ${support.nativeRss ? "available" : "MISSING"}`,
  ].join(" | ");
}

function serializeProfiler(): string {
  const api = typeof window !== "undefined" ? window.__harborProfiler : undefined;
  if (!api) return "(profiler unavailable)";
  try {
    const samples = api.getSamples();
    const support = getInstrumentationSupport();
    const heap = support.jsHeap
      ? `heap ${api.getHeapMB()}MB baseline ${api.getBaselineMB()}MB peak ${api.getPeakMB()}MB`
      : "heap not measurable on this webview";
    const head = `${heap} net ${api.getNetworkMB()}MB`;
    const rows = samples.map(
      (s) =>
        `${new Date(s.ts).toISOString()} [${s.kind}] ${s.heapMB}MB dom=${s.domNodes} imgs=${s.imgs} vids=${s.vids} ${s.label}`,
    );
    return [head, ...rows].join("\n");
  } catch (e) {
    return `(profiler serialize failed: ${String(e)})`;
  }
}

export function collectRuntime(): string {
  const sections = [
    "===== INSTRUMENTATION =====",
    serializeSupport(),
    "",
    "===== NETWORK BRIDGES =====",
    formatBridgeSection(bridgeRows()).join("\n"),
    "",
    "===== PROFILER =====",
    serializeProfiler(),
    "",
    "===== APP CONSOLE =====",
    consoleRing.join("\n") || "(no console entries)",
  ];
  return scrubClient(sections.join("\n"));
}
