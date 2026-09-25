import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Loader2, Minimize } from "lucide-react";
import type { MusicTrack } from "@/lib/music/types";
import { useEscape } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { pushBackHandler } from "@/lib/back-intercept";
import { musicVideoSurfaces } from "@/lib/music/video-session";
import { MusicVideoTransport } from "./music-video-transport";
import {
  exitMusicVideoFullscreen,
  getMusicVideoFullscreen,
  musicVideoFullscreenSurvives,
  setMusicVideoFullscreenStage,
  subscribeMusicVideoFullscreen,
} from "@/lib/music/video-fullscreen";

const STAGE_CSS =
  '[data-music-video-fullscreen-stage] .music-video-surface{position:absolute;inset:0;width:100%;height:100%;aspect-ratio:auto;border-radius:0;background:#000}[data-music-video-fullscreen-stage] .music-video-placeholder{background:#000}[data-music-video-fullscreen-stage] .music-video-fullscreen-toggle{display:none}[data-music-video-fullscreen-stage] .music-video-controls{z-index:11;inset-block-start:16px;inset-block-end:auto;inset-inline-end:72px}[data-music-video-fullscreen-stage] .music-video-chrome-button{backdrop-filter:blur(12px)}[data-music-video-fullscreen-stage] .music-video-surface:not([data-idle]) .music-video-chrome-button{opacity:1}[data-music-video-fullscreen-stage] .music-video-surface:not([data-idle]) .music-video-chrome-button[aria-disabled="true"]{opacity:.5}[data-music-video-fullscreen-stage] .music-video-subtitle{padding-block-end:clamp(140px,15vh,190px)}[data-music-video-fullscreen-stage] .music-video-subtitle>span{font-size:clamp(28px,3.1vw,52px);line-height:1.22;font-weight:700;text-shadow:0 2px 5px rgba(0,0,0,.95),0 4px 26px rgba(0,0,0,.7)}';
const CHROME =
  "flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/15 backdrop-blur-md transition-[background-color,opacity] duration-150 hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";

/**
 * The picture is an ordinary media element in the page, so fullscreen only has to promote the
 * stage it sits in. The chrome layered over it is in the same stacking context and comes along.
 */
export function MusicVideoFullscreen({ track }: { track?: MusicTrack | null }) {
  const t = useT();
  const surfaces = useSyncExternalStore(
    musicVideoSurfaces.subscribe,
    musicVideoSurfaces.getSnapshot,
    musicVideoSurfaces.getSnapshot,
  );
  const fullscreen = useSyncExternalStore(
    subscribeMusicVideoFullscreen,
    getMusicVideoFullscreen,
    getMusicVideoFullscreen,
  );
  const active = fullscreen.active;
  const [awake, setAwake] = useState(true);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controlRef = useRef<HTMLButtonElement | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showing = surfaces.status === "playing";

  const wake = useCallback(() => {
    setAwake(true);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setAwake(false), 2400);
  }, []);

  useEffect(() => {
    if (!active) {
      clearTimeout(idle.current);
      setAwake(true);
      return;
    }
    wake();
    const stir = () => wake();
    window.addEventListener("pointermove", stir, { passive: true });
    window.addEventListener("pointerdown", stir, { passive: true });
    window.addEventListener("keydown", stir);
    return () => {
      window.removeEventListener("pointermove", stir);
      window.removeEventListener("pointerdown", stir);
      window.removeEventListener("keydown", stir);
      clearTimeout(idle.current);
    };
  }, [active, wake]);

  useEffect(() => {
    if (active && !musicVideoFullscreenSurvives(surfaces.status)) exitMusicVideoFullscreen();
  }, [active, surfaces.status]);

  useEffect(() => {
    if (!active) return;
    const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => controlRef.current?.focus({ preventScroll: true }));
    const removeBack = pushBackHandler(() => {
      exitMusicVideoFullscreen();
      return true;
    });
    return () => {
      cancelAnimationFrame(frame);
      removeBack();
      if (restore?.isConnected) restore.focus({ preventScroll: true });
    };
  }, [active]);

  useEscape(exitMusicVideoFullscreen, active, stageRef);

  const setStage = useCallback((node: HTMLDivElement | null) => {
    stageRef.current = node;
    setMusicVideoFullscreenStage(node);
  }, []);

  if (!active) return null;
  return createPortal(
    <div
      ref={setStage}
      role="dialog"
      aria-modal="true"
      aria-label={t("music.now.videos")}
      data-music-video-fullscreen-stage
      className="fixed inset-0 z-[950] bg-black"
      onDoubleClick={exitMusicVideoFullscreen}
    >
      <style>{STAGE_CSS}</style>
      {!showing && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black text-[13px] text-white/70">
          <span className="flex items-center gap-2">
            <Loader2 size={18} className="animate-spin" aria-hidden />
            {t("music.video.loading")}
          </span>
        </div>
      )}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-6 bg-gradient-to-b from-black/70 to-transparent p-4 pb-16 transition-opacity duration-200 motion-reduce:transition-none ${awake ? "opacity-100" : "opacity-0"}`}
      >
        {track ? (
          <span className="flex min-w-0 flex-col gap-1 px-3 pt-1.5">
            <strong className="truncate text-[clamp(20px,2.1vw,34px)] font-bold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.95)]">
              {track.title}
            </strong>
            <span className="truncate text-[clamp(13px,1.1vw,18px)] text-white/75 drop-shadow-[0_2px_10px_rgba(0,0,0,.95)]">
              {track.artist}
            </span>
          </span>
        ) : (
          <span />
        )}
        <span className="pointer-events-auto flex">
          <button
            ref={controlRef}
            type="button"
            onClick={exitMusicVideoFullscreen}
            onFocus={wake}
            aria-label={t("Exit fullscreen")}
            title={t("Exit fullscreen")}
            className={CHROME}
            style={{ pointerEvents: awake ? "auto" : "none" }}
          >
            <Minimize size={19} aria-hidden />
          </button>
        </span>
      </div>
      {showing && <MusicVideoTransport awake={awake} onWake={wake} />}
    </div>,
    document.body,
  );
}
