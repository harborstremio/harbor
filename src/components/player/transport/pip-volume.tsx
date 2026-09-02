import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { useT } from "@/lib/i18n";
import { watchOutsideMouseDown } from "@/lib/player/overlay-dismiss";

export function PipVolume({
  snap,
  muted,
  onMute,
  onVolume,
}: {
  snap: PlayerSnapshot;
  muted: boolean;
  onMute: () => void;
  onVolume: (v: number) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const armClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 800);
  };
  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    return watchOutsideMouseDown(onDown);
  }, [open]);
  return (
    <div
      ref={wrapRef}
      className="relative flex items-center"
      onMouseEnter={cancelClose}
      onMouseLeave={armClose}
    >
      <button
        type="button"
        onClick={onMute}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => setOpen(true)}
        aria-label={muted ? t("Unmute") : t("Mute")}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      >
        {muted ? <VolumeX size={16} strokeWidth={2.2} /> : <Volume2 size={16} strokeWidth={2.2} />}
      </button>
      {open && (
        <div
          data-tauri-drag-region="false"
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 flex h-7 items-center gap-2 rounded-full border border-white/12 bg-black/85 px-3 backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]"
        >
          <input
            type="range"
            min={0}
            max={6}
            step={0.05}
            value={muted ? 0 : snap.volume}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            className="h-1 w-32 appearance-none rounded-full bg-white/22"
            aria-label={t("Volume")}
            style={{
              accentColor: snap.volume > 1 ? `hsl(${Math.max(0, 30 - (snap.volume - 1) * 6)}, 95%, 60%)` : "#ffffff",
            }}
          />
          <span
            className="font-mono text-[10.5px] tabular-nums"
            style={{
              color: snap.volume > 1 ? `hsl(${Math.max(0, 30 - (snap.volume - 1) * 6)}, 95%, 65%)` : "rgba(255,255,255,0.75)",
            }}
          >
            {Math.round((muted ? 0 : snap.volume) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
