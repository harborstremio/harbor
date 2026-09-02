import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import cloudflareLogo from "@/assets/cloudflare.webp";
import { useT } from "@/lib/i18n";
import { isTauri } from "./internals";
import { runSpeedTest, type SpeedTestResult } from "./speed-test-run";

const SPEEDTEST_COOLDOWN_MS = 90_000;
const SPEEDTEST_LIMITED_COOLDOWN_MS = 300_000;

const ERROR_COPY: Record<Exclude<SpeedTestResult, { ok: true }>["reason"], string> = {
  rate_limited: "Cloudflare rate limited this test. Try again in a few minutes.",
  network: "Could not reach speed.cloudflare.com.",
  insufficient: "Not enough data transferred to measure reliably.",
};

export function formatMbps(mbps: number): string {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  if (mbps >= 100) return `${mbps.toFixed(0)} Mbps`;
  return `${mbps.toFixed(1)} Mbps`;
}

function SpeedResultBadge({ value }: { value: string }) {
  const t = useT();
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
        className={`flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[13px] font-semibold tabular-nums text-ink ring-1 transition-colors ${
          open ? "ring-edge" : "ring-edge-soft hover:ring-edge"
        }`}
      >
        <img
          src={cloudflareLogo}
          alt=""
          draggable={false}
          className="h-3.5 w-3.5 shrink-0 object-contain"
        />
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
          className="absolute end-0 top-[calc(100%+8px)] z-30 w-[300px] origin-top-right rtl:origin-top-left rounded-md bg-raised p-3.5 text-start harbor-float"
          style={{ animation: "harbor-fade-in 140ms ease-out both" }}
        >
          <div className="mb-2 flex items-center gap-2">
            <img
              src={cloudflareLogo}
              alt=""
              draggable={false}
              className="h-4 w-4 shrink-0 object-contain"
            />
            <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              {t("How this is measured")}
            </span>
          </div>
          <p className="mb-2.5 text-[12.5px] leading-snug text-ink-muted">
            {t("Harbor opens 4 parallel requests to")}{" "}
            <span className="font-medium text-ink">speed.cloudflare.com</span>
            {t(
              ", discards the first 1.2s so TCP slow-start doesn't tank the result, then measures until it has 150 MB or 8 seconds of steady-state transfer.",
            )}
          </p>
          <p className="mb-2 text-[12.5px] leading-snug text-ink-muted">
            {t(
              "The number is bytes divided by the time they actually took to arrive. Cloudflare is a single origin, so on a very fast line this can read lower than a multi-server test like speedtest.net.",
            )}
          </p>
          <div className="mt-2 flex items-center gap-2 border-t border-edge-soft pt-2 text-[11.5px] text-ink-subtle">
            <span className="h-1 w-1 rounded-full bg-ink-subtle/60" />
            {t("Uses up to 150 MB")}
            <span className="h-1 w-1 rounded-full bg-ink-subtle/60" />
            {t("90s cooldown")}
          </div>
        </div>
      )}
    </div>
  );
}

export function SpeedTestButton() {
  const t = useT();
  if (!isTauri) {
    return (
      <span className="flex h-8 shrink-0 items-center rounded-md bg-canvas px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {t("Desktop only")}
      </span>
    );
  }
  return <SpeedTestButtonInner />;
}

function SpeedTestButtonInner() {
  const t = useT();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [mbps, setMbps] = useState<number | null>(null);
  const [liveMbps, setLiveMbps] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
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

    const result = await runSpeedTest(setLiveMbps);
    setLiveMbps(null);

    if (result.ok) {
      setMbps(result.mbps);
      setError(null);
      setCooldownUntil(Date.now() + SPEEDTEST_COOLDOWN_MS);
      setNow(Date.now());
      setState("done");
      return;
    }

    setError(t(ERROR_COPY[result.reason]));
    if (result.reason === "rate_limited") {
      setCooldownUntil(Date.now() + SPEEDTEST_LIMITED_COOLDOWN_MS);
      setNow(Date.now());
    }
    setState("error");
  };

  if (state === "running") {
    return (
      <span className="flex h-8 shrink-0 items-center gap-2 text-[12.5px] font-semibold tabular-nums text-ink">
        <Loader2 size={12} strokeWidth={2.4} className="animate-spin text-ink-subtle" />
        {liveMbps != null ? formatMbps(liveMbps) : t("warming up…")}
      </span>
    );
  }
  if (state === "error") {
    return (
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="max-w-[260px] text-end text-[12.5px] leading-snug text-ink-subtle">
          {error}
        </span>
        <button
          type="button"
          onClick={run}
          disabled={cooling}
          className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11.5px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            cooling
              ? "cursor-not-allowed border-edge-soft text-ink-subtle"
              : "border-danger text-danger hover:bg-danger/25"
          }`}
        >
          {cooling ? `${Math.ceil(cooldownRemaining / 1000)}s` : t("Retry")}
        </button>
      </div>
    );
  }
  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={run}
        className="flex h-8 shrink-0 items-center rounded-md bg-canvas px-3 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
      >
        {t("Run speed test")}
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
        aria-label={
          cooling
            ? t("Wait {seconds}s", { seconds: Math.ceil(cooldownRemaining / 1000) })
            : t("Re-test")
        }
        className={`flex h-7 items-center justify-center rounded-full text-ink-subtle transition-colors ${
          cooling
            ? "w-auto cursor-not-allowed px-2 text-[10.5px] font-semibold tabular-nums tracking-wide"
            : "w-7 hover:bg-canvas hover:text-ink"
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
