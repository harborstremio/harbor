import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Loader2, Play, RotateCcw, VideoOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { MusicTrack } from "@/lib/music/types";
import { useMusicPlayer } from "@/lib/music/player";
import { musicVideoSurfaces } from "@/lib/music/video-session";
import { musicVideoStream, musicVideoStreamKey, type MusicVideoStream } from "@/lib/music/video";
import {
  adoptMusicVideoHost,
  musicVideoHost,
  musicVideoHostLive,
  musicVideoHostSource,
  setMusicVideoHostSource,
} from "@/lib/music/video-host";
import {
  getMusicVideoFullscreen,
  subscribeMusicVideoFullscreen,
  toggleMusicVideoFullscreen,
} from "@/lib/music/video-fullscreen";
import { loadTrackLyrics, type LyricLine } from "@/lib/music/lyrics";
import { MusicVideoControls } from "./music-video-controls";
import "./music-video-surface.css";

/** How long a spinner may stand before it offers a way out, and before it stops claiming to work. */
const SLOW_MS = 12_000;
const STUCK_MS = 45_000;
const RESOLVE_MS = 30_000;

/** Survives the handoff the way the picture does: a choice made on the watch page holds in the pop-out. */
let lyricsPreferred = false;

function retryMusicVideo(track: MusicTrack): void {
  void musicVideoStream(track, true).catch(() => {});
  musicVideoSurfaces.retry();
}

function RetryButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={onClick}>
      <RotateCcw size={16} aria-hidden />
      {label}
    </button>
  );
}

/** The waiting states share one shape: a row on its own, a column once it carries an action. */
function Waiting({ icon, label, action }: { icon: ReactNode; label: string; action?: ReactNode }) {
  if (!action)
    return (
      <span>
        {icon}
        {label}
      </span>
    );
  return (
    <div>
      {icon}
      <span>{label}</span>
      {action}
    </div>
  );
}

