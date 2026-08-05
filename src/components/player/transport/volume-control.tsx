import { Minus, Plus, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import type { PlayerCapabilities, PlayerSnapshot } from "@/lib/player/bridge";
import type { VolumeStyle } from "@/lib/player-chrome";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
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
  const { settings } = useSettings();
  const boostMax = Math.max(1, Math.min(VOL_MAX, settings.volumeBoostMax || 2));
  const allowBoost = capabilities.engine === "mpv" && boostMax > 1;
  const max = allowBoost ? boostMax : 1;
  const v = snap.muted ? 0 : Math.max(0, Math.min(max, snap.volume));
  const trackRef = useRef<HTMLDivElement>(null);
  const [barNear, setBarNear] = useState(false);
  const [pinned, setPinned] = useState(false);

  const setFromClientX = (clientX: number) => {
    const t = trackRef.current;
    if (!t) return;
    const rect = t.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    let next = allowBoost ? valueFromFraction(f, boostMax) : f;
    if (Math.abs(next - 1) < 0.06) next = 1;
    else if (next < 0.03) next = 0;
    onVolume(Math.round(Math.min(max, next) * 100) / 100);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPinned(true);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    setFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setPinned(false);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.shiftKey ? 0.5 : 0.05;
    const next = Math.max(0, Math.min(max, v + (e.deltaY < 0 ? step : -step)));
    onVolume(Math.round(next * 100) / 100);
  };

  const fillFraction = allowBoost ? fractionFromValue(v, boostMax) : v;
  const color = boostColor(v, boostMax);
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
        {muted ? <VolumeX size={24} strokeWidth={1.75} /> : <Volume2 size={24} strokeWidth={1.75} />}
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

  const active = barNear || pinned;
  return (
    <div className="flex items-center gap-1.5" onWheel={onWheel}>
      {muteBtn}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onMouseEnter={() => setBarNear(true)}
        onMouseLeave={() => setBarNear(false)}
        className="relative flex h-12 shrink-0 cursor-pointer touch-none items-center"
        style={{ width: TRACK_WIDTH }}
      >
        <div
          className="pointer-events-none relative w-full rounded-full bg-white/[0.18] transition-[height] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
          style={{ height: active ? 8 : 4 }}
        >
          {allowBoost && (
            <div
              className="absolute inset-y-0 rounded-r-full"
              style={{
                left: `${breakPct}%`,
                right: 0,
                background: "linear-gradient(to right, rgba(245,158,11,0.18), rgba(220,38,38,0.26))",
              }}
            />
          )}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${filledPct}%`, background: fillBackground }}
          />
          {allowBoost && (
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 transition-[height] duration-200"
              style={{ left: `${breakPct}%`, width: 2, height: active ? 12 : 8 }}
            />
          )}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[width,height] duration-200 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
            style={{
              left: `${filledPct}%`,
              width: active ? 17 : 12,
              height: active ? 17 : 12,
              background: boosting ? color : "white",
              boxShadow: active ? "0 2px 10px rgba(0,0,0,0.55)" : "0 1px 5px rgba(0,0,0,0.5)",
            }}
          />
          <div
            className={`absolute bottom-full mb-3 -translate-x-1/2 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums backdrop-blur-sm transition-[opacity,transform] duration-150 ${
              active || boosting ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            }`}
            style={{ left: `${filledPct}%`, color: boosting ? color : "rgba(255,255,255,0.95)" }}
          >
            {pct}%
          </div>
        </div>
      </div>
    </div>
  );
}
