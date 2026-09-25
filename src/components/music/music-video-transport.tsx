import { useEffect, useRef, useState, type PointerEvent } from "react";
import { LoaderCircle, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { fmtTime } from "@/components/player/transport/transport-utils";
import { useT } from "@/lib/i18n";
import {
  nextMusic,
  previousMusic,
  seekMusic,
  toggleMusicPlayback,
  useMusicPlayer,
} from "@/lib/music/player";

const SETTLE_MS = 1200;

const STEP =
  "grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/75 transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";

const TIME = "text-[13px] font-medium tabular-nums text-white/70";

export function MusicVideoTransport({ awake, onWake }: { awake: boolean; onWake: () => void }) {
  const t = useT();
  const player = useMusicPlayer();
  const [scrub, setScrub] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const trackId = player.current?.id;
  useEffect(() => {
    draggingRef.current = false;
    setDragging(false);
    setScrub(null);
  }, [trackId]);
  useEffect(() => {
    if (scrub === null || dragging) return;
    if (Math.abs(player.currentTime - scrub) < 1.5) {
      setScrub(null);
      return;
    }
    const id = window.setTimeout(() => setScrub(null), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [scrub, dragging, player.currentTime]);

  const playing = player.phase === "playing";
  const resolving = player.phase === "resolving";
  const duration = Math.max(player.duration || player.current?.durationSeconds || 0, 1);
  const position = Math.max(0, Math.min(scrub ?? player.currentTime, duration));
  const percent = `${(position / duration) * 100}%`;

  const commit = (value: number) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    seekMusic(value);
  };
  const cancel = () => {
    draggingRef.current = false;
    setDragging(false);
    setScrub(null);
  };
  const release = (event: PointerEvent<HTMLInputElement>) =>
    commit(Number(event.currentTarget.value));

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 px-[clamp(16px,3.5vw,48px)] pt-16 pb-[clamp(14px,2.6vh,30px)] transition-opacity duration-200 motion-reduce:transition-none ${awake ? "opacity-100" : "opacity-0"}`}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
      />
      <div
        className={`relative flex flex-col gap-1 ${awake ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <div className="group relative h-11 w-full touch-none">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/25 transition-[height] duration-150 group-hover:h-1.5 motion-reduce:transition-none"
          >
            <span className="block h-full rounded-full bg-white" style={{ width: percent }} />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 -ms-1.5 size-3 -translate-y-1/2 rounded-full bg-white"
            style={{ insetInlineStart: `clamp(6px, ${percent}, calc(100% - 6px))` }}
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={position}
            disabled={resolving}
            aria-label={t("music.position")}
            aria-valuetext={`${fmtTime(position)} / ${fmtTime(duration)}`}
            onPointerDown={(event) => {
              if (event.button !== 0 || resolving) return;
              onWake();
              draggingRef.current = true;
              setDragging(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={release}
            onPointerCancel={cancel}
            onLostPointerCapture={() => {
              if (draggingRef.current) cancel();
            }}
            onBlur={(event) => commit(Number(event.currentTarget.value))}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              onWake();
              setScrub(value);
              if (!draggingRef.current) seekMusic(value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
          />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className={TIME}>{fmtTime(position)}</span>
          <span className="flex items-center justify-center gap-2">
            <button
              type="button"
              className={STEP}
              aria-label={t("music.previous")}
              title={t("music.previous")}
              onClick={() => previousMusic()}
            >
              <SkipBack size={20} fill="currentColor" aria-hidden />
            </button>
            <button
              type="button"
              disabled={resolving}
              aria-label={playing ? t("music.pause") : t("music.play")}
              title={playing ? t("music.pause") : t("music.play")}
              onClick={toggleMusicPlayback}
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-black transition-opacity duration-150 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-55 motion-reduce:transition-none"
            >
              {resolving ? (
                <LoaderCircle
                  size={22}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : playing ? (
                <Pause size={22} fill="currentColor" aria-hidden />
              ) : (
                <Play size={22} fill="currentColor" aria-hidden />
              )}
            </button>
            <button
              type="button"
              className={STEP}
              aria-label={t("music.next")}
              title={t("music.next")}
              onClick={() => nextMusic()}
            >
              <SkipForward size={20} fill="currentColor" aria-hidden />
            </button>
          </span>
          <span className={`${TIME} text-end`}>{fmtTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
