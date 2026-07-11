import { useT } from "@/lib/i18n";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";

import { Tooltip } from "./tooltip";

export function formatTime(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function Scrubber({
  time,
  duration,
  onSeek,
  onScrubStart,
  onScrubEnd,
}: {
  time: number;
  duration: number;
  onSeek: (ratio: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const [pointerPos, setPointerPos] = useState(0);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);

  const ratio = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 0;
  const display = active ? pointerPos : ratio;
  const expanded = hover || active;

  const ratioFrom = (clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return;
    const r = ratioFrom(e.clientX);
    setPointerPos(r);
    setActive(true);
    onScrubStart();
    onSeek(r);
    try {
      ref.current.setPointerCapture(e.pointerId);
    } catch {
      void 0;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = ratioFrom(e.clientX);
    setHoverRatio(r);
    if (active) {
      setPointerPos(r);
      onSeek(r);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    const r = ratioFrom(e.clientX);
    onSeek(r);
    setActive(false);
    onScrubEnd();
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch {
      void 0;
    }
  };

  const previewTime = hoverRatio != null && duration > 0 ? hoverRatio * duration : null;

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setHoverRatio(null);
      }}
      className="relative h-9 cursor-pointer touch-none select-none"
    >
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden bg-white/25 transition-[height] duration-150 ease-out"
        style={{ height: expanded ? 14 : 9 }}
      >
        <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${display * 100}%` }} />
      </div>
      <div
        className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_3px_12px_rgba(0,0,0,0.55)] transition-opacity duration-150"
        style={{
          left: `${display * 100}%`,
          opacity: expanded ? 1 : 0,
        }}
      />
      {expanded && previewTime != null && (
        <div
          className="pointer-events-none absolute -top-10 -translate-x-1/2 bg-black/90 px-2.5 py-1.5 text-[13px] font-mono tabular-nums text-white shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
          style={{ left: `${(hoverRatio ?? 0) * 100}%` }}
        >
          {formatTime(previewTime)}
        </div>
      )}
    </div>
  );
}

export function SpeedPill({ speed, onCycle }: { speed: number; onCycle: () => void }) {
  const t = useT();
  const label = `${speed}×`;
  return (
    <Tooltip label={t("Playback speed")}>
      <button
        onClick={onCycle}
        aria-label={t("Playback speed {label}", { label })}
        className="flex h-11 min-w-[48px] items-center justify-center rounded-md px-3 text-[13.5px] font-semibold tabular-nums tracking-wide text-white/90 transition-colors hover:bg-white/15 hover:text-white"
      >
        {label}
      </button>
    </Tooltip>
  );
}

export function PiPButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <Tooltip label={t("PiP")}>
      <button
        onClick={onClick}
        aria-label={active ? t("Exit Picture in Picture") : t("Picture in Picture")}
        className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors active:scale-95 ${
          active ? "bg-white/20 text-white" : "text-white/90 hover:bg-white/15 hover:text-white"
        }`}
      >
        <PipIcon size={22} />
      </button>
    </Tooltip>
  );
}

function PipIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="2.5" y="4" width="17" height="14" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="10.5" y="10.5" width="8" height="6" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function VolumeControl({
  volume,
  muted,
  onChange,
  onToggleMute,
}: {
  volume: number;
  muted: boolean;
  onChange: (v: number) => void;
  onToggleMute: () => void;
}) {
  const t = useT();
  const effective = muted ? 0 : volume;
  const Icon = muted || effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [hover, setHover] = useState(false);

  const ratioFrom = (clientX: number) => {
    const el = ref.current;
    if (!el) return effective;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !ref.current) return;
    setActive(true);
    onChange(ratioFrom(e.clientX));
    try {
      ref.current.setPointerCapture(e.pointerId);
    } catch {
      void 0;
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (active) onChange(ratioFrom(e.clientX));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setActive(false);
    try {
      ref.current?.releasePointerCapture(e.pointerId);
    } catch {
      void 0;
    }
  };

  const expanded = hover || active;

  return (
    <div className="flex items-center" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Tooltip label={muted ? t("Unmute · M") : t("Mute · M")}>
        <button
          onClick={onToggleMute}
          aria-label={muted ? t("Unmute") : t("Mute")}
          className="flex h-11 w-11 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/15 hover:text-white active:scale-95"
        >
          <Icon size={22} />
        </button>
      </Tooltip>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex h-11 w-[100px] cursor-pointer touch-none select-none items-center"
      >
        <div
          className="relative w-full overflow-hidden bg-white/35 transition-[height] duration-150 ease-out"
          style={{ height: expanded ? 6 : 4 }}
        >
          <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${effective * 100}%` }} />
        </div>
        <div
          className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.55)]"
          style={{ left: `${effective * 100}%` }}
        />
      </div>
    </div>
  );
}
