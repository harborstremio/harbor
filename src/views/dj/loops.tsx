import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { sendDeckCommand } from "@/lib/music/deck-sync";
import { Hardware } from "./controls";
import { preciseClock } from "./deck-state";

const BEATS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
const TAP_WINDOW = 2400;

function beatLabel(beats: number): string {
  if (beats >= 1) return String(beats);
  return beats === 0.5 ? "1/2" : "1/4";
}

export function LoopBay({
  trackId,
  duration,
  readPosition,
  bpm,
  onBpm,
}: {
  trackId: string;
  duration: number;
  readPosition: () => number;
  bpm: number | null;
  onBpm: (bpm: number | null) => void;
}) {
  const t = useT();
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    setStart(null);
    setEnd(null);
    setActive(false);
    sendDeckCommand({ kind: "loop", start: null, end: null });
  }, [trackId]);

  const apply = useCallback((from: number | null, to: number | null) => {
    setStart(from);
    setEnd(to);
    const on = from !== null && to !== null && to > from;
    setActive(on);
    sendDeckCommand({ kind: "loop", start: on ? from : null, end: on ? to : null });
  }, []);

  const markIn = () => apply(readPosition(), end !== null && end > readPosition() ? end : null);
  const markOut = () => {
    const from = start ?? 0;
    const to = readPosition();
    if (to <= from + 0.05) return;
    apply(from, to);
  };

  const beatLoop = (beats: number) => {
    const length = bpm ? (60 / bpm) * beats * 4 : beats;
    const from = active && start !== null ? start : readPosition();
    const to = duration > 0 ? Math.min(duration, from + length) : from + length;
    apply(from, to);
  };

  const resize = (scale: number) => {
    if (start === null || end === null) return;
    const length = Math.max(0.05, (end - start) * scale);
    apply(start, duration > 0 ? Math.min(duration, start + length) : start + length);
  };

  const exit = () => {
    setActive(false);
    sendDeckCommand({ kind: "loop", start: null, end: null });
  };

  const reloop = () => {
    if (start === null || end === null) return;
    sendDeckCommand({ kind: "seek", seconds: start });
    setActive(true);
    sendDeckCommand({ kind: "loop", start, end });
  };

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((at) => now - at < TAP_WINDOW), now];
    if (taps.current.length < 3) return;
    const gaps = taps.current.slice(1).map((at, index) => at - taps.current[index]);
    const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (mean > 0) onBpm(Math.round((60000 / mean) * 10) / 10);
  };

  return (
    <div className="dj-bay">
      <div className="dj-bay-head">
        <span>{t("dj.loop.title")}</span>
        <span className="dj-bay-note">
          {start !== null && end !== null
            ? `${preciseClock(start)} - ${preciseClock(end)}`
            : t("dj.loop.idle")}
        </span>
      </div>
      <div className="dj-bay-row">
        <Hardware tone="amber" label={t("dj.loop.in")} lit={start !== null} onClick={markIn} />
        <Hardware tone="amber" label={t("dj.loop.out")} lit={end !== null} onClick={markOut} />
        <Hardware
          tone="green"
          label={t("dj.loop.reloop")}
          disabled={start === null || end === null}
          onClick={active ? exit : reloop}
          lit={active}
        />
        <Hardware
          tone="steel"
          label={t("dj.loop.halve")}
          disabled={!active}
          onClick={() => resize(0.5)}
        />
        <Hardware
          tone="steel"
          label={t("dj.loop.double")}
          disabled={!active}
          onClick={() => resize(2)}
        />
      </div>
      <div className="dj-strip dj-bay-beats">
        {BEATS.map((beats) => (
          <Hardware
            key={beats}
            tone="cyan"
            label={bpm ? `${beatLabel(beats)}` : `${beats}s`}
            onClick={() => beatLoop(beats)}
          />
        ))}
        <Hardware tone="red" label={bpm ? `${bpm} ${t("dj.bpm")}` : t("dj.tap")} onClick={tap} wide />
      </div>
    </div>
  );
}
