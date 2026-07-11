import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";

type PipSubtitle = {
  url: string;
  lang: string | null;
  label: string | null;
};

type PipSession = {
  url: string;
  startAtSec: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  title: string | null;
  subtitle: string | null;
  subtitles: PipSubtitle[];
};

const STATE_PUBLISH_INTERVAL_MS = 1500;

export function PipApp() {
  useEffect(() => {
    if (import.meta.env.DEV) console.log("[pip] PipApp mounted");
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [session, setSession] = useState<PipSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState(true);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const hideTimer = useRef<number | null>(null);
  const closingRef = useRef(false);

  const closeWithState = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    const v = videoRef.current;
    const exit = {
      positionSec: v && Number.isFinite(v.currentTime) ? v.currentTime : 0,
      playing: !!v && !v.paused && !v.ended,
    };
    try {
      await invoke("pip_close", { exit });
    } catch (e) {
      console.warn("[pip] close failed", e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlistenReplace: UnlistenFn | null = null;
    let closeTimer: number | null = null;
    (async () => {
      try {
        const s = await invoke<PipSession | null>("pip_get_session");
        if (cancelled) return;
        if (!s) {
          setError("No PiP session. Closing.");
          closeTimer = window.setTimeout(() => closeWithState(), 800);
          return;
        }
        setSession(s);
        setMuted(s.muted);
        setVol(s.volume);
        setPlaying(s.playing);
      } catch (e) {
        if (!cancelled) setError(`Failed to read session: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    listen("pip://session-replaced", () => {
      if (cancelled) return;
      (async () => {
        const s = await invoke<PipSession | null>("pip_get_session");
        if (cancelled || !s) return;
        setSession(s);
        setMuted(s.muted);
        setVol(s.volume);
        setPlaying(s.playing);
      })();
    }).then((u) => {
      if (cancelled) {
        u();
      } else {
        unlistenReplace = u;
      }
    });
    return () => {
      cancelled = true;
      if (closeTimer != null) window.clearTimeout(closeTimer);
      unlistenReplace?.();
    };
  }, [closeWithState]);

  useEffect(() => {
    if (!session) return;
    const v = videoRef.current;
    if (!v) return;
    v.src = session.url;
    v.volume = session.volume;
    v.muted = session.muted;
    while (v.firstChild) v.removeChild(v.firstChild);
    if (session.subtitles?.length) {
      session.subtitles.forEach((s, i) => {
        const t = document.createElement("track");
        t.src = s.url;
        t.kind = "subtitles";
        t.srclang = s.lang ?? "und";
        t.label = s.label ?? s.lang ?? `Subtitle ${i + 1}`;
        if (session.subtitle === s.url) t.default = true;
        v.appendChild(t);
      });
    }
    const onLoaded = () => {
      if (session.startAtSec > 1 && Number.isFinite(v.duration)) {
        v.currentTime = Math.min(v.duration - 1, session.startAtSec);
      }
      if (session.playing) v.play().catch(() => {});
    };
    v.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [session]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setPosition(v.currentTime || 0);
    const onDur = () => setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onVol = () => {
      setVol(v.volume);
      setMuted(v.muted);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("volumechange", onVol);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("volumechange", onVol);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      invoke("pip_publish_state", {
        exit: {
          positionSec: v.currentTime || 0,
          playing: !v.paused && !v.ended,
        },
      }).catch(() => {});
    }, STATE_PUBLISH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      const v = videoRef.current;
      if (!v) return;
      invoke("pip_publish_state", {
        exit: {
          positionSec: v.currentTime || 0,
          playing: !v.paused && !v.ended,
        },
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const wake = () => {
      setHover(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setHover(false), 2200);
    };
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("touchstart", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("touchstart", wake);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v) return;
      // Use e.code so PiP shortcuts match English physical keys under any layout
      if (e.code === "Space") {
        e.preventDefault();
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        v.currentTime = Math.min(
          Number.isFinite(v.duration) ? v.duration - 0.25 : v.currentTime + 5,
          v.currentTime + 5,
        );
      } else if (e.code === "Escape") {
        closeWithState();
      } else if (e.code === "KeyM") {
        v.muted = !v.muted;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeWithState]);

  const playPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const back30 = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, v.currentTime - 30);
  };
  const fwd30 = () => {
    const v = videoRef.current;
    if (!v) return;
    if (Number.isFinite(v.duration)) {
      v.currentTime = Math.min(v.duration - 0.25, v.currentTime + 30);
    } else {
      v.currentTime += 30;
    }
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };
  const onSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || duration <= 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    v.currentTime = ratio * duration;
  };
  const onVol = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const n = parseFloat(e.target.value);
    v.volume = n;
    if (n > 0) v.muted = false;
  };

  const progressPct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <main
      className="fixed inset-0 flex h-screen w-screen flex-col bg-black text-white"
      onMouseLeave={() => setHover(false)}
      onMouseEnter={() => setHover(true)}
    >
      <div data-tauri-drag-region className="absolute inset-x-0 top-0 z-10 h-8" />
      <div className="relative h-full w-full">
        <video
          ref={videoRef}
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full bg-black object-contain"
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-[13px] text-white/85">
            {error}
          </div>
        )}

        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/75 via-black/30 to-transparent px-3 py-2.5 transition-opacity duration-200 ${
            hover ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={closeWithState}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-md transition-colors hover:bg-black/80"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9V5a2 2 0 0 1 2-2h4" />
              <path d="M21 9V5a2 2 0 0 0-2-2h-4" />
              <path d="M3 15v4a2 2 0 0 0 2 2h4" />
              <path d="M21 15v4a2 2 0 0 1-2 2h-4" />
            </svg>
            Exit PiP
          </button>
          {session?.title && (
            <span className="pointer-events-none truncate text-[12px] font-medium text-white/75">{session.title}</span>
          )}
        </div>

        <div
          className={`absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-3 pt-8 transition-opacity duration-200 ${
            hover ? "opacity-100" : "opacity-0"
          }`}
        >
          <div onPointerDown={onSeek} className="relative h-2 cursor-pointer rounded-full bg-white/15">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[oklch(0.78_0.13_60)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <PipBtn label="Back 30 seconds" onClick={back30}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <polyline points="3 4 3 10 9 10" />
                </svg>
                <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-black/55 px-1 text-[8px] font-bold leading-none">
                  30
                </span>
              </PipBtn>
              <button
                type="button"
                onClick={playPause}
                aria-label="Play / Pause"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white transition-[background-color,transform] hover:bg-white/22 active:scale-95"
              >
                {playing ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="6 3 20 12 6 21 6 3" />
                  </svg>
                )}
              </button>
              <PipBtn label="Forward 30 seconds" onClick={fwd30}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-3-6.7" />
                  <polyline points="21 4 21 10 15 10" />
                </svg>
                <span className="absolute bottom-0.5 right-0.5 rounded-sm bg-black/55 px-1 text-[8px] font-bold leading-none">
                  30
                </span>
              </PipBtn>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-white/85">
              {formatTime(position)} / {formatTime(duration)}
            </span>
            <div className="flex items-center gap-1.5">
              <PipBtn label="Mute / Unmute" onClick={toggleMute}>
                {muted || vol === 0 ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="22" y1="9" x2="16" y2="15" />
                    <line x1="16" y1="9" x2="22" y2="15" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                )}
              </PipBtn>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : vol}
                onChange={onVol}
                className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/20"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PipBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/12 hover:text-white"
    >
      {children}
    </button>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
