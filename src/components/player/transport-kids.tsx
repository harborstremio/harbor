import {
  ArrowLeft,
  Captions,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Shuffle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef, useState } from "react";
import type { PlayerCapabilities, PlayerSnapshot } from "@/lib/player/bridge";
import { useT } from "@/lib/i18n";
import { fmtTime } from "./transport/transport-utils";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function TransportKids({
  snap,
  visible,
  fullscreen,
  title,
  resolution,
  onBack,
  onPlayPause,
  onSeek,
  onSeekStep,
  onMute,
  onVolume,
  onSubtitle,
  onFullscreen,
  onPickAnother,
  canPickAnother,
}: {
  snap: PlayerSnapshot;
  capabilities: PlayerCapabilities;
  visible: boolean;
  fullscreen: boolean;
  title: string;
  resolution?: string | null;
  onBack: () => void;
  onPlayPause: () => void;
  onSeek: (sec: number) => void;
  onSeekStep: (delta: number) => void;
  onMute: () => void;
  onVolume: (v: number) => void;
  onSubtitle: (id: string | null) => void;
  onFullscreen: () => void;
  onPickAnother: () => void;
  canPickAnother: boolean;
}) {
  const t = useT();
  const playing = snap.status === "playing";
  const subActive = snap.subtitleTracks.some((s) => s.selected);
  const firstSub = snap.subtitleTracks[0];
  const toggleSub = () => {
    if (subActive) onSubtitle(null);
    else if (firstSub) onSubtitle(firstSub.id);
  };
  return (
    <>
      <div
        data-tauri-drag-region={fullscreen ? undefined : ""}
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/65 via-black/20 to-transparent px-7 pb-12 pt-5 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          onClick={onBack}
          className="pointer-events-auto flex h-14 items-center gap-2.5 rounded-full bg-white/90 ps-4 pe-6 text-[18px] font-extrabold text-[#0e3a43] shadow-[0_10px_26px_-10px_rgba(0,0,0,0.6)] transition-transform hover:scale-105 active:scale-95"
        >
          <ArrowLeft size={26} strokeWidth={2.8} className="dir-icon" />
          {t("common.back")}
        </button>
        <div className="pointer-events-none flex min-w-0 items-center gap-3 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          <span className="truncate font-display text-[22px] font-bold">{title}</span>
          {resolution && (
            <span className="shrink-0 rounded-full bg-white/20 px-3 py-1 text-[13px] font-extrabold uppercase">
              {resolution}
            </span>
          )}
        </div>
        <div className="w-14 shrink-0" />
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-5 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-8 pb-8 pt-14 transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-5">
          <span className="w-[68px] shrink-0 font-mono text-[17px] font-bold tabular-nums text-white">
            {fmtTime(snap.positionSec)}
          </span>
          <KidsSeekBar
            position={snap.positionSec}
            duration={snap.durationSec}
            buffered={snap.bufferedSec}
            onSeek={onSeek}
          />
          <span className="w-[68px] shrink-0 text-end font-mono text-[17px] font-bold tabular-nums text-white">
            {fmtTime(snap.durationSec)}
          </span>
        </div>

        <div className="pointer-events-auto grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center justify-self-start">
            <KidsVolume
              volume={snap.volume}
              muted={snap.muted}
              onMute={onMute}
              onVolume={onVolume}
            />
          </div>

          <div className="flex items-center gap-6 justify-self-center">
            <SeekBtn dir={-1} onClick={() => onSeekStep(-10)} label={t("Back 10s")} />
            <button
              onClick={onPlayPause}
              data-player-play-pause
              aria-label={playing ? t("Pause") : t("Play")}
              className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white text-[#1f8f88] shadow-[0_14px_36px_-10px_rgba(0,0,0,0.7)] transition-transform hover:scale-105 active:scale-95"
            >
              {playing ? (
                <Pause size={46} strokeWidth={0} fill="currentColor" />
              ) : (
                <Play size={46} strokeWidth={0} fill="currentColor" className="ms-1.5" />
              )}
            </button>
            <SeekBtn dir={1} onClick={() => onSeekStep(10)} label={t("Forward 10s")} />
          </div>

          <div className="flex items-center gap-3 justify-self-end">
            {snap.subtitleTracks.length > 0 && (
              <RoundBtn onClick={toggleSub} active={subActive} label={t("Subtitles")}>
                <Captions size={28} strokeWidth={2.2} />
              </RoundBtn>
            )}
            {canPickAnother && (
              <button
                onClick={onPickAnother}
                className="flex h-16 shrink-0 items-center gap-2 rounded-full bg-white/15 ps-5 pe-6 text-[16px] font-extrabold text-white transition hover:bg-white/25 active:scale-95"
              >
                <Shuffle size={24} strokeWidth={2.4} />
                {t("Switch")}
              </button>
            )}
            <RoundBtn onClick={onFullscreen} label={t("Fullscreen")}>
              {fullscreen ? (
                <Minimize size={28} strokeWidth={2.2} />
              ) : (
                <Maximize size={28} strokeWidth={2.2} />
              )}
            </RoundBtn>
          </div>
        </div>
      </div>
    </>
  );
}

function KidsSeekBar({
  position,
  duration,
  buffered,
  onSeek,
}: {
  position: number;
  duration: number;
  buffered: number;
  onSeek: (sec: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const frac = drag != null ? drag : duration > 0 ? clamp01(position / duration) : 0;
  const bufferedEnd = duration > 0 ? clamp01((position + buffered) / duration) : 0;
  const fromX = (clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return clamp01((clientX - r.left) / r.width);
  };
  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(fromX(e.clientX));
      }}
      onPointerMove={(e) => {
        if (!(e.buttons & 1)) return;
        setDrag(fromX(e.clientX));
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (drag != null && duration > 0) onSeek(drag * duration);
        setDrag(null);
      }}
      className="relative h-5 flex-1 cursor-pointer rounded-full bg-white/25 ring-1 ring-white/20"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-white/45"
        style={{ width: `${bufferedEnd * 100}%` }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-white"
        style={{ width: `${frac * 100}%` }}
      />
      <div
        className="pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_12px_rgba(0,0,0,0.6)] ring-4 ring-[#1f8f88]/30"
        style={{ left: `${frac * 100}%` }}
      />
    </div>
  );
}

function KidsVolume({
  volume,
  muted,
  onMute,
  onVolume,
}: {
  volume: number;
  muted: boolean;
  onMute: () => void;
  onVolume: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const v = muted ? 0 : clamp01(volume);
  const fromX = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onVolume(Math.round(clamp01((clientX - r.left) / r.width) * 100) / 100);
  };
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onMute}
        aria-label={v === 0 ? "Unmute" : "Mute"}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
      >
        {v === 0 ? (
          <VolumeX size={28} strokeWidth={2.2} />
        ) : (
          <Volume2 size={28} strokeWidth={2.2} />
        )}
      </button>
      <div
        ref={ref}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!(e.buttons & 1)) return;
          fromX(e.clientX);
        }}
        className="relative h-4 w-36 cursor-pointer rounded-full bg-white/25"
      >
        <div
          className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${v * 100}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          style={{ left: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}

function SeekBtn({ dir, onClick, label }: { dir: -1 | 1; onClick: () => void; label: string }) {
  const Icon = dir < 0 ? RotateCcw : RotateCw;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
    >
      <Icon size={42} strokeWidth={2.1} />
      <span className="absolute text-[13px] font-extrabold">10</span>
    </button>
  );
}

function RoundBtn({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
        active ? "bg-white text-[#1f8f88]" : "bg-white/15 text-white hover:bg-white/25"
      }`}
    >
      {children}
    </button>
  );
}
