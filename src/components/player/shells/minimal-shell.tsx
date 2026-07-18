import { ChevronLeft, Maximize, Minimize, Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import type { PlayerShellProps } from "@/lib/player-shells/types";
import { usePlaybackPositionGated } from "@/lib/player/playback-clock";
import { useT } from "@/lib/i18n";

export function MinimalShell({
  snap,
  visible,
  fullscreen,
  pipMode,
  onBack,
  onPlayPause,
  onSeek,
  onFullscreen,
  title,
}: PlayerShellProps) {
  const t = useT();
  if (pipMode) return null;

  const playing = snap.status === "playing";

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent px-8 pb-5 pt-12 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/85"
          aria-label={t("Back")}
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
        </button>
        <button
          onClick={onPlayPause}
          data-player-play-pause
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-colors hover:bg-white/25"
          aria-label={playing ? t("Pause") : t("Play")}
        >
          {playing ? (
            <Pause size={22} strokeWidth={1.8} fill="currentColor" />
          ) : (
            <Play size={22} strokeWidth={1.8} fill="currentColor" className="ml-0.5" />
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
            {title}
          </span>
          <MinimalTime durationSec={snap.durationSec} visible={visible} />
        </div>
        <button
          onClick={onFullscreen}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/85"
          aria-label={fullscreen ? t("Exit fullscreen") : t("Fullscreen")}
        >
          {fullscreen ? (
            <Minimize size={16} strokeWidth={2.2} />
          ) : (
            <Maximize size={16} strokeWidth={2.2} />
          )}
        </button>
      </div>
      <MinimalTrack durationSec={snap.durationSec} visible={visible} onSeek={onSeek} />
    </div>
  );
}

function MinimalTime({ durationSec, visible }: { durationSec: number; visible: boolean }) {
  const positionSec = usePlaybackPositionGated(visible);
  return (
    <span className="font-mono text-[11.5px] tabular-nums text-white/70">
      {fmt(positionSec)} / {fmt(durationSec)}
    </span>
  );
}

function MinimalTrack({
  durationSec,
  visible,
  onSeek,
}: {
  durationSec: number;
  visible: boolean;
  onSeek: (sec: number) => void;
}) {
  const positionSec = usePlaybackPositionGated(visible);
  const duration = durationSec || 1;
  const ratio = Math.max(0, Math.min(1, positionSec / duration));
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverRatio, setHoverRatio] = useState<number | null>(null);
  const lastEmitAtRef = useRef(0);
  const lastDragSecRef = useRef<number | null>(null);

  const seekFromClient = (clientX: number, final = false) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const sec = x * duration;
    lastDragSecRef.current = sec;
    const now = Date.now();
    if (!final && now - lastEmitAtRef.current < 150) return;
    lastEmitAtRef.current = now;
    onSeek(sec);
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        seekFromClient(e.clientX);
      }}
      onPointerMove={(e) => {
        const r = trackRef.current?.getBoundingClientRect();
        if (!r) return;
        const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        setHoverRatio(x);
        if (e.buttons === 1) seekFromClient(e.clientX);
      }}
      onPointerUp={(e) => {
        if (lastDragSecRef.current == null) return;
        lastDragSecRef.current = null;
        seekFromClient(e.clientX, true);
      }}
      onPointerLeave={() => setHoverRatio(null)}
      className="pointer-events-auto relative h-1.5 cursor-pointer overflow-hidden rounded-full bg-white/12"
    >
      <div
        className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-150"
        style={{ width: `${ratio * 100}%` }}
      />
      {hoverRatio != null && hoverRatio !== ratio && (
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 bg-white/25"
          style={{ width: `${hoverRatio * 100}%` }}
        />
      )}
    </div>
  );
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
