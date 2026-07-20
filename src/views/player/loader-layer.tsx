import { memo } from "react";
import type { ComponentProps } from "react";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import type { PlayerSrc } from "@/lib/view";
import { CinematicPlayerLoader } from "./cinematic-player-loader";
import { LiveChannelError } from "./live-channel-error";
import { LocalFileError } from "./local-file-error";

export const LoaderLayer = memo(function LoaderLayer({
  src,
  snap,
  isLocalSrc,
  forceShow,
  onCancel,
  engineStats,
  onShowingChange,
  onRetry,
  onBrowseChannels,
}: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  isLocalSrc: boolean;
  forceShow: boolean;
  onCancel: () => void;
  engineStats: ComponentProps<typeof CinematicPlayerLoader>["engineStats"];
  onShowingChange: (showing: boolean) => void;
  onRetry: () => void;
  onBrowseChannels?: () => void;
}) {
  const isLiveSrc = src.meta.id.startsWith("iptv:");
  return (
    <>
      {(isLocalSrc || isLiveSrc) && snap.errorCode != null ? null : (
        <CinematicPlayerLoader
          src={src}
          snap={snap}
          forceShow={forceShow}
          onCancel={onCancel}
          engineStats={engineStats}
          onShowingChange={onShowingChange}
        />
      )}

      {isLocalSrc && snap.errorCode != null && (
        <LocalFileError
          path={src.url}
          errorMessage={snap.errorMessage}
          onBack={onCancel}
          onRetry={onRetry}
        />
      )}

      {!isLocalSrc && isLiveSrc && snap.errorCode != null && (
        <LiveChannelError
          channelName={src.title ?? src.meta.name}
          onBack={onCancel}
          onRetry={onRetry}
          onBrowse={onBrowseChannels}
        />
      )}
    </>
  );
});
