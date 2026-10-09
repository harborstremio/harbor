import { memo } from "react";
import { EpisodePanel } from "@/components/player/episode-panel";
import { ResumePrompt } from "@/components/player/resume-prompt";
import type { Meta } from "@/lib/cinemeta";
import type { PanelCorner } from "@/lib/player-chrome";
import type { PlayEpisode } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { HeaderWarning, NoAudioWarning } from "./header-warning";

export const PanelsLayer = memo(function PanelsLayer({
  tenFoot,
  engine,
  isSeriesPlayback,
  meta,
  currentEpisode,
  episodePanelOpen,
  onOpenEpisodePanel,
  onCloseEpisodePanel,
  upNextButtonVisible,
  episodesCorner,
  episodesHidden,
  roomGuest,
  onHostAdvance,
  watchedFor,
  nextEp,
  onRestart,
  pendingResumeSec,
  durationSec,
  resumeTitle,
  onResume,
  onStartOver,
  showHeaderWarning,
  showNoAudioWarning,
  onUseMpv,
  onDismissNoAudio,
  onPickAnother,
}: {
  /** Big Picture renders its own resume fork and needs no hover-side tab. */
  tenFoot: boolean;
  engine: "html5" | "mpv";
  isSeriesPlayback: boolean;
  meta: Meta;
  currentEpisode: PlayEpisode | undefined;
  episodePanelOpen: boolean;
  onOpenEpisodePanel: () => void;
  onCloseEpisodePanel: () => void;
  upNextButtonVisible: boolean;
  episodesCorner: PanelCorner;
  episodesHidden: boolean;
  roomGuest: boolean;
  onHostAdvance: (ep: PlayEpisode) => void;
  watchedFor: (ep: PlayEpisode) => boolean;
  nextEp: PlayEpisode | null;
  onRestart: () => void;
  pendingResumeSec: number | null;
  durationSec: number;
  resumeTitle: string;
  onResume: () => void;
  onStartOver: () => void;
  showHeaderWarning: boolean;
  showNoAudioWarning: boolean;
  onUseMpv: () => void;
  onDismissNoAudio: () => void;
  onPickAnother: () => void;
}) {
  const t = useT();
  return (
    <>
      {!tenFoot && (
        <button
          onClick={onOpenEpisodePanel}
          aria-label={t("Up next")}
          tabIndex={upNextButtonVisible ? 0 : -1}
          aria-hidden={!upNextButtonVisible}
          className={`group absolute top-1/2 z-20 flex h-32 -translate-y-1/2 flex-col items-center justify-center gap-2.5 bg-elevated/45 text-ink shadow-[0_6px_20px_-10px_rgba(0,0,0,0.5)] backdrop-blur-md transition-[padding,background,opacity] duration-300 hover:bg-elevated/85 ${
            upNextButtonVisible ? "pointer-events-auto opacity-40 hover:opacity-100" : "pointer-events-none opacity-0"
          } ${
            episodesCorner === "top-left" || episodesCorner === "bottom-left"
              ? "left-0 rounded-r-2xl border-y border-r border-edge-soft pl-2 pr-2.5 hover:pr-3"
              : "right-0 rounded-l-2xl border-y border-l border-edge-soft pl-2.5 pr-2 hover:pl-3"
          }`}
        >
          <img
            src="/player-icons/up-next.png"
            width={22}
            height={22}
            alt=""
            draggable={false}
            aria-hidden
            className="select-none"
          />
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.28em]"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {t("Up Next")}
          </span>
        </button>
      )}

      {isSeriesPlayback && (
        <EpisodePanel
          engine={engine}
          open={episodePanelOpen && !episodesHidden}
          onClose={onCloseEpisodePanel}
          meta={meta}
          currentEpisode={currentEpisode}
          corner={episodesCorner}
          roomGuest={roomGuest}
          onHostAdvance={onHostAdvance}
          watchedFor={watchedFor}
          nextEp={nextEp}
          onRestart={onRestart}
        />
      )}

      {pendingResumeSec != null && !tenFoot && (
        <ResumePrompt
          resumeSec={pendingResumeSec}
          totalSec={durationSec}
          title={resumeTitle}
          onResume={onResume}
          onStartOver={onStartOver}
        />
      )}

      {showHeaderWarning && <HeaderWarning onPickAnother={onPickAnother} />}
      {showNoAudioWarning && (
        <NoAudioWarning onUseMpv={onUseMpv} onDismiss={onDismissNoAudio} />
      )}
    </>
  );
});
