import { useCallback } from "react";
import { useT } from "@/lib/i18n";
import { headersFromChannel } from "@/lib/iptv/channel-headers";
import { recordChannelPlay } from "@/lib/iptv/channel-stats";
import type { IptvChannel } from "@/lib/iptv/types";
import type { SportsGame } from "@/lib/sports/espn";
import { bestChannelForGame, type SportsChannelIndex } from "@/lib/sports/iptv-match";
import { useView } from "@/lib/view";
import { useStreamPlayer } from "./add-stream-dialog";
import { useAttachments } from "./source-store";

export function fixtureLabelOf(game: SportsGame): string {
  return `${game.away.name} v ${game.home.name}`;
}

export function useChannelPlayer(): (channel: IptvChannel, subtitle: string) => void {
  const t = useT();
  const { openPlayer } = useView();
  return useCallback(
    (channel: IptvChannel, subtitle: string) => {
      recordChannelPlay(channel);
      openPlayer({
        meta: {
          id: `iptv:${channel.id}`,
          type: "tv",
          name: channel.name,
          poster: channel.logo ?? undefined,
          logo: channel.logo ?? undefined,
          background: channel.logo ?? undefined,
          description: channel.group
            ? t("Live channel: {group}", { group: channel.group })
            : t("Live channel"),
          releaseInfo: t("Live"),
        },
        url: channel.url,
        title: channel.name,
        subtitle,
        notWebReady: true,
        isLive: true,
        headers: headersFromChannel(channel),
      });
    },
    [openPlayer, t],
  );
}

export function useWatchGame(index: SportsChannelIndex): (game: SportsGame) => boolean {
  const attachments = useAttachments();
  const playChannel = useChannelPlayer();
  const playStream = useStreamPlayer();
  return useCallback(
    (game: SportsGame) => {
      const label = fixtureLabelOf(game);
      const stream = attachments.streams[game.id];
      if (stream) {
        playStream(stream, label);
        return true;
      }
      const best = bestChannelForGame(game, index, {
        attachedIds: attachments.channels[game.league] ?? [],
      });
      if (!best || best.tier !== "exact") return false;
      playChannel(best.channel, label);
      return true;
    },
    [attachments, index, playChannel, playStream],
  );
}
