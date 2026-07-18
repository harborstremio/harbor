import { Minus, Plus, Volume2, VolumeX } from "lucide-react";
import { useRef } from "react";
import type { PlayerCapabilities, PlayerSnapshot } from "@/lib/player/bridge";
import type { VolumeStyle } from "@/lib/player-chrome";
import { useT } from "@/lib/i18n";
import { Tooltip } from "./tooltip";
import {
  NORMAL_FRACTION,
  TRACK_WIDTH,
  VOL_MAX,
  boostColor,
  fractionFromValue,
  valueFromFraction,
} from "./transport-utils";

export function VolumeControl({
  snap,
  onMute,
  onVolume,
  capabilities,
  style = "slider",
}: {
  snap: PlayerSnapshot;
  onMute: () => void;
  onVolume: (v: number) => void;
  capabilities: PlayerCapabilities;
  style?: VolumeStyle;
}) {
  const tr = useT();
  const allowBoost = capabilities.engine === "mpv";
  const max = allowBoost ? VOL_MAX : 1;
  const v = snap.muted ? 0 : Math.max(0, Math.min(max, snap.volume));
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientX = (clientX: number) => {
    const t = trackRef.current;
    if (!t) return;
    const rect = t.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const next = allowBoost ? valueFromFraction(f) : f;
    onVolume(Math.round(Math.min(max, next) * 100) / 100);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    setFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.shiftKey ? 0.5 : 0.05;
    const next = Math.max(0, Math.min(max, v + (e.deltaY < 0 ? step : -step)));
    onVolume(Math.round(next * 100) / 100);
  };

  const fillFraction = allowBoost ? fractionFromValue(v) : v;
  const color = boostColor(v);
  const muted = snap.muted || v === 0;
  const pct = Math.round(v * 100);
  const boosting = allowBoost && v > 1.001;
  const label = muted ? tr("Unmute") : tr("Mute");

  const breakPct = NORMAL_FRACTION * 100;
  const filledPct = fillFraction * 100;
  const fillBackground =
    v <= 1
      ? "rgba(255,255,255,0.92)"
      : `linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) ${
          (breakPct / filledPct) * 100
        }%, #f97316 ${(breakPct / filledPct) * 100}%, ${color} 100%)`;

  const muteBtn = (
    <Tooltip label={label}>
      <button
        onClick={onMute}
        className="flex h-12 w-12 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={label}
      >
        {muted ? (
          <VolumeX size={24} strokeWidth={1.75} />
        ) : (
          <Volume2 size={24} strokeWidth={1.75} />
        )}
      </button>
    </Tooltip>
  );

  if (style === "icon-only") {
    return (
      <div className="flex items-center" onWheel={onWheel}>
        {muteBtn}
      </div>
    );
  }

  if (style === "stepper") {
    const step = (delta: number) => {
      const next = Math.max(0, Math.min(max, v + delta));
      onVolume(Math.round(next * 100) / 100);
    };
    return (
      <div className="flex items-center gap-1" onWheel={onWheel}>
        {muteBtn}
        <Tooltip label={tr("Volume down")}>
          <button
            onClick={() => step(-0.05)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={tr("Volume down")}
          >
            <Minus size={16} strokeWidth={2.4} />
          </button>
        </Tooltip>
        <span className="min-w-[2.5rem] text-center font-mono text-[12px] tabular-nums text-white/85">
          {pct}%
        </span>
        <Tooltip label={tr("Volume up")}>
          <button
            onClick={() => step(0.05)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={tr("Volume up")}
          >
            <Plus size={16} strokeWidth={2.4} />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" onWheel={onWheel}>
      {muteBtn}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-2 shrink-0 cursor-pointer rounded-full bg-white/15"
        style={{ width: TRACK_WIDTH }}
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${filledPct}%`, background: fillBackground }}
        />
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${filledPct}%`,
            width: 14,
            height: 14,
            background: boosting ? color : "white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}
        />
      </div>
      {boosting && (
        <span
          className="text-[12px] font-semibold tabular-nums leading-none"
          style={{ color, minWidth: 36 }}
        >
          {pct}%
        </span>
      )}
    </div>
  );
}
