const URL_BASE = "https://speed.cloudflare.com/__down";
const CHUNK_BYTES = 25_000_000;
const STREAMS = 4;
const DURATION_MS = 8000;
const WARMUP_MS = 1200;
const BUDGET_BYTES = 150_000_000;
const MIN_SPAN_MS = 800;
const MIN_BYTES = 4_000_000;
const LIVE_WINDOW_MS = 1500;

export type SpeedTestResult =
  | { ok: true; mbps: number }
  | { ok: false; reason: "rate_limited" | "network" | "insufficient" };

type Sample = { t: number; bytes: number };

function liveRate(samples: Sample[], now: number): number | null {
  const cutoff = now - LIVE_WINDOW_MS;
  let bytes = 0;
  let earliest = now;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (samples[i].t < cutoff) break;
    bytes += samples[i].bytes;
    earliest = samples[i].t;
  }
  const dt = (now - earliest) / 1000;
  return dt > 0.2 ? (bytes * 8) / 1_000_000 / dt : null;
}

export async function runSpeedTest(onLive: (mbps: number) => void): Promise<SpeedTestResult> {
  const startedAt = performance.now();
  const samples: Sample[] = [];
  const elapsed = () => performance.now() - startedAt;

  let counted = 0;
  let firstAt = 0;
  let lastAt = 0;
  let stop = false;
  let rateLimited = false;
  let networkError = false;

  const liveTimer = window.setInterval(() => {
    if (elapsed() < WARMUP_MS) return;
    const rate = liveRate(samples, performance.now());
    if (rate !== null) onLive(rate);
  }, 250);

  const stream = async () => {
    while (!stop && elapsed() < DURATION_MS) {
      let res: Response;
      try {
        res = await fetch(`${URL_BASE}?bytes=${CHUNK_BYTES}&n=${Math.random()}`, { cache: "no-store" });
      } catch {
        networkError = true;
        stop = true;
        return;
      }
      if (!res.ok) {
        if (res.status === 429 || res.status === 503) rateLimited = true;
        else networkError = true;
        stop = true;
        res.body?.cancel().catch(() => {});
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        networkError = true;
        stop = true;
        return;
      }
      while (!stop) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch {
          networkError = true;
          stop = true;
          break;
        }
        if (chunk.done) break;
        const t = performance.now();
        samples.push({ t, bytes: chunk.value.length });
        if (t - startedAt >= WARMUP_MS) {
          if (!firstAt) firstAt = t;
          lastAt = t;
          counted += chunk.value.length;
          if (counted >= BUDGET_BYTES && lastAt - firstAt >= MIN_SPAN_MS) stop = true;
        }
        if (elapsed() >= DURATION_MS) stop = true;
      }
      reader.cancel().catch(() => {});
    }
  };

  await Promise.all(Array.from({ length: STREAMS }, () => stream()));
  window.clearInterval(liveTimer);

  const spanMs = lastAt - firstAt;
  if (counted >= MIN_BYTES && spanMs >= MIN_SPAN_MS) {
    return { ok: true, mbps: (counted * 8) / 1_000_000 / (spanMs / 1000) };
  }
  if (rateLimited) return { ok: false, reason: "rate_limited" };
  if (networkError) return { ok: false, reason: "network" };
  return { ok: false, reason: "insufficient" };
}
