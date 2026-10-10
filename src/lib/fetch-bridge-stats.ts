export type BridgeKind = "direct" | "directFail" | "harborFetch" | "pluginHttp";
export type BridgeOutcome = "ok" | "error" | "timeout" | "abort";

export type BridgeRow = {
  key: string;
  kind: BridgeKind;
  host: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  outcomes: Record<BridgeOutcome, number>;
};

type Bucket = {
  kind: BridgeKind;
  host: string;
  count: number;
  maxMs: number;
  recent: number[];
  outcomes: Record<BridgeOutcome, number>;
};

const MAX_KEYS = 96;
const MAX_RECENT = 64;
const buckets = new Map<string, Bucket>();

declare global {
  interface Window {
    __harborBridges?: () => BridgeRow[];
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname || "other";
  } catch {
    return "other";
  }
}

function emptyOutcomes(): Record<BridgeOutcome, number> {
  return { ok: 0, error: 0, timeout: 0, abort: 0 };
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return Math.round(sorted[index]);
}

export function bridgeOutcome(error: unknown): BridgeOutcome {
  const name = (error as { name?: string } | undefined)?.name ?? "";
  if (name === "AbortError") return "abort";
  if (name === "TimeoutError") return "timeout";
  const message = (error as { message?: string } | undefined)?.message ?? "";
  if (/timed? ?out|deadline/i.test(message)) return "timeout";
  return "error";
}

export function recordBridge(
  kind: BridgeKind,
  url: string,
  elapsedMs: number,
  outcome: BridgeOutcome,
): void {
  const host = hostOf(url);
  const key = `${kind} ${host}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_KEYS) return;
    bucket = { kind, host, count: 0, maxMs: 0, recent: [], outcomes: emptyOutcomes() };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  bucket.outcomes[outcome] += 1;
  if (elapsedMs > bucket.maxMs) bucket.maxMs = elapsedMs;
  bucket.recent.push(elapsedMs);
  if (bucket.recent.length > MAX_RECENT) bucket.recent.shift();
}

export function bridgeRows(): BridgeRow[] {
  const rows: BridgeRow[] = [];
  for (const [key, bucket] of buckets) {
    const sorted = bucket.recent.slice().sort((a, b) => a - b);
    rows.push({
      key,
      kind: bucket.kind,
      host: bucket.host,
      count: bucket.count,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      maxMs: Math.round(bucket.maxMs),
      outcomes: { ...bucket.outcomes },
    });
  }
  rows.sort((a, b) => b.p95Ms - a.p95Ms || b.count - a.count);
  return rows;
}

export function resetBridgeStats(): void {
  buckets.clear();
}

export function formatBridgeSection(rows: BridgeRow[]): string[] {
  const lines: string[] = [];
  lines.push("NETWORK BRIDGES (every desktop request, slowest p95 first)");
  lines.push("  count  p50      p95      max      ok/err/timeout/abort  bridge and host");
  if (rows.length === 0) {
    lines.push("  (no bridged requests recorded in this session)");
    return lines;
  }
  for (const row of rows) {
    const counts = `${row.outcomes.ok}/${row.outcomes.error}/${row.outcomes.timeout}/${row.outcomes.abort}`;
    lines.push(
      `  ${String(row.count).padStart(5, " ")}  ${`${row.p50Ms}ms`.padStart(7, " ")}  ${`${row.p95Ms}ms`.padStart(7, " ")}  ${`${row.maxMs}ms`.padStart(7, " ")}  ${counts.padEnd(20, " ")}  ${row.key}`,
    );
  }
  return lines;
}

if (typeof window !== "undefined") {
  window.__harborBridges = bridgeRows;
}
