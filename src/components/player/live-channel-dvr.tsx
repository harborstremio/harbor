import { computeTvgIdCounts, epgProgramsForChannel } from "@/lib/iptv/epg-resolver";
import { getCachedPlaylist } from "@/lib/iptv/store";
import type { IptvPlaylistSource } from "@/lib/iptv/types";
import { findCurrent } from "@/lib/iptv/xmltv";
import { useEpg, useNowTick } from "@/views/live/hooks/use-epg";
import { useIptvPlaylist } from "@/views/live/hooks/use-iptv-playlist";
import { useMemo } from "react";

import { DvrModal } from "./dvr-modal";

export function LiveChannelDvr({
  open,
  onClose,
  source,
  channelId,
  url,
  channelName,
}: {
  open: boolean;
  onClose: () => void;
  source: IptvPlaylistSource;
  channelId: string;
  url: string;
  channelName: string;
}) {
  const { state } = useIptvPlaylist(source);
  const { index: epg } = useEpg(source);
  const nowMs = useNowTick(30_000);
  const playlist = state.kind === "ready" ? state.playlist : getCachedPlaylist(source.id);
  const channel = useMemo(() => playlist?.channels.find((c) => c.id === channelId) ?? null, [playlist, channelId]);
  const tvgIdCounts = useMemo(() => computeTvgIdCounts(playlist?.channels ?? []), [playlist?.channels]);
  const { current, next } = useMemo(() => {
    if (!channel) return { current: null, next: null };
    const programs = epgProgramsForChannel(channel, epg, tvgIdCounts);
    return findCurrent(programs, nowMs);
  }, [channel, epg, tvgIdCounts, nowMs]);
  return (
    <DvrModal
      open={open}
      onClose={onClose}
      url={url}
      channelName={channelName}
      channelLogo={channel?.logo ?? null}
      currentProgram={current}
      nextProgram={next}
    />
  );
}
