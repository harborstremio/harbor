import { useT } from "@/lib/i18n";
import { usePlaybackPosition, usePlaybackPositionGated, usePlaybackBufferedGated } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import { useRef, useState } from "react";

import { SeekBarVisual } from "./seek-bar-visual";

const LIVE_BEHIND_THRESHOLD_SEC = 30;
const LIVE_EDGE_PAD_SEC = 2;
const LIVE_WINDOW_SEC = 300;
const LIVE_NEAR_EDGE_PAD_SEC = 12;

export function LiveBadge() {
  const t = useT();
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.22em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
      <span className="h-2 w-2 rounded-full bg-danger shadow-[0_0_8px_var(--color-danger)]" />
      {t("Live")}
    </span>
  );
}

export function GoToLive({ durationSec, onSeek }: { durationSec: number; onSeek: (sec: number) => void }) {
  const t = useT();
  const position = usePlaybackPosition();
  const offset = Math.max(0, durationSec - position - LIVE_NEAR_EDGE_PAD_SEC);
  if (!(durationSec > 0 && offset > LIVE_BEHIND_THRESHOLD_SEC)) return null;
  const minutesBehind = Math.floor(offset / 60);
  const secondsBehind = Math.floor(offset % 60);
  const behindLabel = minutesBehind > 0 ? `${minutesBehind}m ${secondsBehind}s` : `${secondsBehind}s`;
  return (
    <button
      onClick={() => onSeek(Math.max(0, durationSec - LIVE_EDGE_PAD_SEC))}
      className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/85 transition-colors hover:text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
      title={t("Jump to live edge")}
    >
      {t("Go to live")}{" "}
      <span className="ms-0.5 font-mono lowercase tracking-normal text-white/55">· {behindLabel}</span>
    </button>
  );
}

function formatRewindLabel(
  secondsBack: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (secondsBack < 5) return t("Live");
  if (secondsBack < 60) return t("{s}s ago", { s: Math.floor(secondsBack) });
  const m = Math.floor(secondsBack / 60);
  const s = Math.floor(secondsBack % 60);
  return s > 0 ? t("{m}m {s}s ago", { m, s }) : t("{m}m ago", { m });
}

export function LiveSeekBar({
  durationSec,
  onSeek,
  active,
}: {
  durationSec: number;
  onSeek: (sec: number) => void;
  active: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const { settings } = useSettings();
  const position = usePlaybackPositionGated(active);
  const buffered = usePlaybackBufferedGated(active);
  const dur = durationSec;

  const rawOffset = scrub != null ? Math.max(0, dur - scrub) : Math.max(0, dur - position - LIVE_NEAR_EDGE_PAD_SEC);
  const pct = Math.max(0, Math.min(1, 1 - rawOffset / LIVE_WINDOW_SEC)) * 100;

  const bufferOffset = Math.max(0, dur - (position + buffered) - LIVE_NEAR_EDGE_PAD_SEC);
  const bufferedPct = Math.max(0, Math.min(1, 1 - bufferOffset / LIVE_WINDOW_SEC)) * 100;

  const fromEvent = (clientX: number): number => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return 0;
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return dur - (1 - x) * LIVE_WINDOW_SEC;
  };

  const onMove = (e: React.PointerEvent) => {
    setHover(fromEvent(e.clientX));
    if (scrub != null) setScrub(fromEvent(e.clientX));
  };
  const onLeave = () => setHover(null);
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(fromEvent(e.clientX));
  };
  const onUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (scrub != null) onSeek(scrub);
    setScrub(null);
  };

  const hoverPct =
    hover != null ? Math.max(0, Math.min(1, 1 - Math.max(0, dur - hover) / LIVE_WINDOW_SEC)) * 100 : null;
  const hoverLabel = hover != null ? formatRewindLabel(Math.max(0, dur - hover), t) : null;

  return (
    <div className="pointer-events-auto group/seek relative h-12">
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onPointerDown={onDown}
        onPointerUp={onUp}
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 cursor-pointer"
      >
        <SeekBarVisual
          settings={settings}
          pct={pct}
          bufferedPct={bufferedPct}
          scrubbing={scrub != null}
          hovered={hover != null}
        />
        {hoverPct != null && hoverLabel != null && (
          <div
            className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded-md border border-white/10 bg-black/90 px-2 py-1 font-mono text-[12px] font-semibold tabular-nums text-white shadow-lg backdrop-blur-md"
            style={{ left: `${hoverPct}%` }}
          >
            {hoverLabel}
          </div>
        )}
      </div>
    </div>
  );
}
