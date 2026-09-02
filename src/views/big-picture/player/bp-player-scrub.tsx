import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { fmtTime } from "@/components/player/transport/transport-utils";
import { useSettings } from "@/lib/settings";
import { useBpT } from "../bp-i18n";
import type { BpDir } from "../bp-focus-core";
import { setBpPlayerKeyHandler } from "./bp-player-key";
import type { BpPlayback } from "./use-bp-playback";

const COMMIT_MS = 420;

const STEP_RAMP_AT = 10;
const STEP_RUSH_AT = 26;
const STEP_RAMP_X = 3;
const STEP_RUSH_X = 6;

const RING: CSSProperties = {
  boxShadow:
    "0 0 0 2px var(--bp-void), 0 0 0 4px var(--bp-focus-stroke)",
};

function pct(value: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

let clockFmt: Intl.DateTimeFormat | null = null;

function clockOf(inSec: number): string {
  if (!clockFmt) {
    clockFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return clockFmt.format(Date.now() + inSec * 1000);
}

/**
 * The scrubber owns Left and Right for itself while it holds the ring, through
 * the shell's key delegation rather than a listener of its own. Presses
 * accumulate into one commit: a controller repeats every few frames and firing
 * a seek per repeat hammers the engine into a stutter.
 */
export function BpPlayerScrub({
  playback,
  active,
}: {
  playback: BpPlayback;
  /** True only while the chrome is up and this bar can hold the ring. */
  active: boolean;
}) {
  const t = useBpT();
  const { settings } = useSettings();
  const ref = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  pendingRef.current = pending;

  const duration = playback.durationSec;
  const position = pending ?? playback.positionSec;
  const back = settings.seekBackStepSec || 10;
  const forward = settings.seekForwardStepSec || 10;
  const steppable = active && !playback.live;

  const stepRef = useRef({ position: 0, duration: 0, back: 10, forward: 10 });
  stepRef.current = { position: playback.positionSec, duration, back, forward };
  const runRef = useRef(0);

  const seekTo = playback.seekTo;
  useEffect(() => {
    if (pending === null) return;
    const id = window.setTimeout(() => {
      seekTo(pending);
      setPending(null);
      runRef.current = 0;
    }, COMMIT_MS);
    return () => window.clearTimeout(id);
  }, [pending, seekTo]);

  // The chrome can walk out from under an accumulating seek, and unmounting
  // with the commit timer still armed throws the presses away silently.
  const flush = useRef<() => void>(() => {});
  flush.current = () => {
    if (pendingRef.current !== null) seekTo(pendingRef.current);
  };
  useEffect(() => () => flush.current(), []);

  const nudge = useCallback((ahead: boolean) => {
    const s = stepRef.current;
    const run = runRef.current;
    runRef.current = run + 1;
    const scale = run < STEP_RAMP_AT ? 1 : run < STEP_RUSH_AT ? STEP_RAMP_X : STEP_RUSH_X;
    const delta = (ahead ? s.forward : -s.back) * scale;
    const base = pendingRef.current ?? s.position;
    const cap = s.duration > 0 ? s.duration - 1 : base + delta;
    setPending(Math.max(0, Math.min(cap, base + delta)));
  }, []);

  useEffect(() => {
    if (!steppable) return;
    runRef.current = 0;
    return setBpPlayerKeyHandler((dir: BpDir) => {
      // data-bp-focus survives a blur, so a stale ring would let this claim
      // Left and Right long after the bar stopped being the focused control.
      if (ref.current?.dataset.bpFocus !== "true") return false;
      if (dir === "left") {
        nudge(false);
        return true;
      }
      if (dir === "right") {
        nudge(true);
        return true;
      }
      return false;
    });
  }, [steppable, nudge]);

  const played = pct(position, duration);
  const buffered = pct(Math.max(playback.bufferedSec, position), duration);
  const remaining = duration > 0 ? Math.max(0, duration - position) : 0;

  return (
    <div
      className={`flex flex-col gap-[clamp(6px,0.8vh,12px)] transition-opacity duration-[var(--bp-dur)] motion-reduce:transition-none ${
        active ? "opacity-100" : "opacity-90"
      }`}
    >
      <div
        ref={ref}
        role="slider"
        tabIndex={-1}
        aria-label={t("Seek")}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        aria-valuetext={fmtTime(position)}
        data-bp-focusable={playback.live ? undefined : true}
        data-bp-restore-key="player:scrub"
        className="group relative flex h-[clamp(44px,5vh,60px)] items-center outline-none"
      >
        <div className="relative h-[clamp(5px,0.6vh,8px)] w-full overflow-hidden rounded-full bg-[var(--bp-edge-2)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-ink/30"
            style={{ width: `${buffered}%` }}
          />
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-[var(--bp-dur-fast)] ease-linear motion-reduce:transition-none ${
              playback.live ? "bg-[var(--bp-live)]" : "bg-ink"
            }`}
            style={{ width: `${played}%` }}
          />
          {pending !== null && (
            <span
              aria-hidden
              className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-[var(--bp-touch)]"
              style={{ left: `${pct(playback.positionSec, duration)}%` }}
            />
          )}
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-[clamp(16px,1.8vh,22px)] w-[clamp(16px,1.8vh,22px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.7)] transition-[opacity,transform] duration-[var(--bp-dur-fast)] group-data-[bp-focus=true]:[transform:scale(1.25)] group-data-[bp-focus=true]:opacity-100 motion-reduce:transition-none"
          style={{ left: `${played}%` }}
        />
        <span
          aria-hidden
          style={RING}
          className="pointer-events-none absolute inset-x-0 top-1/2 h-[clamp(5px,0.6vh,8px)] -translate-y-1/2 rounded-full opacity-0 transition-opacity duration-[var(--bp-dur-fast)] group-data-[bp-focus=true]:opacity-100 motion-reduce:transition-none"
        />
      </div>
      <div className="flex items-center justify-between gap-[clamp(10px,1vw,20px)] text-[clamp(12px,1.6vh,18px)] font-semibold tabular-nums text-ink-subtle">
        <span className={pending === null ? "" : "text-ink"}>{fmtTime(position)}</span>
        {playback.live ? (
          <span className="flex items-center gap-2 font-bold uppercase tracking-[0.16em] text-[var(--bp-live)]">
            <span className="h-[8px] w-[8px] rounded-full bg-[var(--bp-live)]" />
            {t("Live")}
          </span>
        ) : (
          duration > 0 && (
            <span className="flex min-w-0 items-baseline gap-[clamp(8px,0.8vw,16px)]">
              <span>{t("{time} left", { time: fmtTime(remaining) })}</span>
              <span className="text-ink-muted">
                {t("Ends {time}", { time: clockOf(remaining) })}
              </span>
            </span>
          )
        )}
      </div>
    </div>
  );
}
