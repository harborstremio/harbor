import { usePlaybackPosition, usePlaybackBuffered } from "@/lib/player/playback-clock";
import { useRef, useState } from "react";

export function PipSeekBar({ durationSec, onSeek }: { durationSec: number; onSeek: (s: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const position = usePlaybackPosition();
  const buffered = usePlaybackBuffered();
  const dur = durationSec || 1;
  const value = scrub ?? position;
  const pct = Math.max(0, Math.min(1, value / dur)) * 100;
  const bufferedPct = Math.max(0, Math.min(1, (position + buffered) / dur)) * 100;

  const fromEvent = (clientX: number): number => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return 0;
    const x = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return x * dur;
  };

  const onMove = (e: React.PointerEvent) => {
    if (scrub != null) setScrub(fromEvent(e.clientX));
  };
  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(fromEvent(e.clientX));
  };
  const onUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (scrub != null) onSeek(scrub);
    setScrub(null);
  };

  return (
    <div
      dir="ltr"
      data-tauri-drag-region="false"
      className="pointer-events-auto group/pipseek relative h-5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        ref={ref}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 cursor-pointer"
      >
        <div className="h-[3px] w-full rounded-full bg-white/15 transition-[height] duration-150 group-hover/pipseek:h-[5px]">
          <div className="h-full rounded-full bg-white/28" style={{ width: `${bufferedPct}%` }} />
        </div>
        <div
          className="absolute h-[3px] rounded-full bg-accent transition-[height] duration-150 group-hover/pipseek:h-[5px]"
          style={{ width: `${pct}%`, top: "50%", transform: "translateY(-50%)" }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 shadow-[0_0_0_3px_rgba(0,0,0,0.45)] transition-[opacity,width,height] duration-150 group-hover/pipseek:opacity-100"
          style={{
            left: `${pct}%`,
            width: scrub != null ? 12 : 10,
            height: scrub != null ? 12 : 10,
          }}
        />
      </div>
    </div>
  );
}
