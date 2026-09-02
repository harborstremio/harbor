import { useEffect, useRef } from "react";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import type { PlayerSrc } from "@/lib/view";
import { mediaServerConnections } from "./connections";
import { identityMatches, mediaServerItems } from "./index-store";
import { mediaServerAdapter } from "./sync";
import type {
  MediaIdentity,
  MediaServerConnection,
  MediaServerItem,
  MediaServerProgress,
} from "./types";

type Snap = { status: string; positionSec: number; durationSec: number };

function identityFromPlayer(src: PlayerSrc): MediaIdentity | null {
  const tmdb = src.meta.id.match(/^tmdb:(?:movie|tv):(\d+)$/);
  const imdbId = src.imdbId ?? (src.meta.id.startsWith("tt") ? src.meta.id : undefined);
  if (!tmdb && !imdbId) return null;
  return {
    tmdbId: tmdb ? Number(tmdb[1]) : undefined,
    imdbId,
    season: src.episode?.season,
    episode: src.episode?.episode,
    episodeEnd: src.episodeEnd,
  };
}

async function targets(
  src: PlayerSrc,
): Promise<Array<{ connection: MediaServerConnection; item: MediaServerItem }>> {
  const identity = identityFromPlayer(src);
  if (!identity) return [];
  const connections = new Map(
    mediaServerConnections()
      .filter((entry) => entry.enabled && entry.writeProgress && entry.fanOut)
      .map((entry) => [entry.id, entry]),
  );
  return (await mediaServerItems()).flatMap((item) => {
    const connection = connections.get(item.connectionId);
    if (!connection) return [];
    const sameTitle = identityMatches(
      { ...identity, season: undefined, episode: undefined, episodeEnd: undefined },
      { ...item.identity, season: undefined, episode: undefined, episodeEnd: undefined },
    );
    const covered =
      identity.season == null ||
      identity.episode == null ||
      (item.identity.season === identity.season &&
        item.identity.episode != null &&
        item.identity.episode >= identity.episode &&
        item.identity.episode <= (identity.episodeEnd ?? identity.episode));
    return sameTitle && covered ? [{ connection, item }] : [];
  });
}

async function report(src: PlayerSrc, snap: Snap, watched: boolean) {
  const progress: MediaServerProgress = {
    positionMs: Math.max(0, Math.round(getPlaybackPosition() * 1000)),
    durationMs: snap.durationSec > 0 ? Math.round(snap.durationSec * 1000) : undefined,
    played: watched,
    updatedAt: Date.now(),
  };
  const matches = await targets(src);
  await Promise.allSettled(
    matches.map(async ({ connection, item }) => {
      const adapter = mediaServerAdapter(connection);
      if (watched) await adapter.setWatched(connection, item, true);
      else await adapter.reportProgress(connection, item, progress);
    }),
  );
}

export function useMediaServerProgress({ src, snap }: { src: PlayerSrc; snap: Snap }) {
  const lastStatus = useRef("");
  const latest = useRef({ src, snap });
  const activeSession = useRef<string | null>(null);
  latest.current = { src, snap };
  useEffect(() => {
    const eligible = snap.durationSec >= 150;
    if (!eligible) return;
    const watched =
      snap.status === "ended" ||
      (snap.durationSec > 0 && getPlaybackPosition() / snap.durationSec >= 0.9);
    if (snap.status === "ended") void report(src, snap, watched);
    else if (snap.status === "paused" && lastStatus.current === "playing")
      void report(src, snap, watched);
    lastStatus.current = snap.status;
  }, [src, snap.status, snap.durationSec]);
  useEffect(() => {
    if (snap.status !== "playing" || snap.durationSec < 150) return;
    const id = window.setInterval(() => {
      const value = latest.current;
      void report(value.src, value.snap, false);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [src, snap.status, snap.durationSec]);
  useEffect(
    () => () => {
      const value = latest.current;
      if (value.snap.durationSec >= 150 && getPlaybackPosition() > 0)
        void report(value.src, value.snap, false);
    },
    [],
  );
  useEffect(() => {
    const session = src.homeServer;
    if (!session?.playbackSessionId) return;
    activeSession.current = session.playbackSessionId;
    return () => {
      if (activeSession.current === session.playbackSessionId) activeSession.current = null;
      // React development mode briefly cleans up and re-runs effects. Deferring
      // lets the next setup retain the same session without stopping live video.
      window.setTimeout(() => {
        if (activeSession.current === session.playbackSessionId) return;
        const connection = mediaServerConnections().find(
          (entry) => entry.id === session.connectionId,
        );
        if (!connection) return;
        void mediaServerItems(session.connectionId).then((items) => {
          const item = items.find((entry) => entry.id === session.itemId);
          const adapter = mediaServerAdapter(connection);
          if (item && adapter.stopPlayback) {
            void adapter
              .stopPlayback(
                connection,
                item,
                session.playbackSessionId!,
                Math.max(0, Math.round(getPlaybackPosition() * 1000)),
              )
              .catch(() => {});
          }
        });
      }, 0);
    };
  }, [src.homeServer?.connectionId, src.homeServer?.itemId, src.homeServer?.playbackSessionId]);
}
