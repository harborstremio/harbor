import type { TimeFormat } from "@/lib/player-chrome";
import { usePlaybackDownloadedGated, usePlaybackPositionGated } from "@/lib/player/playback-clock";
import type { ReactNode } from "react";

import { fmtTime } from "./transport-utils";

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
  active,
  stremio,
  onCycle,
}: {
  durationSec: number;
  timeFormat?: TimeFormat;
  isLiveChannel: boolean;
  tight?: boolean;
  active: boolean;
  stremio?: boolean;
  onCycle?: () => void;
}): ReactNode {
  const positionSec = usePlaybackPositionGated(active);
  if (isLiveChannel) return null;
  if (stremio) {
    const fmt: TimeFormat = timeFormat ?? "start-end";
    const positionText = fmtTime(positionSec);
    const cls = "pointer-events-auto ms-2 shrink-0 font-medium tabular-nums text-[14px] text-white/90";
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
  if (tight) return null;
  return (
    <span className="shrink-0 font-mono text-[13px] tabular-nums text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
      {fmtTime(positionSec)}
    </span>
  );
}

export function TimeEnd({
  durationSec,
  timeFormat,
  isLiveChannel,
  tight,
  active,
  onCycle,
}: {
  durationSec: number;
  timeFormat?: TimeFormat;
  isLiveChannel: boolean;
  tight?: boolean;
  active: boolean;
  onCycle?: () => void;
}): ReactNode {
  const positionSec = usePlaybackPositionGated(active);
  if (isLiveChannel || tight) return null;
  const fmt: TimeFormat = timeFormat ?? "start-end";
  if (fmt === "elapsed-only") return null;
  const duration = durationSec ?? 0;
  const text = fmt === "remaining" ? `-${fmtTime(Math.max(0, duration - positionSec))}` : fmtTime(duration);
  const cls =
    "inline-flex shrink-0 items-center font-mono text-[13px] tabular-nums text-white/65 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]";
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
