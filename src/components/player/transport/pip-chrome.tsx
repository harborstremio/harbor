import { Captions } from "lucide-react";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { useT } from "@/lib/i18n";
import { Tooltip } from "./tooltip";
import { PipIconBtn, PipStepBtn } from "./pip-controls";
import { PipSeekBar } from "./pip-seek-bar";
import { PipVolume } from "./pip-volume";
import { useSettings } from "@/lib/settings";
import { sanitizeSeekStep } from "@/lib/seek-step";
import { useCaptionsPopout } from "@/views/player/hooks/use-captions-popout";

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
  const { settings } = useSettings();
  const { captionsOpen, captionsFault, toggleCaptions } = useCaptionsPopout(snap);
  const backSec = sanitizeSeekStep(settings.seekBackStepSec, 10);
  const fwdSec = sanitizeSeekStep(settings.seekForwardStepSec, 10);
  const muted = snap.muted || snap.volume === 0;
  return (
    <>
      <div
        data-tauri-drag-region
        aria-hidden
        className="absolute inset-0 z-10"
      />
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
        <div className="pointer-events-none flex max-w-[45%] flex-col gap-0.5 truncate text-start text-white/85">
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
        <div className="pointer-events-none flex shrink-0 items-center">
        <Tooltip label={captionsFault ?? (captionsOpen ? t("Hide subtitles window") : t("Pop out subtitles"))} side="bottom">
          <button
              type="button"
              onClick={() => void toggleCaptions()}
              aria-pressed={captionsOpen}
              aria-label={captionsOpen ? t("Hide subtitles window") : t("Pop out subtitles")}
              className={`pointer-events-auto me-1.5 inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                captionsOpen
                  ? "border-transparent bg-white text-black"
                  : captionsFault
                    ? "border-amber-400/60 bg-black/55 text-amber-300"
                    : "border-white/15 bg-black/55 text-white/95 backdrop-blur-md hover:bg-black/85"
              }`}
            >
              <Captions size={15} strokeWidth={2.2} />
            </button>
        </Tooltip>
        <Tooltip label={t("Return to full window")} side="bottom">
          <button
            onClick={onExitPip}
            className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/95 backdrop-blur-md transition-colors hover:bg-black/85"
            aria-label={t("Exit Picture in Picture")}
          >
            <img src="/player-icons/pip--inactive.svg" width="12" height="12" alt="" className="shrink-0 select-none" draggable={false} />
            {t("Exit PiP")}
          </button>
        </Tooltip>
        </div>
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
              <img src="/player-icons/skip-prev.png" width={17} height={17} alt="" draggable={false} className="select-none" />
            }
          />
          <PipStepBtn
            label={t("Back {n} seconds", { n: backSec })}
            onClick={() => onSeekStep(-backSec)}
            icon={
              <img
                src={`/player-icons/seek-back-${backSec}.png`}
                width={22}
                height={22}
                alt=""
                draggable={false}
                className="select-none"
              />
            }
          />
          <Tooltip label={playing ? t("Pause") : t("Play")}>
            <button
              type="button"
              onClick={onPlayPause}
              aria-label={playing ? t("Pause") : t("Play")}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/14 text-white transition-[background-color,transform] hover:bg-white/24 active:scale-95"
            >
              {/* The files are named for the glyph, the state for the player, and
                  those are opposites: while playing the button offers pause.
                  Hardcoded here rather than resolved through getCustomIcon, so
                  fixing the shared icon map did not reach this surface. */}
              {playing ? (
                <img src="/player-icons/play-pause--paused.svg" width={28} height={28} alt="" draggable={false} className="select-none" />
              ) : (
                <img src="/player-icons/play-pause--playing.svg" width={28} height={28} alt="" draggable={false} className="select-none" />
              )}
            </button>
          </Tooltip>
          <PipStepBtn
            label={t("Forward {n} seconds", { n: fwdSec })}
            onClick={() => onSeekStep(fwdSec)}
            icon={
              <img
                src={`/player-icons/seek-forward-${fwdSec}.png`}
                width={22}
                height={22}
                alt=""
                draggable={false}
                className="select-none"
              />
            }
          />
          <PipIconBtn
            label={t("Next episode")}
            onClick={onNextEp}
            disabled={!hasNextEp}
            icon={
              <img src="/player-icons/skip-next.png" width={17} height={17} alt="" draggable={false} className="select-none" />
            }
          />
          <PipVolume snap={snap} muted={muted} onMute={onMute} onVolume={onVolume} />
        </div>
      </div>
    </>
  );
}
