import { memo } from "react";
import { Anime4kIndicator } from "@/components/player/anime4k-indicator";
import { SvpIndicator } from "@/components/player/svp-indicator";
import { StatsOverlay } from "@/components/player/stats-overlay";
import { SubStyleBar } from "@/components/player/sub-style-bar";
import { SubSyncBar } from "@/components/player/sub-sync-bar";
import { SubtitleOverlay } from "@/components/player/subtitle-overlay";
import {
  VolumeIndicator,
  type VolumeHudPosition,
  type VolumeIndicatorState,
} from "@/components/player/volume-indicator";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import type { ParentalCategory } from "@/lib/providers/harbor-imdb";
import { ContentAdvisoryToast } from "@/components/player/content-advisory-toast";
import { useT } from "@/lib/i18n";

export const StageOverlays = memo(function StageOverlays({
  snap,
  engine,
  pipMode,
  subShowInPip,
  subAssNative,
  showStats,
  holdSpeedActive,
  volumeIndicator,
  volumeHudPosition,
  videoFillPill,
  subDropToast,
  contentAdvisory,
  onSubDelay,
  onEnterSync,
  chromeVisible,
}: {
  snap: PlayerSnapshot;
  engine: "html5" | "mpv";
  pipMode: boolean;
  subShowInPip: boolean;
  subAssNative: boolean;
  showStats: boolean;
  holdSpeedActive: boolean;
  volumeIndicator: VolumeIndicatorState;
  volumeHudPosition: VolumeHudPosition;
  videoFillPill: string | null;
  subDropToast: string | null;
  contentAdvisory: { categories: ParentalCategory[]; playKey: string };
  onSubDelay: (sec: number) => void;
  onEnterSync?: () => void;
  chromeVisible: boolean;
}) {
  const t = useT();
  const showVolumeIndicator = volumeIndicator.visible;
  const topVolumeShowing = showVolumeIndicator && volumeHudPosition === "top";
  return (
    <>
      {(!pipMode || subShowInPip) && !subAssNative && (
        <SubtitleOverlay
          text={snap.subText}
          startSec={snap.subStartSec}
          scale={pipMode ? 0.45 : 1}
        />
      )}
      {showStats && !pipMode && <StatsOverlay snap={snap} engine={engine} />}
      {!pipMode && (
        <Anime4kIndicator
          engine={engine}
          chromeVisible={chromeVisible}
          suppressed={topVolumeShowing}
        />
      )}
      {!pipMode && (
        <SvpIndicator engine={engine} chromeVisible={chromeVisible} suppressed={topVolumeShowing} />
      )}
      {holdSpeedActive && !pipMode && (
        <div className="pointer-events-none absolute left-1/2 top-8 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-canvas/85 px-3.5 py-1.5 text-[13px] font-semibold text-ink backdrop-blur-md">
          {snap.rate}x<span className="font-normal text-ink-muted">{t("speed")}</span>
        </div>
      )}
      {!holdSpeedActive && !pipMode && (
        <VolumeIndicator
          state={{ ...volumeIndicator, visible: showVolumeIndicator }}
          allowBoost={engine === "mpv"}
          position={volumeHudPosition}
        />
      )}
      {videoFillPill &&
        !holdSpeedActive &&
        !pipMode &&
        !(showVolumeIndicator && volumeHudPosition === "top") && (
          <div className="pointer-events-none absolute left-1/2 top-8 z-30 -translate-x-1/2 rounded-full bg-canvas/85 px-3.5 py-1.5 text-[13px] font-semibold text-ink backdrop-blur-md">
            {videoFillPill}
          </div>
        )}
      {subDropToast && !pipMode && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-full bg-canvas/90 px-4 py-2 text-[13px] font-medium text-ink backdrop-blur-md">
          {subDropToast}
        </div>
      )}
      {!pipMode && (
        <ContentAdvisoryToast
          categories={contentAdvisory.categories}
          playKey={contentAdvisory.playKey}
        />
      )}
      {!pipMode && <SubStyleBar />}
      {!pipMode && (
        <SubSyncBar
          delaySec={snap.subDelaySec}
          onDelay={onSubDelay}
          onEnterSync={onEnterSync}
          syncAvailable={snap.subtitleTracks.some((t) => t.selected)}
        />
      )}
    </>
  );
});
