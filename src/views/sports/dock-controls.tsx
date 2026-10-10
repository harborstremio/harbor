import {
  Expand,
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
  LoaderCircle,
  Minus,
  PictureInPicture2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import type { PlayerSrc } from "@/lib/view";
import { useDockAudio } from "./use-dock-audio";
import type { useDockDrag } from "./use-dock-drag";
import "./dock.css";

export function SportsDockControls({
  src,
  snap,
  bridge,
  minimized,
  onMinimize,
  onPlayPause,
  onClose,
  onExpand,
  onFullscreen,
  dragHandlers,
}: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  bridge: PlayerBridge | null;
  minimized: boolean;
  onMinimize: () => void;
  onPlayPause: () => void;
  onClose: () => void;
  onExpand: () => void;
  onFullscreen: () => void;
  dragHandlers: ReturnType<typeof useDockDrag>["handlers"];
}) {
  const t = useT();
  const audio = useDockAudio(bridge, snap);
  const volumeControl = useRef<HTMLDivElement>(null);
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const logo = src.meta.logo || src.meta.poster;
  const [failedLogo, setFailedLogo] = useState<string>();
  useEffect(() => {
    const node = volumeControl.current;
    if (!node) return;
    const adjust = (event: WheelEvent) => {
      if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      event.stopPropagation();
      audioRef.current.changeVolume(Math.round((audioRef.current.volume + (event.deltaY < 0 ? .05 : -.05)) * 100) / 100);
    };
    node.addEventListener("wheel", adjust, { passive: false });
    return () => node.removeEventListener("wheel", adjust);
  }, []);
  const loading = snap.status === "idle" || snap.status === "loading" || snap.buffering;
  return (
    <div className="sports-dock-chrome">
      <header {...dragHandlers}>
        {logo && logo !== failedLogo && <img className="sports-dock-logo" src={logo} alt="" draggable={false} onError={() => setFailedLogo(logo)} />}
        <span>
          <strong>{src.title}</strong>
          <small>
            {minimized
              ? t(
                  loading
                    ? "Connecting to your stream…"
                    : snap.status === "error"
                      ? "This stream could not be played."
                      : "Audio only",
                )
              : src.subtitle}
          </small>
        </span>
        <button
          onClick={onMinimize}
          aria-label={t(minimized ? "Restore video" : "Minimize player")}
          title={t(minimized ? "Restore video" : "Minimize player")}
        >
          {minimized ? <PictureInPicture2 size={18} /> : <Minus size={18} />}
        </button>
        <button onClick={onClose} aria-label={t("Close player")}>
          <X size={18} />
        </button>
      </header>
      {!minimized && loading && (
        <div className="sports-dock-status" role="status">
          <LoaderCircle className="sports-dock-spinner" size={30} />
          <span>{t("Connecting to your stream…")}</span>
        </div>
      )}
      {!minimized && snap.status === "error" && (
        <div className="sports-dock-status" role="alert">
          <strong>{t("This stream could not be played.")}</strong>
          <span>{t("Check your source or try another channel.")}</span>
          <button onClick={onClose}>{t("Choose another source")}</button>
        </div>
      )}
      <footer>
        <button onClick={onPlayPause} aria-label={t(snap.status === "playing" ? "Pause" : "Play")}>
          {snap.status === "playing" ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <div className="sports-dock-volume" ref={volumeControl}>
          <button
            onClick={audio.toggleMute}
            aria-pressed={audio.muted}
            aria-label={t(audio.muted ? "Unmute" : "Mute")}
          >
            {audio.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={audio.volume}
            aria-label={t("Volume")}
            onChange={(e) => audio.changeVolume(Number(e.target.value))}
          />
        </div>
        <span className="sports-dock-live">{t(src.isLive ? "Live" : "Video")}</span>
        <button
          onClick={onExpand}
          aria-label={t("Expand player and controls")}
          title={t("Expand player and controls")}
        >
          <Expand size={18} />
        </button>
        <button onClick={onFullscreen} aria-label={t("Fullscreen")}>
          <Maximize2 size={18} />
        </button>
      </footer>
      {!minimized && snap.subText && <p className="sports-dock-subtitle">{snap.subText}</p>}
    </div>
  );
}
