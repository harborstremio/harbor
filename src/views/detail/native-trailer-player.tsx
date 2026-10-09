import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Tooltip } from "./tooltip";
import { PiPButton, Scrubber, SpeedPill, VolumeControl, formatTime } from "./trailer-controls";

const PLAYBACK_SPEEDS = [1, 1.25, 1.5, 2] as const;
const CHROME_HIDE_MS = 2400;

export function NativeTrailerPlayer({
  src,
  videoRef,
}: {
  src: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const t = useT();
  const ref = videoRef;
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [showRemaining, setShowRemaining] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const hideTimer = useRef<number | null>(null);

  const wake = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current != null) clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const v = ref.current;
      if (v && !v.paused && !scrubbing) setChromeVisible(false);
    }, CHROME_HIDE_MS);
  }, [scrubbing]);

  useEffect(
    () => () => {
      if (hideTimer.current != null) clearTimeout(hideTimer.current);
    },
    [],
  );

  useEffect(() => {
    setPipSupported(typeof document !== "undefined" && document.pictureInPictureEnabled === true);
  }, []);

  useEffect(
    () => () => {
      const v = ref.current;
      if (!v) return;
      try {
        v.pause();
        if (typeof document !== "undefined" && document.pictureInPictureElement === v) {
          document.exitPictureInPicture().catch(() => {});
        }
        v.removeAttribute("src");
        v.load();
      } catch {
        void 0;
      }
    },
    [ref],
  );

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekTo = useCallback((ratio: number) => {
    const v = ref.current;
    if (!v || !isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, ratio * v.duration));
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = ref.current;
    if (!v || !isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }, []);

  const applyVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    const v = ref.current;
    if (!v) return;
    v.volume = clamped;
    if (clamped > 0 && v.muted) v.muted = false;
  }, []);

  const toggleMute = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeed((cur) => {
      const idx = PLAYBACK_SPEEDS.indexOf(cur as (typeof PLAYBACK_SPEEDS)[number]);
      const next = PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
      const v = ref.current;
      if (v) v.playbackRate = next;
      return next;
    });
  }, []);

  const togglePiP = useCallback(async () => {
    const v = ref.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement === v) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch {
      void 0;
    }
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    let inPip = false;
    let lastPauseInPip = 0;
    const onPause = () => {
      if (inPip) lastPauseInPip = performance.now();
    };
    const onPlay = () => {
      if (inPip) lastPauseInPip = 0;
    };
    const onEnter = () => {
      inPip = true;
      lastPauseInPip = 0;
      setPipActive(true);
    };
    const onLeave = () => {
      inPip = false;
      setPipActive(false);
      const recentPause = lastPauseInPip > 0 && performance.now() - lastPauseInPip < 500;
      const wasNotUserPause = lastPauseInPip === 0 || recentPause;
      if (wasNotUserPause) {
        const tryPlay = () => v.play().catch(() => {});
        tryPlay();
        requestAnimationFrame(tryPlay);
      }
    };
    v.addEventListener("pause", onPause);
    v.addEventListener("play", onPlay);
    v.addEventListener("enterpictureinpicture", onEnter);
    v.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      v.removeEventListener("pause", onPause);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("enterpictureinpicture", onEnter);
      v.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [ref]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          toggle();
          wake();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-10);
          wake();
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(10);
          wake();
          break;
        case "ArrowUp":
          e.preventDefault();
          applyVolume(volume + 0.05);
          wake();
          break;
        case "ArrowDown":
          e.preventDefault();
          applyVolume(volume - 0.05);
          wake();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          wake();
          break;
        case "p":
        case "P":
          e.preventDefault();
          togglePiP();
          wake();
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle, seekBy, applyVolume, toggleMute, togglePiP, volume, wake]);

  const remaining = Math.max(0, duration - time);
  const timeText = showRemaining ? `−${formatTime(remaining)}` : formatTime(time);

  return (
    <div
      className="absolute inset-0"
      onMouseMove={wake}
      onMouseEnter={wake}
      style={{ cursor: chromeVisible || !playing ? "default" : "none" }}
    >
      <video
        ref={ref}
        src={src}
        autoPlay
        playsInline
        onClick={toggle}
        onPlay={() => {
          setPlaying(true);
          wake();
        }}
        onPause={() => {
          setPlaying(false);
          setChromeVisible(true);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          e.currentTarget.volume = volume;
          e.currentTarget.playbackRate = speed;
        }}
        onCanPlay={() => setBuffering(false)}
        onSeeking={() => setBuffering(true)}
        onSeeked={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onVolumeChange={(e) => {
          setMuted(e.currentTarget.muted);
          setVolume(e.currentTarget.volume);
        }}
        onError={() => setBuffering(false)}
        className="h-full w-full bg-black object-contain"
      />
      {buffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[2.5px] border-white/20 border-t-white/85" />
        </div>
      )}
      <div
        className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-7 pb-6 pt-16 transition-opacity duration-200"
        style={{
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? "auto" : "none",
        }}
      >
        <Scrubber
          time={time}
          duration={duration}
          onSeek={seekTo}
          onScrubStart={() => setScrubbing(true)}
          onScrubEnd={() => setScrubbing(false)}
        />
        <div className="mt-5 flex items-center gap-3 text-white">
          <Tooltip label={playing ? t("Pause · Space") : t("Play · Space")}>
            <button
              onClick={toggle}
              aria-label={playing ? t("Pause") : t("Play")}
              className="flex h-12 w-12 items-center justify-center rounded-md text-white transition-colors hover:bg-white/15 active:scale-95"
            >
              {playing ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" className="translate-x-[1px]" />
              )}
            </button>
          </Tooltip>
          <Tooltip label={showRemaining ? t("Show elapsed time") : t("Show remaining time")}>
            <button
              onClick={() => setShowRemaining((s) => !s)}
              className="ms-1 font-mono text-[15px] tabular-nums text-white/90 transition-colors hover:text-white"
            >
              {timeText}
              <span className="mx-2 text-white/30">/</span>
              <span className="text-white/55">{formatTime(duration)}</span>
            </button>
          </Tooltip>
          <div className="ms-auto flex items-center gap-1.5">
            <SpeedPill speed={speed} onCycle={cycleSpeed} />
            {pipSupported && <PiPButton active={pipActive} onClick={togglePiP} />}
            <VolumeControl
              volume={volume}
              muted={muted}
              onChange={applyVolume}
              onToggleMute={toggleMute}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
