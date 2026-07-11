import { useT } from "@/lib/i18n";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { PauseCircle, PlayCircle } from "lucide-react";

import { PipIconBtn, PipStepBtn } from "./pip-controls";
import { PipSeekBar } from "./pip-seek-bar";
import { PipVolume } from "./pip-volume";
import { Tooltip } from "./tooltip";

export function PipChrome({
  snap,
  visible,
  playing,
  hoverTitle,
  hoverSub,
  hasPrevEp,
  hasNextEp,
  onExitPip,
  onPlayPause,
  onSeek,
  onSeekStep,
  onMute,
  onVolume,
  onPrevEp,
  onNextEp,
}: {
  snap: PlayerSnapshot;
  visible: boolean;
  playing: boolean;
  hoverTitle?: string;
  hoverSub?: string;
  hasPrevEp: boolean;
  hasNextEp: boolean;
  onExitPip: () => void;
  onPlayPause: () => void;
  onSeek: (sec: number) => void;
  onSeekStep: (delta: number) => void;
  onMute: () => void;
  onVolume: (v: number) => void;
  onPrevEp: () => void;
  onNextEp: () => void;
}) {
  const t = useT();
  const muted = snap.muted || snap.volume === 0;
  return (
    <>
      <div data-tauri-drag-region aria-hidden className="absolute inset-0 z-10" />
      <div
        aria-hidden
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void import("@tauri-apps/api/window")
            .then(({ getCurrentWindow }) => getCurrentWindow().startResizeDragging("SouthEast"))
            .catch(() => {});
        }}
        className="pointer-events-auto absolute bottom-0 right-0 z-30 h-4 w-4 cursor-nwse-resize"
      />

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent px-3 pt-2.5 pb-8 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="pointer-events-none flex max-w-[55%] flex-col gap-0.5 truncate text-start text-white/85">
          {hoverTitle && (
            <span className="truncate text-[12px] font-semibold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
              {hoverTitle}
            </span>
          )}
          {hoverSub && (
            <span className="truncate text-[10.5px] font-medium uppercase tracking-[0.16em] text-white/65 drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]">
              {hoverSub}
            </span>
          )}
        </div>
        <Tooltip label={t("Return to full window")} side="bottom">
          <button
            onClick={onExitPip}
            className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/95 backdrop-blur-md transition-colors hover:bg-black/85"
            aria-label={t("Exit Picture in Picture")}
          >
            <svg
              width="11"
              height="11"
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
            {t("Exit PiP")}
          </button>
        </Tooltip>
      </div>

      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pt-8 pb-3 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <PipSeekBar durationSec={snap.durationSec} onSeek={onSeek} />
        <div className="pointer-events-auto flex items-center justify-center gap-1">
          <PipIconBtn
            label={t("Previous episode")}
            onClick={onPrevEp}
            disabled={!hasPrevEp}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <rect x="5" y="4" width="2" height="16" />
              </svg>
            }
          />
          <PipStepBtn
            label={t("Back 30 seconds")}
            onClick={() => onSeekStep(-30)}
            stepText="30s"
            icon={
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
            }
          />
          <Tooltip label={playing ? t("Pause") : t("Play")}>
            <button
              type="button"
              onClick={onPlayPause}
              aria-label={playing ? t("Pause") : t("Play")}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/14 text-white transition-[background-color,transform] hover:bg-white/24 active:scale-95"
            >
              {playing ? <PauseCircle size={26} strokeWidth={1.5} /> : <PlayCircle size={26} strokeWidth={1.5} />}
            </button>
          </Tooltip>
          <PipStepBtn
            label={t("Forward 30 seconds")}
            onClick={() => onSeekStep(30)}
            stepText="30s"
            icon={
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
            }
          />
          <PipIconBtn
            label={t("Next episode")}
            onClick={onNextEp}
            disabled={!hasNextEp}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <rect x="17" y="4" width="2" height="16" />
              </svg>
            }
          />
          <PipVolume snap={snap} muted={muted} onMute={onMute} onVolume={onVolume} />
        </div>
      </div>
    </>
  );
}
