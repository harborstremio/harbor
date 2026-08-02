import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { usePlaybackPositionGated } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import {
  DEFAULT_FULLSCREEN_CLOCK_SIZE_PX,
  estimatePlaybackEndTime,
  formatLocalTime,
  msUntilNextClockTick,
  type FullscreenClockFormat,
  type FullscreenClockStyle,
} from "@/lib/local-time";

type ClockVariant = "default" | "kids" | "preview";

const STYLE_CLASSES: Record<FullscreenClockStyle, string> = {
  glass:
    "rounded-full bg-black/40 text-white/90 shadow-[0_8px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/10 backdrop-blur-xl",
  minimal: "rounded-md text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]",
  solid:
    "rounded-lg bg-black/85 text-white shadow-[0_8px_24px_rgba(0,0,0,0.32)] ring-1 ring-white/10",
  accent:
    "rounded-full bg-accent text-canvas shadow-[0_8px_28px_-8px_var(--color-accent)] ring-1 ring-white/10",
};

const SIZE_CLASSES: Record<ClockVariant, string> = {
  default: "min-w-[5.25rem] px-3.5 font-semibold",
  kids: "min-w-[6.5rem] px-4 font-extrabold",
  preview: "min-w-[5.75rem] px-3.5 font-semibold",
};

const END_TIME_CLASSES: Record<ClockVariant, string> = {
  default: "font-medium",
  kids: "font-bold",
  preview: "font-medium",
};

export function ClockDisplay({
  date,
  format,
  showSeconds,
  style,
  endDate,
  sizePx = DEFAULT_FULLSCREEN_CLOCK_SIZE_PX,
  variant = "default",
}: {
  date: Date;
  format: FullscreenClockFormat;
  showSeconds: boolean;
  style: FullscreenClockStyle;
  endDate?: Date | null;
  sizePx?: number;
  variant?: ClockVariant;
}) {
  const t = useT();
  const displaySizePx = variant === "kids" ? Math.max(sizePx, 16) : sizePx;
  const endTimeSizePx = Math.max(10, Math.round(displaySizePx * 0.8));
  const verticalSpacePx = variant === "kids" ? 32 : 23;

  return (
    <span className="pointer-events-none inline-flex shrink-0 flex-col items-center gap-1.5 font-sans">
      <time
        dateTime={date.toISOString()}
        className={`inline-flex shrink-0 items-center justify-center leading-none tabular-nums ${STYLE_CLASSES[style]} ${SIZE_CLASSES[variant]}`}
        style={{ fontSize: displaySizePx, minHeight: displaySizePx + verticalSpacePx }}
      >
        {formatLocalTime(date, format, showSeconds)}
      </time>
      {endDate && (
        <span
          className={`whitespace-nowrap text-white/70 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${END_TIME_CLASSES[variant]}`}
          style={{ fontSize: endTimeSizePx }}
        >
          {t("Ends at")}{" "}
          <time dateTime={endDate.toISOString()} className="tabular-nums text-white/90">
            {formatLocalTime(endDate, format)}
          </time>
        </span>
      )}
    </span>
  );
}

export function FullscreenClock({
  variant = "default",
  durationSec,
  playbackRate = 1,
  active = true,
}: {
  variant?: ClockVariant;
  durationSec?: number;
  playbackRate?: number;
  active?: boolean;
}) {
  const { settings } = useSettings();
  const {
    fullscreenClockEnabled: enabled,
    fullscreenClockFormat: format,
    fullscreenClockShowSeconds: showSeconds,
    fullscreenClockShowEndTime: showEndTime,
    fullscreenClockSizePx: sizePx,
    fullscreenClockStyle: style,
  } = settings;
  const [now, setNow] = useState(() => new Date());
  const trackEndTime =
    enabled &&
    showEndTime &&
    active &&
    variant !== "preview" &&
    typeof durationSec === "number" &&
    Number.isFinite(durationSec) &&
    durationSec > 0;
  const positionSec = usePlaybackPositionGated(trackEndTime);

  useEffect(() => {
    if (!enabled) return;

    let timeoutId = 0;

    const sync = () => {
      setNow(new Date());
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(sync, msUntilNextClockTick(Date.now(), showSeconds) + 25);
    };

    timeoutId = window.setTimeout(sync, msUntilNextClockTick(Date.now(), showSeconds) + 25);
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [enabled, showSeconds]);

  if (!enabled) return null;

  const endDate = showEndTime
    ? variant === "preview"
      ? new Date(now.getTime() + 47 * 60_000)
      : typeof durationSec === "number"
        ? estimatePlaybackEndTime(new Date(), durationSec, positionSec, playbackRate)
        : null
    : null;

  return (
    <ClockDisplay
      date={now}
      format={format}
      showSeconds={showSeconds}
      style={style}
      endDate={endDate}
      sizePx={sizePx}
      variant={variant}
    />
  );
}
