import { LiveChannelDvr } from "@/components/player/live-channel-dvr";
import { LiveChannelOverlay } from "@/components/player/live-channel-overlay/overlay";

import type { useLiveChannelOverlay } from "./hooks/use-live-channel-overlay";

export function LiveLayer({
  liveOverlay,
  dvrOpen,
  onCloseDvr,
  srcUrl,
  channelName,
}: {
  liveOverlay: ReturnType<typeof useLiveChannelOverlay>;
  dvrOpen: boolean;
  onCloseDvr: () => void;
  srcUrl: string;
  channelName: string;
}) {
  return (
    <>
      {liveOverlay.open && liveOverlay.activeSource && (
        <LiveChannelOverlay
          source={liveOverlay.activeSource}
          sources={liveOverlay.availableSources}
          onSelectSource={liveOverlay.selectSource}
          currentChannelId={liveOverlay.currentChannelId}
          onSwitch={liveOverlay.switchChannel}
          onClose={() => liveOverlay.setOpen(false)}
          group={liveOverlay.group}
          setGroup={liveOverlay.setGroup}
          query={liveOverlay.query}
          setQuery={liveOverlay.setQuery}
        />
      )}
      {liveOverlay.isLive && liveOverlay.activeSource && liveOverlay.currentChannelId && (
        <LiveChannelDvr
          open={dvrOpen}
          onClose={onCloseDvr}
          source={liveOverlay.activeSource}
          channelId={liveOverlay.currentChannelId}
          url={srcUrl}
          channelName={channelName}
        />
      )}
    </>
  );
}
