import { memo } from "react";
import { EpisodePanel } from "@/components/player/episode-panel";
import { ResumePrompt } from "@/components/player/resume-prompt";
import type { Meta } from "@/lib/cinemeta";
import type { PanelCorner } from "@/lib/player-chrome";
import type { PlayEpisode } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { HeaderWarning, NoAudioWarning } from "./header-warning";

export const PanelsLayer = memo(function PanelsLayer({
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
      {upNextButtonVisible && (
        <button
          onClick={onOpenEpisodePanel}
          aria-label={t("Up next")}
          className={`group absolute top-1/2 z-20 flex h-32 -translate-y-1/2 flex-col items-center justify-center gap-2.5 bg-elevated/95 text-ink shadow-[0_10px_32px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md transition-[padding,background] duration-200 hover:bg-elevated ${
            episodesCorner === "top-left" || episodesCorner === "bottom-left"
              ? "left-0 rounded-r-2xl border-y border-r border-edge-soft pl-2 pr-2.5 hover:pr-3"
              : "right-0 rounded-l-2xl border-y border-l border-edge-soft pl-2.5 pr-2 hover:pl-3"
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 6h13M3 12h13M3 18h9M18 8l4 4-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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

      {pendingResumeSec != null && (
        <ResumePrompt
          resumeSec={pendingResumeSec}
          totalSec={durationSec}
          title={resumeTitle}
          onResume={onResume}
          onStartOver={onStartOver}
        />
      )}

      {showHeaderWarning && <HeaderWarning onPickAnother={onPickAnother} />}
      {showNoAudioWarning && <NoAudioWarning onUseMpv={onUseMpv} onDismiss={onDismissNoAudio} />}
    </>
  );
});
