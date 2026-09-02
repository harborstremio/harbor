import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { usePlaybackBufferedGated, usePlaybackPositionGated } from "@/lib/player/playback-clock";
import type { RemoteEpisodeRef, RemoteSnapshot, RemoteSourceInfo } from "@/lib/remote/protocol";
import {
  buildRemoteSnapshot,
  dispatchRemoteCommand,
  subscribeRemoteSession,
} from "@/lib/remote/session";
import type { PlayerSrc } from "@/lib/view";
import { useSettings } from "@/lib/settings";

export type BpPlayback = {
  /** False until the player has registered a real session with the hub. */
  ready: boolean;
  title: string;
  logoUrl: string | null;
  posterUrl: string | null;
  episode: RemoteEpisodeRef | null;
  source: RemoteSourceInfo | null;
  positionSec: number;
  durationSec: number;
  bufferedSec: number;
  playing: boolean;
  live: boolean;
  volume: number;
  muted: boolean;
  casting: boolean;
  hasPrevEpisode: boolean;
  hasNextEpisode: boolean;
  subtitlesOn: boolean;
  canToggleSubtitles: boolean;
  play: () => void;
  pause: () => void;
  playPause: () => void;
  seekTo: (sec: number) => void;
  seekBy: (delta: number) => void;
  prevEpisode: () => void;
  nextEpisode: () => void;
  toggleSubtitles: () => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
};

// buildRemoteSnapshot allocates a fresh object every call and reads profile and
// text-entry state while it is at it, so useSyncExternalStore has to be handed a
// cached value or React re-renders forever and the read runs on every frame.
function useRemoteSession(): RemoteSnapshot {
  const cache = useRef<RemoteSnapshot | null>(null);

  const subscribe = useCallback((onChange: () => void) => {
    return subscribeRemoteSession(() => {
      cache.current = null;
      onChange();
    });
  }, []);

  const read = useCallback(() => {
    if (!cache.current) cache.current = buildRemoteSnapshot();
    return cache.current;
  }, []);

  return useSyncExternalStore(subscribe, read, read);
}

function run(command: Parameters<typeof dispatchRemoteCommand>[0]): void {
  void dispatchRemoteCommand(command);
}

/**
 * Read-and-drive view of whatever the player is doing, without reaching into
 * the player itself. The remote-control hub already carries the live snapshot
 * and every playback command the phone remote uses, so Big Picture rides the
 * same channel rather than opening a second one.
 *
 * `tick` gates the position subscription: the clock fires several times a
 * second and there is no reason to re-render the chrome while it is hidden.
 */
export function useBpPlayback(src: PlayerSrc | null, tick: boolean): BpPlayback {
  const { settings } = useSettings();
  const logoSlides = useMemo(() => (src?.meta ? [src.meta] : []), [src?.meta]);
  const localizedLogos = useHeroLogos(logoSlides, settings);
  const session = useRemoteSession();
  const positionSec = usePlaybackPositionGated(tick);
  const bufferedSec = usePlaybackBufferedGated(tick);

  const play = useCallback(() => run({ action: "play" }), []);
  const pause = useCallback(() => run({ action: "pause" }), []);
  const seekTo = useCallback(
    (sec: number) => run({ action: "seek", positionSec: Math.max(0, sec) }),
    [],
  );
  const prevEpisode = useCallback(() => run({ action: "prevEpisode" }), []);
  const nextEpisode = useCallback(() => run({ action: "nextEpisode" }), []);
  const toggleSubtitles = useCallback(() => run({ action: "toggleSubtitles" }), []);
  const setMuted = useCallback((muted: boolean) => run({ action: "setMuted", muted }), []);
  const setVolume = useCallback((volume: number) => run({ action: "setVolume", volume }), []);

  const live = Boolean(src?.isLive) || Boolean(src?.meta.id?.startsWith("iptv:"));
  const duration = session.durationSec;
  const position = session.idle ? session.positionSec : positionSec || session.positionSec;
  const playing = session.playing;

  const playPause = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, pause, play]);

  const seekBy = useCallback(
    (delta: number) => {
      const target = position + delta;
      seekTo(duration > 0 ? Math.min(duration - 1, Math.max(0, target)) : Math.max(0, target));
    },
    [position, duration, seekTo],
  );

  return useMemo<BpPlayback>(
    () => ({
      ready: !session.idle,
      title: src?.meta.name || src?.title || session.mediaTitle || "",
      logoUrl: (src?.meta.id ? localizedLogos[src.meta.id] : undefined) ?? src?.meta.logo ?? null,
      posterUrl: src?.meta.poster ?? session.posterUrl,
      episode: session.episode,
      source: session.source,
      positionSec: position,
      durationSec: duration,
      bufferedSec,
      playing,
      live,
      volume: session.volume,
      muted: session.muted,
      casting: session.target.kind === "cast",
      hasPrevEpisode: session.hasPrevEpisode,
      hasNextEpisode: session.hasNextEpisode,
      subtitlesOn: session.subtitlesOn,
      canToggleSubtitles: session.canToggleSubtitles,
      play,
      pause,
      playPause,
      seekTo,
      seekBy,
      prevEpisode,
      nextEpisode,
      toggleSubtitles,
      setMuted,
      setVolume,
    }),
    [
      session,
      src,
      localizedLogos,
      position,
      duration,
      bufferedSec,
      playing,
      live,
      play,
      pause,
      playPause,
      seekTo,
      seekBy,
      prevEpisode,
      nextEpisode,
      toggleSubtitles,
      setMuted,
      setVolume,
    ],
  );
}
