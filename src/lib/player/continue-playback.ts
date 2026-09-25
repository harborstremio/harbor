import {
  playbackSourceKey,
  streamMatchesEntry,
  type ActualPlayback,
  type PlaybackActor,
  type PlaybackContinuation,
} from "../playback-history";
import type { Meta } from "../cinemeta";
import type { PlayEpisode, PlayerSrc } from "../view";
import { isLocalUrl } from "./local-url";

export type ContinuationServices = {
  isCurrent: (actor: PlaybackActor) => boolean;
  latest: () => ActualPlayback | null;
  active: () => {
    src: PlayerSrc;
    resume: (options?: { restart?: boolean }) => Promise<void>;
  } | null;
  localFileExists: (path: string) => Promise<boolean>;
  openPlayer: (src: PlayerSrc) => void;
  openPicker: (
    meta: Meta,
    episode: PlayEpisode | undefined,
    options: { autoPlay: boolean; resume: boolean; continuation: PlaybackContinuation },
  ) => void;
  prepareServer: (src: PlayerSrc, positionMs: number) => Promise<PlayerSrc>;
};

export function continuationStream<T extends Parameters<typeof streamMatchesEntry>[0]>(
  stream: T,
  context: PlaybackContinuation,
): T | null {
  if (!streamMatchesEntry(stream, context.source)) return null;
  if (stream.infoHash && context.source.infoHash && context.source.fileIdx != null) {
    return { ...stream, fileIdx: context.source.fileIdx };
  }
  return stream;
}

export function continuationFor(
  target: ActualPlayback,
  actor: PlaybackActor,
  restart = false,
): PlaybackContinuation {
  return {
    id: target.id,
    actor,
    restart,
    positionMs: restart ? 0 : target.positionMs,
    sourceKey: playbackSourceKey(target.src),
    audioTrack: target.audioTrack,
    source: {
      ...target.src.streamRef,
      url: target.src.historyUrl ?? target.src.url,
      title: target.src.meta.name,
      savedAt: target.playedAt,
    },
  };
}

export async function continueActualPlayback(
  target: ActualPlayback,
  options: { restart?: boolean; actor?: PlaybackActor },
  services: ContinuationServices,
): Promise<"returned" | "player-opened" | "picker-opened"> {
  const actor = options.actor ?? target.actor;
  const valid = () => {
    if (!services.isCurrent(actor))
      throw new Error("The active profile changed. Open the menu again.");
    if (services.latest()?.id !== target.id)
      throw new Error("Last playback changed. Open the menu again.");
  };
  valid();
  if (target.completed && !options.restart)
    throw new Error("This playback has finished. Choose Play from beginning to restart it.");
  const active = services.active();
  if (active) {
    if (
      playbackSourceKey(active.src) !== playbackSourceKey(target.src) ||
      active.src.meta.id !== target.src.meta.id ||
      active.src.episode?.season !== target.src.episode?.season ||
      active.src.episode?.episode !== target.src.episode?.episode
    ) {
      throw new Error("Another playback is active. Return to the player first.");
    }
    await active.resume({ restart: options.restart === true });
    return "returned";
  }
  const continuation = continuationFor(target, actor, options.restart);
  const prepared = (src: PlayerSrc): PlayerSrc => ({
    ...src,
    continuation,
    resume: true,
    startPositionMs: continuation.positionMs,
    startFromZero: options.restart === true,
    startPaused: false,
  });
  const pick = () => {
    valid();
    services.openPicker(target.src.meta, target.src.episode, {
      autoPlay: false,
      resume: true,
      continuation,
    });
    return "picker-opened" as const;
  };
  if (isLocalUrl(target.src.url)) {
    const exists = await services.localFileExists(target.src.url);
    valid();
    if (!exists) {
      if (/^(tt|tmdb:|kitsu:|mal:|anilist:|anidb:)/.test(target.src.meta.id)) return pick();
      throw new Error("The last video file is missing or unavailable.");
    }
    services.openPlayer(prepared(target.src));
    return "player-opened";
  }
  if (target.src.homeServer) {
    const src = await services.prepareServer(target.src, continuation.positionMs);
    valid();
    services.openPlayer(prepared(src));
    return "player-opened";
  }
  if (target.requiresSourceRefresh || target.src.streamRef?.infoHash) return pick();
  if (!/^https?:\/\//i.test(target.src.url))
    throw new Error("The last playback source is no longer available.");
  services.openPlayer(prepared(target.src));
  return "player-opened";
}
