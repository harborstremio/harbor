import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Maximize2, Pause, Play, Settings2, Volume2, VolumeX, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useFloatingMedia, VideoPipSettings } from "./video-pip-settings";
import { floatingSeek } from "@/lib/player/floating-controls";
import { useT } from "@/lib/i18n";
import "./video-pip.css";

type MpvEvent = { event: string; name?: string; data?: unknown };

const IDLE_MS = 2200;
const EDGES = ["North", "South", "East", "West", "NorthEast", "NorthWest", "SouthEast", "SouthWest"] as const;

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function VideoPipApp() {
  const t = useT();
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(false);
  const [title, setTitle] = useState("");
  const [awake, setAwake] = useState(true);
  const idleTimer = useRef<number | null>(null);
  const scrubbing = useRef(false);
  const media = useFloatingMedia();
  const [menu, setMenu] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const volumeRoot = useRef<HTMLDivElement>(null);

  const wake = useCallback(() => {
    setAwake(true);
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setAwake(false), IDLE_MS);
  }, []);

  useEffect(() => {
    wake();
    return () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
    };
  }, [wake]);

  // mpv broadcasts globally, so this window sees the same property stream the player does.
  useEffect(() => {
    let off: UnlistenFn | null = null;
    let cancelled = false;
    void (async () => {
      const stop = await listen<MpvEvent>("mpv://event", (event) => {
        const payload = event.payload;
        if (payload?.event === "file-loaded") {
          void invoke<unknown>("mpv_get_property", { name: "media-title" }).then(value => { if (!cancelled && typeof value === "string") setTitle(value); }).catch(() => {});
        }
        if (!payload || payload.event !== "property-change") return;
        const { name, data } = payload;
        if (name === "time-pos" && typeof data === "number") {
          if (!scrubbing.current) setPosition(data);
        } else if (name === "duration" && typeof data === "number") {
          setDuration(data);
        } else if (name === "pause" && typeof data === "boolean") {
          setPaused(data);
        }
      });
      if (cancelled) {
        stop();
        return;
      }
      off = stop;
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);

  // Reused windows need a fresh initial snapshot on every detach, including title.
  useEffect(() => {
    let cancelled = false;
    let off: (() => void) | undefined;
    const refresh = () => {
      for (const name of ["media-title", "pause", "time-pos", "duration"]) {
        void invoke<unknown>("mpv_get_property", { name }).then(value => {
          if (cancelled) return;
          if (name === "media-title" && typeof value === "string") setTitle(value);
          if (name === "pause" && typeof value === "boolean") setPaused(value);
          if (name === "time-pos" && typeof value === "number") setPosition(value);
          if (name === "duration" && typeof value === "number") setDuration(value);
        }).catch(() => {});
      }
    };
    void listen("pip://detached-entered", refresh).then(stop => { if (cancelled) stop(); else { off = stop; refresh(); } });
    return () => { cancelled = true; off?.(); };
  }, []);

  useEffect(() => {
    const fit = () => void invoke("pip_window_fit").catch(() => {});
    window.addEventListener("resize", fit);
    fit();
    return () => window.removeEventListener("resize", fit);
  }, []);

  const toggle = useCallback(() => {
    const next = !paused;
    void invoke("mpv_set_property", { name: "pause", value: next }).catch(() => media.setError(true));
  }, [paused, media.setError]);

  const seek = useCallback((seconds: number) => {
    void invoke("mpv_command", { cmd: ["seek", floatingSeek(seconds, duration), "absolute"] }).catch(() => media.setError(true));
  }, [duration, media.setError]);

  const leaveFullscreen = useCallback(async () => {
    const window = getCurrentWindow();
    if (await window.isFullscreen()) await window.setFullscreen(false);
    setFullscreen(false);
    setMenu(false);
  }, []);

  const restore = useCallback(() => {
    void leaveFullscreen().then(() => invoke("pip_window_restore")).catch(() => media.setError(true));
  }, [leaveFullscreen, media.setError]);

  const toggleFullscreen = useCallback(async () => {
    try { const w = getCurrentWindow(); const next = !(await w.isFullscreen()); await w.setFullscreen(next); setFullscreen(next); }
    catch { media.setError(true); }
  }, [media.setError]);
  useEffect(() => {
    const root = volumeRoot.current;
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault(); event.stopPropagation(); wake();
      void media.property("volume", Math.max(0, Math.min(100, media.volume + (event.deltaY < 0 ? 5 : -5))));
    };
    root?.addEventListener("wheel", wheel, { passive: false });
    return () => root?.removeEventListener("wheel", wheel);
  }, [media.volume, media.property, wake]);

  const stop = useCallback(() => {
    void leaveFullscreen().then(async () => {
      await invoke("pip_window_exit");
      await invoke("mpv_command", { cmd: ["stop"] });
    }).catch(() => media.setError(true));
  }, [leaveFullscreen, media.setError]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (menu) setMenu(false);
        else if (fullscreen) void toggleFullscreen();
        else restore();
        wake();
        return;
      }
      if ((event.target as HTMLElement)?.closest("input,select,button")) return;
      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seek(Math.max(0, position - 5));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seek(Math.min(duration || position + 5, position + 5));
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        void media.property("volume", Math.max(0, Math.min(100, media.volume + (event.key === "ArrowUp" ? 5 : -5))));
      } else if (event.key.toLowerCase() === "m") {
        void media.property("mute", !media.muted);
      } else if (event.key.toLowerCase() === "f") {
        void toggleFullscreen();
      }
      wake();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, [toggle, restore, seek, position, duration, wake, menu, fullscreen, toggleFullscreen, media.volume, media.muted, media.property]);

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div
      className="vpip"
      data-awake={awake || menu || paused || media.error ? "" : undefined}
      onPointerMove={wake}
      onFocusCapture={wake}
      onPointerLeave={() => setAwake(false)}
    >
      <div className="vpip-drag" data-tauri-drag-region onDoubleClick={() => { void toggleFullscreen(); }} />
      <div className="vpip-chrome">
        <div className="vpip-top" data-tauri-drag-region>
          <span className="vpip-title" data-tauri-drag-region>{title}</span>
          <div className="vpip-top-actions">
            <button type="button" onClick={restore} aria-label={t("floatingPlayer.restoreVideo")}>
              <Maximize2 size={15} />
            </button>
            <button type="button" onClick={stop} aria-label={t("floatingPlayer.closeVideo")}>
              <X size={15} />
            </button>
          </div>
        </div>
        {media.error && <div className="vpip-error" role="alert">{t("floatingPlayer.playerError")}</div>}
        {menu && <VideoPipSettings media={media} close={() => setMenu(false)} seek={seek} />}
        <div className="vpip-bottom">
          <button
            type="button"
            className="vpip-play"
            onClick={toggle}
            aria-label={t(paused ? "Play" : "Pause")}
          >
            {paused ? <Play size={17} fill="currentColor" /> : <Pause size={17} />}
          </button>
          <div className="vpip-volume" ref={volumeRoot}>
            <button className="vpip-transport" aria-label={t(media.muted ? "Unmute" : "Mute")} onClick={() => { void media.property("mute", !media.muted); }}>{media.muted || media.volume === 0 ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button>
            <input type="range" min={0} max={100} value={Math.min(100, media.volume)} aria-label={t("Volume")} onChange={event => { void media.property("volume", Number(event.target.value)); }}/>
          </div>
          <div className="vpip-scrub">
            <div className="vpip-rail">
              <div className="vpip-fill" style={{ width: `${pct}%` }} />
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step={0.1}
              value={position}
              disabled={duration <= 0}
              aria-label={t("Seek")}
              onPointerDown={() => {
                scrubbing.current = true;
              }}
              onPointerUp={(event) => {
                scrubbing.current = false;
                seek(Number(event.currentTarget.value));
              }}
              onPointerCancel={() => { scrubbing.current = false; }}
              onChange={(event) => { setPosition(Number(event.target.value)); if (!scrubbing.current) seek(Number(event.target.value)); }}
            />
          </div>
          <span className="vpip-time">
            {clock(position)}
            <span className="vpip-time-total"> / {clock(duration)}</span>
          </span>
          <button className="vpip-transport" onClick={() => setMenu(value => !value)} aria-expanded={menu} aria-label={t("floatingPlayer.playbackSettings")}><Settings2 size={17}/></button>
          <button className="vpip-transport" onClick={() => { void toggleFullscreen(); }} aria-label={t(fullscreen ? "Exit fullscreen" : "Fullscreen")}><Maximize size={16}/></button>
        </div>
      </div>
      {!fullscreen && <div className="vpip-resize">{EDGES.map(edge => <div key={edge} data-edge={edge} onPointerDown={event => { if (event.button === 0) { event.preventDefault(); void getCurrentWindow().startResizeDragging(edge).catch(() => media.setError(true)); } }}/>)}</div>}
    </div>
  );
}
