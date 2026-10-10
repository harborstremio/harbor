import type { IptvChannel } from "./types";
import type { PlayerSrc } from "../view";
import { headersFromChannel } from "./channel-headers";

/** Shared by Live TV and Sports: the same URL, headers and native-engine policy. */
export function liveChannelSource(
  channel: IptvChannel,
  subtitle = channel.group ?? "Live",
  liveProgram?: string,
): PlayerSrc {
  return {
    meta: {
      id: `iptv:${channel.id}`,
      type: "tv",
      name: channel.name,
      poster: channel.logo ?? undefined,
      logo: channel.logo ?? undefined,
      background: channel.logo ?? undefined,
      description: channel.group ? `Live channel: ${channel.group}` : "Live channel",
      releaseInfo: "Live",
    },
    url: channel.url,
    title: channel.name,
    subtitle,
    notWebReady: true,
    isLive: true,
    headers: headersFromChannel(channel),
    liveProgram,
  };
}
