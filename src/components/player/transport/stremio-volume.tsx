import { useT } from "@/lib/i18n";
import type { VolumeStyle } from "@/lib/player-chrome";
import type { PlayerCapabilities, PlayerSnapshot } from "@/lib/player/bridge";
import { Minus, Plus, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";

import { Tooltip } from "./tooltip";
import { fractionFromValue, NORMAL_FRACTION, valueFromFraction, VOL_MAX, boostColor } from "./transport-utils";

export function StremioVolume({
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
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [barNear, setBarNear] = useState(false);
  const allowBoost = capabilities.engine === "mpv";
  const max = allowBoost ? VOL_MAX : 1;
  const v = snap.muted ? 0 : Math.max(0, Math.min(max, snap.volume));
  const muted = snap.muted || v === 0;
  const trackRef = useRef<HTMLDivElement>(null);
  const fill = allowBoost ? fractionFromValue(v) : v;
  const fillPct = fill * 100;
  const boosting = allowBoost && v > 1.001;
  const pct = Math.round(v * 100);

  const setFromClientY = (clientY: number) => {
    const t = trackRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, 1 - (clientY - r.top) / r.height));
    const next = allowBoost ? valueFromFraction(f) : f;
    onVolume(Math.round(Math.min(max, next) * 100) / 100);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setPinned(true);
    setFromClientY(e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    setFromClientY(e.clientY);
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

  const showPopup = (hover || pinned) && style === "slider";
  const barWide = barNear || pinned;
  const breakPct = NORMAL_FRACTION * 100;
  const trackGradient = allowBoost
    ? `linear-gradient(to top, #ffffff 0%, #fde68a ${breakPct * 0.5}%, #f59e0b ${breakPct}%, #dc2626 100%)`
    : "#ffffff";

  if (style === "icon-only") {
    return (
      <Tooltip label={muted ? tr("Unmute") : tr("Mute")}>
        <button
          type="button"
          onClick={onMute}
          aria-label={muted ? tr("Unmute") : tr("Mute")}
          onWheel={onWheel}
          className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-xl text-white/90 transition-colors duration-150 hover:bg-white/[0.05]"
        >
          {muted ? <VolumeX size={28} strokeWidth={1.9} /> : <Volume2 size={28} strokeWidth={1.9} />}
        </button>
      </Tooltip>
    );
  }

  if (style === "stepper") {
    const step = (delta: number) => {
      const next = Math.max(0, Math.min(max, v + delta));
      onVolume(Math.round(next * 100) / 100);
    };
    return (
      <div className="pointer-events-auto flex items-center gap-1" onWheel={onWheel}>
        <Tooltip label={muted ? tr("Unmute") : tr("Mute")}>
          <button
            type="button"
            onClick={onMute}
            aria-label={muted ? tr("Unmute") : tr("Mute")}
            className="flex h-12 w-12 items-center justify-center rounded-xl text-white/90 transition-colors hover:bg-white/[0.05]"
          >
            {muted ? <VolumeX size={26} strokeWidth={1.9} /> : <Volume2 size={26} strokeWidth={1.9} />}
          </button>
        </Tooltip>
        <button
          type="button"
          onClick={() => step(-0.05)}
          aria-label={tr("Volume down")}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/85 transition-colors hover:bg-white/[0.05]"
        >
          <Minus size={18} strokeWidth={2.3} />
        </button>
        <span className="min-w-[2.5rem] text-center font-mono text-[13px] tabular-nums text-white/85">{pct}%</span>
        <button
          type="button"
          onClick={() => step(0.05)}
          aria-label={tr("Volume up")}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white/85 transition-colors hover:bg-white/[0.05]"
        >
          <Plus size={18} strokeWidth={2.3} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-auto relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={(e) => {
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        setHover(false);
      }}
      onWheel={onWheel}
    >
      {showPopup ? (
        <button
          type="button"
          onClick={onMute}
          aria-label={muted ? tr("Unmute") : tr("Mute")}
          className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-xl text-white/90 transition-colors duration-150 hover:bg-white/[0.05]"
        >
          {muted ? <VolumeX size={28} strokeWidth={1.9} /> : <Volume2 size={28} strokeWidth={1.9} />}
        </button>
      ) : (
        <Tooltip label={muted ? tr("Unmute") : tr("Mute")}>
          <button
            type="button"
            onClick={onMute}
            aria-label={muted ? tr("Unmute") : tr("Mute")}
            className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-xl text-white/90 transition-colors duration-150 hover:bg-white/[0.05]"
          >
            {muted ? <VolumeX size={28} strokeWidth={1.9} /> : <Volume2 size={28} strokeWidth={1.9} />}
          </button>
        </Tooltip>
      )}
      <div
        aria-hidden={!showPopup}
        className={`absolute bottom-full left-1/2 flex origin-bottom -translate-x-1/2 flex-col items-center rounded-[20px] border border-white/12 bg-black/85 px-3 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.7)] backdrop-blur-md transition-[opacity,transform] duration-200 ease-out ${
          showPopup ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onMouseEnter={() => setBarNear(true)}
          onMouseLeave={() => setBarNear(false)}
          className="relative flex h-44 w-9 cursor-pointer touch-none items-stretch justify-center"
        >
          <div
            className="relative self-stretch rounded-full bg-white/25 transition-[width] duration-150 ease-out"
            style={{ width: barWide ? "13px" : "6px" }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 rounded-full"
              style={{ height: `${fillPct}%`, background: trackGradient }}
            />
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full border-[2px] border-white bg-white shadow-[0_2px_8px_rgba(0,0,0,0.65)] transition-[width,height] duration-150 ease-out"
              style={{
                width: barWide ? "21px" : "15px",
                height: barWide ? "21px" : "15px",
                bottom: `${fillPct}%`,
                backgroundColor: boosting ? boostColor(v) : "#ffffff",
              }}
            />
          </div>
        </div>
        <div
          className="mt-2 text-[11.5px] font-semibold leading-none tabular-nums transition-colors"
          style={{ color: boosting ? boostColor(v) : "rgba(255,255,255,0.92)" }}
        >
          {pct}%
        </div>
      </div>
    </div>
  );
}
