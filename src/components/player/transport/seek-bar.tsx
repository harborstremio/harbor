import { useEffect, useRef, useState, useCallback } from "react";
import { useSettings } from "@/lib/settings";
import {
  usePlaybackPositionGated,
  usePlaybackBufferedGated,
  usePlaybackDownloadedGated,
  setSeekHovering,
} from "@/lib/player/playback-clock";
import { useTrickplayState } from "@/lib/trickplay";
import { useSkipSegmentsView } from "@/lib/skip-intro/segment-store";
import { ThumbPreview } from "@/components/player/thumb-preview";
import { SeekBarVisual } from "./seek-bar-visual";
import { fmtTime } from "./transport-utils";

const BUFFER_PAD_SEC = 4;
const PENDING_MAX_MS = 2500;
const KEY_SEEK_SMALL_SEC = 5;
const KEY_SEEK_LARGE_SEC = 30;

export function SeekBar({
  durationSec,
  onSeek,
  active,
}: {
  durationSec: number;
  onSeek: (s: number) => void;
  active: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const pendingAtRef = useRef<number | null>(null);
  const positionRef = useRef(0);
  const { settings } = useSettings();
  const { active: trickplayActive, bufferedOnly } = useTrickplayState();
  const position = usePlaybackPositionGated(active);
  const buffered = usePlaybackBufferedGated(active);
  const downloaded = usePlaybackDownloadedGated(active);
  const dur = durationSec || 1;
  const value = scrub ?? pending ?? position;
  const pct = Math.max(0, Math.min(1, value / dur)) * 100;
  const cacheFill = Math.max(0, Math.min(1, (position + buffered) / dur));
  const fullyCached = downloaded >= 0.999;
  const bufferedPct =
    fullyCached || settings.seekBarFill === false ? 0 : Math.max(cacheFill, downloaded) * 100;
  const skipSegments = useSkipSegmentsView();
  const segmentSpans = skipSegments
    .filter((s) => s.endSec > s.startSec && durationSec > 0)
    .map((s) => ({
      startPct: Math.max(0, Math.min(100, (s.startSec / dur) * 100)),
      endPct: Math.max(0, Math.min(100, (s.endSec / dur) * 100)),
      color: s.kind === "ad" ? "rgba(239,68,68,0.9)" : undefined,
    }));

  const clearInteraction = () => {
    setScrub(null);
    setHover(null);
  };

  useEffect(() => {
    setSeekHovering(hover != null || scrub != null);
  }, [hover, scrub]);
  useEffect(() => () => setSeekHovering(false), []);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    const clearInterruptedInteraction = () => {
      setScrub(null);
      setHover(null);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") clearInterruptedInteraction();
    };
    window.addEventListener("blur", clearInterruptedInteraction);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", clearInterruptedInteraction);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  useEffect(() => {
    if (pending == null) return;
    let frameId: number;
    const check = () => {
      if (
        Math.abs(positionRef.current - pending) < 0.75 ||
        Date.now() - (pendingAtRef.current ?? 0) >= PENDING_MAX_MS
      ) {
        setPending(null);
        pendingAtRef.current = null;
      } else {
        frameId = requestAnimationFrame(check);
      }
    };
    frameId = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frameId);
  }, [pending]);

  const fromEvent = (clientX: number): number => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return 0;
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return x * dur;
  };

  const onMove = (e: React.PointerEvent) => {
    setHover(fromEvent(e.clientX));
    if (scrub != null) setScrub(fromEvent(e.clientX));
  };
  const onLeave = () => setHover(null);
  const onCancel = () => clearInteraction();
  const onDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setPending(null);
    pendingAtRef.current = null;
    setScrub(fromEvent(e.clientX));
  };
  const onUp = (e: React.PointerEvent) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (scrub != null) {
      onSeek(scrub);
      setPending(scrub);
      pendingAtRef.current = Date.now();
    }
    setScrub(null);
  };

  const commitKeyboardSeek = useCallback(() => {
    if (scrub != null) {
      onSeek(scrub);
      setPending(scrub);
      pendingAtRef.current = Date.now();
    }
    setScrub(null);
    setHover(null);
  }, [scrub, onSeek]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      const isLarge = e.key === "ArrowUp" || e.key === "ArrowDown";
      const step = isLarge ? KEY_SEEK_LARGE_SEC : KEY_SEEK_SMALL_SEC;
      const dir = (e.key === "ArrowLeft" || e.key === "ArrowDown") ? -1 : 1;
      const current = scrub ?? position;
      const next = Math.max(0, Math.min(dur, current + dir * step));
      setHover(next);
      setScrub(next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      commitKeyboardSeek();
    } else if (e.key === "Escape") {
      setScrub(null);
      setHover(null);
    }
  };

  const onFocus = () => {
    if (scrub == null) setHover(position);
  };

  const onBlur = () => {
    setHover(null);
    setScrub(null);
  };

  const isKeyboardScrubbing = scrub != null && hover != null;

  return (
    <div dir="ltr" className="pointer-events-auto group/seek relative h-12">
      <div
        ref={ref}
        tabIndex={0}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(dur)}
        aria-valuenow={Math.round(value)}
        aria-valuetext={fmtTime(value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <SeekBarVisual
          settings={settings}
          pct={pct}
          bufferedPct={bufferedPct}
          scrubbing={scrub != null}
          hovered={hover != null}
          segments={segmentSpans}
        />
        {hover != null &&
          (trickplayActive ? (
            <ThumbPreview
              time={hover}
              dur={dur}
              canFetch={!bufferedOnly || hover <= position + Math.max(0, buffered - BUFFER_PAD_SEC)}
            />
          ) : (
            <div
              className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded-md border border-white/10 bg-black/90 px-2 py-1 font-mono text-[12px] font-semibold tabular-nums text-white shadow-lg backdrop-blur-md"
              style={{ left: `${(hover / dur) * 100}%` }}
            >
              {fmtTime(hover)}
            </div>
          ))}
      </div>
    </div>
  );
}