export function MusicVideoSurface({
  track,
  active = true,
  expanded = false,
  onShowing,
  error = false,
  onRetry,
}: {
  track: MusicTrack;
  active?: boolean;
  expanded?: boolean;
  onShowing?: (showing: boolean) => void;
  error?: boolean;
  onRetry?: () => void;
}) {
  const t = useT();
  const owner = useRef(Symbol("music video surface")).current;
  const shell = useRef<HTMLDivElement>(null);
  const nodes = musicVideoHost();
  const state = useSyncExternalStore(
    musicVideoSurfaces.subscribe,
    musicVideoSurfaces.getSnapshot,
    musicVideoSurfaces.getSnapshot,
  );
  const fullscreen = useSyncExternalStore(
    subscribeMusicVideoFullscreen,
    getMusicVideoFullscreen,
    getMusicVideoFullscreen,
  ).active;
  const player = useMusicPlayer();
  const selected = state.owner === owner;
  const ready = active && selected && state.status === "playing";
  const [stream, setStream] = useState<MusicVideoStream | null>(() =>
    musicVideoHostSource(musicVideoStreamKey(track)),
  );
  const [attempt, setAttempt] = useState(0);
  const [broken, setBroken] = useState(false);
  const [decoded, setDecoded] = useState(
    () =>
      !!musicVideoHostSource(musicVideoStreamKey(track)) &&
      (musicVideoHost()?.video.readyState ?? 0) >= 2,
  );
  const [waiting, setWaiting] = useState(false);
  const stallTimer = useRef(0);
  const [idle, setIdle] = useState(false);
  const [halted, setHalted] = useState(false);
  const [waited, setWaited] = useState(0);
  const [lyricsOn, setLyricsOn] = useState(() => lyricsPreferred);
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null);
  const [lyricsBusy, setLyricsBusy] = useState(false);
  const [lyricsMissing, setLyricsMissing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const picture = nodes?.video ?? null;
  const sound = stream?.audioUrl && nodes ? nodes.audio : null;
  const key = musicVideoStreamKey(track);
  const showing = ready && decoded && !broken;
  // Another surface holding the session is not this one failing, so its spinner is never judged.
  const preempted = state.owner !== null && !selected;
  const unavailable = error || broken || (selected && state.status === "unavailable") || waited > 1;
  const settled = showing || unavailable;
  const interrupted = showing && (halted || waiting);
  useLayoutEffect(() => {
    if (active) return musicVideoSurfaces.register(owner, track, expanded ? 1 : 0);
  }, [active, owner, track.id, track.connectorId, expanded]);
  useEffect(() => {
    onShowing?.(showing);
    return () => onShowing?.(false);
  }, [onShowing, showing]);
  // The picture is a module-level element, so taking it over is a re-parent. Its home is always
  // this surface: fullscreen carries the surface itself into the stage, so the parent never moves.
  useLayoutEffect(() => {
    if (!active || !selected) return;
    const parent = shell.current;
    if (!parent) return;
    return adoptMusicVideoHost(parent);
  }, [active, selected, fullscreen, key, stream]);
  useEffect(() => {
    setBroken(false);
    setWaiting(false);
    setHalted(false);
    if (!ready) {
      setStream(null);
      setDecoded(false);
      return;
    }
    const held = attempt === 0 ? musicVideoHostSource(key) ?? musicVideoHostLive() : null;
    if (held) {
      setStream(held);
      setDecoded((picture?.readyState ?? 0) >= 2);
      return;
    }
    setStream(null);
    setDecoded(false);
    let live = true;
    const expire = setTimeout(() => {
      if (live) {
        live = false;
        setBroken(true);
      }
    }, RESOLVE_MS);
    void musicVideoStream(track, attempt > 0)
      .then((next) => {
        if (live) {
          setMusicVideoHostSource(key, next);
          setStream(next);
        }
      })
      .catch(() => {
        if (live) setBroken(true);
      })
      .finally(() => clearTimeout(expire));
    return () => {
      live = false;
      clearTimeout(expire);
    };
  }, [ready, key, attempt, state.key]);
  useEffect(() => {
    if (!stream || !picture) return;
    const media: HTMLMediaElement[] = sound ? [picture, sound] : [picture];
    // A buffer fill at the start of a track fires waiting repeatedly; only a stall long enough
    // to actually notice earns an indicator.
    const stall = () => {
      window.clearTimeout(stallTimer.current);
      stallTimer.current = window.setTimeout(() => setWaiting(true), 700);
    };
    const ease = () => {
      window.clearTimeout(stallTimer.current);
      setWaiting(false);
    };
    const flowing = () => {
      window.clearTimeout(stallTimer.current);
      setWaiting(false);
      setHalted(false);
    };
    const stopped = () => setHalted(true);
    const failed = () => setBroken(true);
    const first = () => setDecoded(true);
    for (const node of media) {
      node.addEventListener("waiting", stall);
      node.addEventListener("stalled", stall);
      node.addEventListener("playing", flowing);
      node.addEventListener("canplay", ease);
      node.addEventListener("timeupdate", ease);
      node.addEventListener("pause", stopped);
      node.addEventListener("error", failed);
    }
    picture.addEventListener("loadeddata", first);
    // Adopting a picture that already decoded means loadeddata has been and gone, and a surface
    // that waits for it again would sit behind its own placeholder forever.
    if (picture.readyState >= 2) setDecoded(true);
    return () => {
      for (const node of media) {
        node.removeEventListener("waiting", stall);
        node.removeEventListener("stalled", stall);
        node.removeEventListener("playing", flowing);
        node.removeEventListener("canplay", ease);
        node.removeEventListener("timeupdate", ease);
        node.removeEventListener("pause", stopped);
        node.removeEventListener("error", failed);
      }
      picture.removeEventListener("loadeddata", first);
    };
  }, [stream, picture, sound]);
  const volume = Math.max(0, Math.min(1, player.volume));
  const paused = player.phase === "paused";
  useEffect(() => {
    if (!stream || !picture) return;
    if (sound) sound.volume = volume;
    else picture.volume = volume;
    if (paused) {
      sound?.pause();
      picture.pause();
      return;
    }
    let live = true;
    void (async () => {
      try {
        if (sound) await sound.play();
      } catch {
        /* awaits a gesture */
      }
      if (live) void picture.play().catch(() => {});
    })();
    return () => {
      live = false;
    };
  }, [stream, paused, volume, picture, sound]);
  useEffect(() => {
    const clock = sound ?? picture;
    if (!stream || !clock) return;
    const time = () => setCurrentTime(clock.currentTime);
    time();
    clock.addEventListener("timeupdate", time);
    return () => clock.removeEventListener("timeupdate", time);
  }, [stream, picture, sound]);
  const resume = useCallback(() => {
    void sound?.play().catch(() => {});
    void picture?.play().catch(() => {});
  }, [picture, sound]);
  const toggleLyrics = useCallback(
    () =>
      setLyricsOn((on) => {
        lyricsPreferred = !on;
        return !on;
      }),
    [],
  );
  useEffect(() => {
    setLyrics(null);
    setLyricsMissing(false);
    if (!lyricsOn || !ready) return;
    let live = true;
    setLyricsBusy(true);
    void loadTrackLyrics(track)
      .then((lines) => {
        if (!live) return;
        setLyrics(lines && lines.length > 0 ? lines : null);
        setLyricsMissing(!lines || lines.length === 0);
      })
      .catch(() => {
        if (live) setLyricsMissing(true);
      })
      .finally(() => {
        if (live) setLyricsBusy(false);
      });
    return () => {
      live = false;
    };
  }, [lyricsOn, ready, key]);
  useEffect(() => {
    setWaited(0);
    if (!active || preempted || settled) return;
    const slow = setTimeout(() => setWaited(1), SLOW_MS);
    const stuck = setTimeout(() => setWaited(2), STUCK_MS);
    return () => {
      clearTimeout(slow);
      clearTimeout(stuck);
    };
  }, [active, preempted, settled, state.key, key]);
  const again = useCallback(() => {
    if (onRetry) {
      onRetry();
      return;
    }
    setAttempt((count) => count + 1);
    retryMusicVideo(track);
  }, [onRetry, track.id, track.connectorId]);
  // Fullscreen is a lean-back surface: the chrome rests on its own the way a film player does.
  useEffect(() => {
    if (!fullscreen) {
      setIdle(false);
      return;
    }
    let timer = 0;
    const stir = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), 2400);
    };
    stir();
    window.addEventListener("pointermove", stir, { passive: true });
    window.addEventListener("pointerdown", stir, { passive: true });
    window.addEventListener("keydown", stir);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", stir);
      window.removeEventListener("pointerdown", stir);
      window.removeEventListener("keydown", stir);
    };
  }, [fullscreen]);
  const retry = <RetryButton label={t("common.retry")} onClick={again} />;
  const lyricsState = !lyricsOn
    ? "off"
    : lyricsBusy
      ? "loading"
      : lyricsMissing
        ? "unavailable"
        : "on";
  return (
    <div
      ref={shell}
      className="music-video-surface"
      data-music-video-surface={expanded ? "expanded" : "watch"}
      data-video-state={showing ? "playing" : unavailable ? "unavailable" : "loading"}
      data-idle={fullscreen && idle ? "1" : undefined}
      onDoubleClick={toggleMusicVideoFullscreen}
    >
      {!showing && (
        <div className="music-video-placeholder" role="status">
          {track.artwork && <img src={track.artwork} alt="" />}
          {unavailable ? (
            <Waiting
              icon={<VideoOff size={22} aria-hidden />}
              label={t("music.videos.playbackError")}
              action={retry}
            />
          ) : (
            <Waiting
              icon={<Loader2 size={18} className="animate-spin" aria-hidden />}
              label={t("music.video.loading")}
              action={waited > 0 ? retry : undefined}
            />
          )}
        </div>
      )}
      {showing && (
        <MusicVideoControls
          lyrics={lyrics}
          lyricsState={lyricsState}
          onToggleLyrics={toggleLyrics}
          currentTime={currentTime}
          fullscreen={fullscreen}
          onToggleFullscreen={toggleMusicVideoFullscreen}
          expanded={expanded}
        />
      )}
      {interrupted && (
        <div className="music-video-badge">
          {halted ? (
            <button
              type="button"
              className="music-video-resume"
              onClick={resume}
              aria-label={t("music.resume")}
              title={t("music.resume")}
            >
              <Play size={44} fill="currentColor" aria-hidden />
            </button>
          ) : (
            <span role="status" aria-label={t("Buffering")} className="music-video-spinner">
              <Loader2 size={32} className="animate-spin motion-reduce:animate-none" aria-hidden />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
