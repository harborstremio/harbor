import { useT } from "@/lib/i18n";
import { useSkipSegmentsView } from "@/lib/skip-intro/segment-store";
import { thumbCacheGet, thumbCacheNearest, thumbCacheSet, trickplayGet } from "@/lib/trickplay";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const SEG_LABEL = { intro: "OP", outro: "ED", recap: "Recap", ad: "Ad" } as const;
const BUCKET_SECONDS = 2;
const CARD_WIDTH = 192;
const CARD_HEIGHT = 108;
const MAX_ATTEMPTS = 24;
const RETRY_MS = 400;
const SETTLE_MS = 130;
const NEAREST_WINDOW = 30;

export function ThumbPreview({ time, dur, canFetch = true }: { time: number; dur: number; canFetch?: boolean }) {
  const bucket = Math.round(time / BUCKET_SECONDS);
  const liveBucketRef = useRef(bucket);
  liveBucketRef.current = bucket;
  const [fetchedSrc, setFetchedSrc] = useState<string | null>(() => thumbCacheGet(bucket) ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cached = thumbCacheGet(bucket);
    if (cached) {
      setFetchedSrc(cached);
      setLoading(false);
      return;
    }
    setFetchedSrc(null);
    if (!canFetch) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    let attempts = 0;
    let timer = 0;
    const attempt = async () => {
      if (cancelled || liveBucketRef.current !== bucket) return;
      const url = await trickplayGet(bucket * BUCKET_SECONDS);
      if (cancelled || liveBucketRef.current !== bucket) return;
      if (url) {
        thumbCacheSet(bucket, url);
        setFetchedSrc(url);
        setLoading(false);
        return;
      }
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        setLoading(false);
        return;
      }
      timer = window.setTimeout(attempt, RETRY_MS);
    };
    timer = window.setTimeout(attempt, SETTLE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [bucket, canFetch]);

  const t = useT();
  const segments = useSkipSegmentsView();
  const seg = segments.find((s) => time >= s.startSec && time < s.endSec);
  const segLabel = seg ? t(SEG_LABEL[seg.kind]) : null;
  const pct = (time / dur) * 100;
  const label = fmtTime(time);
  const nearest = fetchedSrc ? null : thumbCacheNearest(bucket, NEAREST_WINDOW);
  const src = fetchedSrc ?? nearest ?? null;
  const approx = !fetchedSrc && !!nearest;

  if (!src && !loading) {
    return (
      <div
        className="pointer-events-none absolute -top-9 flex -translate-x-1/2 items-center gap-1 rounded-md border border-white/10 bg-black/90 px-2 py-1 font-mono text-[12px] font-semibold tabular-nums text-white shadow-lg backdrop-blur-md"
        style={{ left: `${pct}%` }}
      >
        {segLabel && (
          <span className="rounded bg-accent px-1 font-sans text-[10px] font-bold uppercase tracking-wide text-canvas">
            {segLabel}
          </span>
        )}
        {label}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute -translate-x-1/2"
      style={{ left: `${pct}%`, bottom: "calc(100% + 8px)" }}
    >
      <div
        className="relative overflow-hidden rounded-lg border border-white/10 bg-black/85 shadow-[0_18px_40px_-15px_rgba(0,0,0,0.7)] backdrop-blur-md"
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            draggable={false}
            className={`h-full w-full object-cover transition-opacity duration-100 ${
              approx ? "opacity-60" : "opacity-100"
            }`}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-white/5 to-transparent" />
        )}
        {loading && !src && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-white/70" />
          </div>
        )}
      </div>
      <div className="mt-1 flex items-center justify-center gap-1">
        {segLabel && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canvas">
            {segLabel}
          </span>
        )}
        <span className="inline-block rounded-md bg-black/85 px-1.5 py-0.5 font-mono text-[11px] text-white">
          {label}
        </span>
      </div>
    </div>
  );
}

function fmtTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const total = Math.floor(t);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
