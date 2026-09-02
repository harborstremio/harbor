import { fetch as tauriHttpFetch } from "@tauri-apps/plugin-http";
import { safeFetch } from "@/lib/safe-fetch";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const probeFetch: typeof fetch = isTauri ? (tauriHttpFetch as unknown as typeof fetch) : safeFetch;

const MIN_REAL_SIZE_BYTES = 5 * 1024 * 1024;
const PREFLIGHT_TIMEOUT_MS = 1200;
const MANIFEST_URL_RX = /\.(m3u8|mpd)(\?|#|$)/i;
const MANIFEST_TYPE_RX = /mpegurl|dash\+xml|application\/xml|text\//i;

export type PreflightOk = { ok: true; sizeBytes: number | null };
export type PreflightFail = {
  ok: false;
  reason: "stub" | "unreachable" | "http-error";
  sizeBytes: number | null;
  status?: number;
};
export type PreflightResult = PreflightOk | PreflightFail;

const memo = new Map<string, PreflightResult>();
const inflight = new Map<string, Promise<PreflightResult>>();

export function readPreflightMemo(url: string): PreflightResult | null {
  return memo.get(url) ?? null;
}

export function preflightCheck(url: string, signal?: AbortSignal): Promise<PreflightResult> {
  const cached = memo.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(url);
  if (pending) return pending;
  const p = run(url, signal).then((r) => {
    inflight.delete(url);
    if (r.ok || r.reason === "stub") memo.set(url, r);
    return r;
  });
  inflight.set(url, p);
  return p;
}

async function run(url: string, signal?: AbortSignal): Promise<PreflightResult> {
  if (signal?.aborted) return { ok: false, reason: "unreachable", sizeBytes: null };
  return probe(url, signal);
}

async function probe(url: string, signal?: AbortSignal): Promise<PreflightResult> {
  if (MANIFEST_URL_RX.test(url)) return { ok: true, sizeBytes: null };
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = window.setTimeout(() => ctrl.abort(), PREFLIGHT_TIMEOUT_MS);
  let rangeRes: Response | null = null;
  try {
    rangeRes = await probeFetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1" },
      redirect: "follow",
      signal: ctrl.signal,
    }).catch(() => null);
    if (!rangeRes) {
      return { ok: false, reason: "unreachable", sizeBytes: null };
    }
    if (rangeRes.status === 404 || rangeRes.status === 410) {
      return { ok: false, reason: "stub", sizeBytes: 0, status: rangeRes.status };
    }
    if (!rangeRes.ok && rangeRes.status !== 206 && rangeRes.status !== 200) {
      return { ok: false, reason: "http-error", sizeBytes: null, status: rangeRes.status };
    }
    const isManifestBody = MANIFEST_TYPE_RX.test(rangeRes.headers.get("Content-Type") ?? "");
    if (isManifestBody) return { ok: true, sizeBytes: null };
    const rangeTotal = parseRangeTotal(rangeRes.headers.get("Content-Range"));
    if (rangeTotal != null && rangeTotal > 0 && rangeTotal < MIN_REAL_SIZE_BYTES) {
      return { ok: false, reason: "stub", sizeBytes: rangeTotal };
    }
    if (rangeTotal != null && rangeTotal >= MIN_REAL_SIZE_BYTES) {
      return { ok: true, sizeBytes: rangeTotal };
    }
    const fullLen = parseLength(rangeRes.headers.get("Content-Length"));
    if (rangeRes.status === 200 && fullLen != null && fullLen < MIN_REAL_SIZE_BYTES) {
      return { ok: false, reason: "stub", sizeBytes: fullLen };
    }
    if (fullLen != null && fullLen >= MIN_REAL_SIZE_BYTES) {
      return { ok: true, sizeBytes: fullLen };
    }
    return { ok: true, sizeBytes: null };
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    try {
      void rangeRes?.body?.cancel();
    } catch {
      /* noop */
    }
  }
}

function parseLength(v: string | null): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseRangeTotal(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/\/(\d+)\s*$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}
