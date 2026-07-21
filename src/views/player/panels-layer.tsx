import { memo } from "react";
import { EpisodePanel } from "@/components/player/episode-panel";
import { ResumePrompt } from "@/components/player/resume-prompt";
import type { Meta } from "@/lib/cinemeta";
import type { PanelCorner } from "@/lib/player-chrome";
import type { PlayEpisode } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { HeaderWarning, NoAudioWarning } from "./header-warning";
import { ThreeLiquidGlassSurface } from "@/components/ThreeLiquidGlassSurface";

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
  const episodesOnLeft = episodesCorner === "top-left" || episodesCorner === "bottom-left";

  return (
    <>
      {upNextButtonVisible && (
        <div
          className={`pointer-events-auto absolute top-1/2 z-20 h-32 w-11 -translate-y-1/2 ${
            episodesOnLeft ? "left-0" : "right-0"
          }`}
        >
          <ThreeLiquidGlassSurface
            radius={episodesOnLeft ? "0 16px 16px 0" : "16px 0 0 16px"}
            shaderRadius={0.28}
            intensity={0.1}
            refractionStrength={0.08}
            interactive={false}
            alwaysActive
            className={`
              group
              h-full
              w-full
              border-y
              border-white/[0.10]
              ${episodesOnLeft ? "border-r" : "border-l"}
            `}
            contentClassName="h-full w-full"
            style={{
              boxShadow: episodesOnLeft
                ? "inset -1px 0 0 rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)"
                : "inset 1px 0 0 rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.05)",
            }}
          >
            <button
              type="button"
              onClick={onOpenEpisodePanel}
              aria-label={t("Up next")}
              className={`
                flex
                h-full
                w-full
                flex-col
                items-center
                justify-center
                gap-2.5
                ${episodesOnLeft ? "rounded-r-2xl" : "rounded-l-2xl"}
                bg-transparent
                text-ink
                outline-none
                transition-transform
                duration-150
                active:scale-[0.97]
              `}
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
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
              >
                {t("Up Next")}
              </span>
            </button>
          </ThreeLiquidGlassSurface>
        </div>
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
