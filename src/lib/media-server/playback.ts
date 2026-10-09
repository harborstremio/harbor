import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode, PlayerSrc } from "@/lib/view";
import { mediaServerAdapter } from "./sync";
import { mediaServerConnections, updateMediaServerConnection } from "./connections";
import { mediaServerItems } from "./index-store";
import type { MediaServerQuality } from "./types";
import type { MediaServerConnection, MediaServerItem, MediaServerPlayback } from "./types";
export { decidePlaybackSource } from "./playback-policy";

function providerName(provider: MediaServerConnection["provider"]): string {
  if (provider === "plex") return "Plex";
  if (provider === "jellyfin") return "Jellyfin";
  return "Emby";
}

export function mediaServerPlayerSrc(args: {
  meta: Meta;
  imdbId?: string;
  episode?: PlayEpisode;
  connection: MediaServerConnection;
  item: MediaServerItem;
  playback: MediaServerPlayback;
}): PlayerSrc {
  const { meta, imdbId, episode, connection, item, playback } = args;
  const version = item.versions.find((entry) => entry.id === playback.versionId);
  return {
    meta,
    imdbId,
    episode,
    episodeEnd: version?.episodeEnd ?? item.identity.episodeEnd,
    episodeSpan:
      (version?.season ?? item.identity.season) != null &&
      (version?.episode ?? item.identity.episode) != null
        ? {
            season: (version?.season ?? item.identity.season)!,
            episode: (version?.episode ?? item.identity.episode)!,
            episodeEnd:
              version?.episodeEnd ??
              item.identity.episodeEnd ??
              (version?.episode ?? item.identity.episode)!,
          }
        : undefined,
    url: playback.url,
    headers: playback.headers,
    subtitles: playback.subtitles?.map((track) => ({
      id: track.id,
      url: track.url,
      lang: track.language,
      trustedSource: true,
    })),
    title: meta.name,
    subtitle: `${providerName(connection.provider)} · ${connection.name} · ${playback.direct ? "Direct play" : "Transcode"}`,
    notWebReady: true,
    resume: (item.progress?.positionMs ?? 0) > 0,
    homeServer: {
      connectionId: connection.id,
      itemId: item.id,
      versionId: playback.versionId,
      quality: playback.effectiveQuality,
      playbackSessionId: playback.playbackSessionId,
    },
  };
}

export async function createMediaServerPlayerSrc(args: {
  meta: Meta;
  imdbId?: string;
  episode?: PlayEpisode;
  connection: MediaServerConnection;
  item: MediaServerItem;
  versionId?: string;
  quality?: MediaServerConnection["preferredQuality"];
  startPositionMs?: number;
}): Promise<PlayerSrc> {
  const playback = await mediaServerAdapter(args.connection).playback(args.connection, args.item, {
    versionId: args.versionId,
    quality: args.quality ?? args.connection.preferredQuality,
    startPositionMs: args.startPositionMs ?? args.item.progress?.positionMs,
  });
  return mediaServerPlayerSrc({ ...args, playback });
}

export async function switchMediaServerQuality(args: {
  src: PlayerSrc;
  quality: MediaServerQuality;
  positionMs: number;
  playing: boolean;
}): Promise<PlayerSrc> {
  const context = args.src.homeServer;
  if (!context) throw new Error("This is not home-server playback.");
  const connection = mediaServerConnections().find((entry) => entry.id === context.connectionId);
  const item = (await mediaServerItems(context.connectionId)).find(
    (entry) => entry.id === context.itemId,
  );
  if (!connection || !item) throw new Error("This home-server copy is no longer available.");
  const adapter = mediaServerAdapter(connection);
  const next = await adapter.playback(connection, item, {
    versionId: context.versionId,
    quality: args.quality,
    startPositionMs: args.positionMs,
  });
  const replacement: PlayerSrc = {
    ...args.src,
    url: next.url,
    headers: next.headers,
    subtitles: next.subtitles?.map((track) => ({
      id: track.id,
      url: track.url,
      lang: track.language,
      trustedSource: true,
    })),
    startPositionMs: args.positionMs,
    startPaused: !args.playing,
    homeServer: {
      ...context,
      quality: next.effectiveQuality,
      playbackSessionId: next.playbackSessionId,
    },
    subtitle: `${providerName(connection.provider)} · ${connection.name} · ${next.direct ? "Direct play" : "Transcode"}`,
  };
  updateMediaServerConnection(connection.id, { preferredQuality: args.quality });
  if (context.playbackSessionId && adapter.stopPlayback) {
    void adapter
      .stopPlayback(connection, item, context.playbackSessionId, args.positionMs)
      .catch(() => {});
  }
  return replacement;
}
