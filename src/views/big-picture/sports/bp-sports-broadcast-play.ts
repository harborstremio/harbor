import { useCallback, useSyncExternalStore } from "react";
import { liveChannelSource } from "@/lib/iptv/playback-source";
import { recordChannelPlay } from "@/lib/iptv/channel-stats";
import { headersFromChannel } from "@/lib/iptv/channel-headers";
import type { IptvChannel } from "@/lib/iptv/types";
import type { SportsGame } from "@/lib/sports/espn-types";
import { bestChannelForGame, type SportsChannelIndex } from "@/lib/sports/iptv-match";
import { hostOf } from "@/lib/sports/stream-resolver";
import { useView } from "@/lib/view";
import { useAttachments, type AttachedStream } from "@/views/sports/source-store";
import { fixtureLabelOf } from "@/views/sports/watch-flow";

let fixture: SportsGame | null = null;
const subs = new Set<() => void>();

export function setBpWatchFixture(next: SportsGame | null): void {
  if (fixture === next) return;
  fixture = next;
  for (const fn of subs) fn();
}

function readFixture(): SportsGame | null {
  return fixture;
}

export function useBpWatchFixture(): SportsGame | null {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    readFixture,
    readFixture,
  );
}

export function useBpSportsPlayChannel(): (channel: IptvChannel, subtitle: string) => void {
  const { openPlayer } = useView();
  return useCallback(
    (channel: IptvChannel, subtitle: string) => {
      if (!channel.url) return;
      recordChannelPlay(channel);
      openPlayer({
        ...liveChannelSource(channel, subtitle),
        headers: headersFromChannel(channel),
      });
    },
    [openPlayer],
  );
}

export function useBpSportsPlayStream(): (stream: AttachedStream, name: string) => void {
  const { openPlayer } = useView();
  return useCallback(
    (stream: AttachedStream, name: string) => {
      openPlayer({
        meta: {
          id: `page-stream:${stream.url}`,
          type: "tv",
          name,
          poster: stream.poster || undefined,
          background: stream.poster || undefined,
          releaseInfo: "Live",
        },
        url: stream.url,
        title: name,
        subtitle: hostOf(stream.page),
        notWebReady: true,
        isLive: stream.kind !== "file",
        headers: stream.headers,
      });
    },
    [openPlayer],
  );
}

export function useBpWatchGame(index: SportsChannelIndex): (game: SportsGame) => boolean {
  const attachments = useAttachments();
  const playChannel = useBpSportsPlayChannel();
  const playStream = useBpSportsPlayStream();
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
