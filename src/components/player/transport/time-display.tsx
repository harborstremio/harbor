import type { ReactNode } from "react";
import { usePlaybackDownloadedGated, usePlaybackPositionGated } from "@/lib/player/playback-clock";
import { fmtTime } from "./transport-utils";
import type { TimeFormat } from "@/lib/player-chrome";

function CachedDot({ active }: { active: boolean }): ReactNode {
  const downloaded = usePlaybackDownloadedGated(active);
  if (downloaded < 0.999) return null;
  return (
    <span
      className="ms-2 inline-block h-2 w-2 shrink-0 rounded-full bg-[#22c55e] align-middle shadow-[0_0_4px_rgba(34,197,94,0.7)]"
      title="Cached"
    />
  );
}

function cycleTitle(fmt: TimeFormat): string {
  return fmt === "remaining" ? "Show total length" : "Show time left";
}

export function TimeStart({
  durationSec,
  timeFormat,
  isLiveChannel,
  tight,
  alwaysShowClock,
  active,
  stremio,
  onCycle,
}: {
  durationSec: number;
  timeFormat?: TimeFormat;
  isLiveChannel: boolean;
  tight?: boolean;
  alwaysShowClock?: boolean;
  active: boolean;
  stremio?: boolean;
  onCycle?: () => void;
}): ReactNode {
  const positionSec = usePlaybackPositionGated(active);
  if (isLiveChannel) return null;
  if (stremio) {
    const fmt: TimeFormat = timeFormat ?? "start-end";
    const positionText = fmtTime(positionSec);
    const cls =
      "pointer-events-auto ms-2 shrink-0 font-medium tabular-nums text-[14px] text-white/90";
    const inner =
      fmt === "elapsed-only" ? (
        <>
          {positionText}
          <CachedDot active={active} />
        </>
      ) : (
        <>
          {positionText}
          <span className="mx-1 text-white/55">/</span>
          {fmt === "remaining"
            ? `-${fmtTime(Math.max(0, (durationSec ?? 0) - positionSec))}`
            : fmtTime(durationSec ?? 0)}
          <CachedDot active={active} />
        </>
      );
    if (onCycle) {
      return (
        <button
          type="button"
          onClick={onCycle}
          title={cycleTitle(fmt)}
          className={`${cls} cursor-pointer transition-colors hover:text-white`}
        >
          {inner}
        </button>
      );
    }
    return <span className={cls}>{inner}</span>;
  }
  // In tight/compact windows, show a compact version instead of hiding
  const isCompact = tight && !alwaysShowClock;
  return (
    <span
      className={`shrink-0 font-mono tabular-nums text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] ${
        isCompact ? "text-[11px]" : "text-[13px]"
      }`}
    >
      {fmtTime(positionSec)}
    </span>
  );
}

export function TimeEnd({
  durationSec,
  timeFormat,
  isLiveChannel,
  tight,
  alwaysShowClock,
  active,
  onCycle,
}: {
  durationSec: number;
  timeFormat?: TimeFormat;
  isLiveChannel: boolean;
  tight?: boolean;
  alwaysShowClock?: boolean;
  active: boolean;
  onCycle?: () => void;
}): ReactNode {
  const positionSec = usePlaybackPositionGated(active);
  if (isLiveChannel) return null;
  const fmt: TimeFormat = timeFormat ?? "start-end";
  if (fmt === "elapsed-only") return null;
  const duration = durationSec ?? 0;
  const text =
    fmt === "remaining" ? `-${fmtTime(Math.max(0, duration - positionSec))}` : fmtTime(duration);
  // In tight/compact windows, show a compact version instead of hiding
  const isCompact = tight && !alwaysShowClock;
  const cls = isCompact
    ? "inline-flex shrink-0 items-center font-mono text-[11px] tabular-nums text-white/55 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
    : "inline-flex shrink-0 items-center font-mono text-[13px] tabular-nums text-white/65 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]";
  if (onCycle) {
    return (
      <button
        type="button"
        onClick={onCycle}
        title={cycleTitle(fmt)}
        className={`${cls} pointer-events-auto cursor-pointer transition-colors hover:text-white/95`}
      >
        {text}
        <CachedDot active={active} />
      </button>
    );
  }
  return (
    <span className={cls}>
      {text}
      <CachedDot active={active} />
    </span>
  );
}
