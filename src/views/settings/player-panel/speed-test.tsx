import cloudflareLogo from "@/assets/cloudflare.webp";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isTauri } from "./internals";

const SPEEDTEST_CHUNK = 25_000_000;
const SPEEDTEST_URL = `https://speed.cloudflare.com/__down?bytes=${SPEEDTEST_CHUNK}`;
const SPEEDTEST_STREAMS = 4;
const SPEEDTEST_DURATION_MS = 8000;
const SPEEDTEST_WARMUP_MS = 1500;
const SPEEDTEST_COOLDOWN_MS = 60_000;

export function formatMbps(mbps: number): string {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  if (mbps >= 100) return `${mbps.toFixed(0)} Mbps`;
  return `${mbps.toFixed(1)} Mbps`;
}

function SpeedResultBadge({ value }: { value: string }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  const open = hovered || pinned;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setPinned((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full bg-canvas/60 px-2.5 py-1 text-[13px] font-semibold tabular-nums text-ink ring-1 transition-colors ${
          open ? "ring-edge" : "ring-edge-soft hover:ring-edge"
        }`}
      >
        <img src={cloudflareLogo} alt="" draggable={false} className="h-3.5 w-3.5 shrink-0 object-contain" />
        {value}
      </button>
      {pinned && (
        <div
          className="fixed inset-0 z-20"
          onMouseDown={(e) => {
            e.stopPropagation();
            setPinned(false);
          }}
        />
      )}
      {open && (
        <div
          role="tooltip"
          className="absolute end-0 top-[calc(100%+8px)] z-30 w-[300px] origin-top-right rtl:origin-top-left rounded-xl border border-edge bg-elevated p-3.5 text-start shadow-[0_18px_48px_-12px_rgba(0,0,0,0.65)]"
          style={{ animation: "harbor-fade-in 140ms ease-out both" }}
        >
          <div className="mb-2 flex items-center gap-2">
            <img src={cloudflareLogo} alt="" draggable={false} className="h-4 w-4 shrink-0 object-contain" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              How this is measured
            </span>
          </div>
          <p className="mb-2.5 text-[12.5px] leading-snug text-ink-muted">
            Harbor opens 4 parallel HTTP streams to <span className="font-medium text-ink">speed.cloudflare.com</span>,
            runs for 8 seconds, and discards the first 1.5s of warmup so TCP slow-start doesn't tank the result.
          </p>
          <p className="mb-2 text-[12.5px] leading-snug text-ink-muted">
            The reported number is your steady-state throughput, which is what fast.com and speedtest.net also use.
          </p>
          <div className="mt-2 flex items-center gap-2 border-t border-edge-soft pt-2 text-[11px] text-ink-subtle">
            <span className="h-1 w-1 rounded-full bg-ink-subtle/60" />
            One test uses ~your speed × 7s of bandwidth
            <span className="h-1 w-1 rounded-full bg-ink-subtle/60" />
            60s cooldown
          </div>
        </div>
      )}
    </div>
  );
}

export function SpeedTestButton() {
  if (!isTauri) {
    return (
      <span className="flex h-8 shrink-0 items-center rounded-full border border-edge-soft px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        Desktop only
      </span>
    );
  }
  return <SpeedTestButtonInner />;
}

function SpeedTestButtonInner() {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [mbps, setMbps] = useState<number | null>(null);
  const [liveMbps, setLiveMbps] = useState<number | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemaining = Math.max(0, cooldownUntil - now);
  const cooling = cooldownRemaining > 0;

  const run = async () => {
    if (state === "running" || cooling) return;
    setState("running");
    setLiveMbps(null);

    const samples: Array<{ t: number; bytes: number }> = [];
    let total = 0;
    let cancelled = false;
    const startedAt = performance.now();

    const liveTimer = window.setInterval(() => {
      const nowMs = performance.now();
      const elapsed = nowMs - startedAt;
      if (elapsed < SPEEDTEST_WARMUP_MS) return;
      const cutoff = nowMs - 1500;
      let recentBytes = 0;
      let earliest = nowMs;
      for (let i = samples.length - 1; i >= 0; i--) {
        if (samples[i].t < cutoff) break;
        recentBytes += samples[i].bytes;
        earliest = samples[i].t;
      }
      const dt = (nowMs - earliest) / 1000;
      if (dt > 0.2) setLiveMbps((recentBytes * 8) / 1_000_000 / dt);
    }, 250);

    const stream = async () => {
      while (!cancelled && performance.now() - startedAt < SPEEDTEST_DURATION_MS) {
        try {
          const res = await fetch(`${SPEEDTEST_URL}&n=${Math.random()}`, { cache: "no-store" });
          const reader = res.body?.getReader();
          if (!reader) break;
          while (!cancelled) {
            const { done, value } = await reader.read();
            if (done) break;
            if (performance.now() - startedAt > SPEEDTEST_DURATION_MS) {
              cancelled = true;
              reader.cancel().catch(() => {});
              break;
            }
            const t = performance.now();
            samples.push({ t, bytes: value.length });
            if (t - startedAt >= SPEEDTEST_WARMUP_MS) total += value.length;
          }
        } catch {}
      }
    };

    try {
      await Promise.all(Array.from({ length: SPEEDTEST_STREAMS }, stream));
      window.clearInterval(liveTimer);
      const measureSec = (SPEEDTEST_DURATION_MS - SPEEDTEST_WARMUP_MS) / 1000;
      const result = (total * 8) / 1_000_000 / measureSec;
      setMbps(result);
      setLiveMbps(null);
      setCooldownUntil(Date.now() + SPEEDTEST_COOLDOWN_MS);
      setNow(Date.now());
      setState("done");
    } catch {
      window.clearInterval(liveTimer);
      setState("error");
    }
  };

  if (state === "running") {
    return (
      <span className="flex h-8 shrink-0 items-center gap-2 text-[12.5px] font-semibold tabular-nums text-ink">
        <Loader2 size={12} strokeWidth={2.4} className="animate-spin text-ink-subtle" />
        {liveMbps != null ? formatMbps(liveMbps) : "warming up…"}
      </span>
    );
  }
  if (state === "error") {
    return (
      <button
        type="button"
        onClick={run}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-danger/40 px-3 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-danger transition-colors hover:bg-danger/10"
      >
        Retry
      </button>
    );
  }
  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={run}
        className="flex h-8 shrink-0 items-center rounded-full border border-edge-soft px-3 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted transition-colors hover:border-edge hover:text-ink"
      >
        Run speed test
      </button>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <SpeedResultBadge value={mbps != null ? formatMbps(mbps) : ""} />
      <button
        type="button"
        onClick={run}
        disabled={cooling}
        aria-label={cooling ? `Wait ${Math.ceil(cooldownRemaining / 1000)}s` : "Re-test"}
        className={`flex h-7 items-center justify-center rounded-full text-ink-subtle transition-colors ${
          cooling
            ? "w-auto cursor-not-allowed px-2 text-[10.5px] font-semibold tabular-nums tracking-wide"
            : "w-7 hover:bg-canvas/40 hover:text-ink"
        }`}
      >
        {cooling ? (
          `${Math.ceil(cooldownRemaining / 1000)}s`
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M21 12a9 9 0 1 1-3.5-7.1M21 4v5h-5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
