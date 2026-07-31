import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import {
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
  default: "h-9 min-w-[5.25rem] px-3.5 text-[13px] font-semibold",
  kids: "h-12 min-w-[6.5rem] px-4 text-[16px] font-extrabold",
  preview: "h-9 min-w-[5.75rem] px-3.5 text-[13px] font-semibold",
};

export function ClockDisplay({
  date,
  format,
  showSeconds,
  style,
  variant = "default",
}: {
  date: Date;
  format: FullscreenClockFormat;
  showSeconds: boolean;
  style: FullscreenClockStyle;
  variant?: ClockVariant;
}) {
  return (
    <time
      dateTime={date.toISOString()}
      className={`pointer-events-none inline-flex shrink-0 items-center justify-center tabular-nums ${STYLE_CLASSES[style]} ${SIZE_CLASSES[variant]}`}
    >
      {formatLocalTime(date, format, showSeconds)}
    </time>
  );
}

export function FullscreenClock({ variant = "default" }: { variant?: ClockVariant }) {
  const { settings } = useSettings();
  const {
    fullscreenClockEnabled: enabled,
    fullscreenClockFormat: format,
    fullscreenClockShowSeconds: showSeconds,
    fullscreenClockStyle: style,
  } = settings;
  const [now, setNow] = useState(() => new Date());

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

  return (
    <ClockDisplay
      date={now}
      format={format}
      showSeconds={showSeconds}
      style={style}
      variant={variant}
    />
  );
}
