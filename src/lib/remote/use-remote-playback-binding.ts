import { useEffect, useRef, type RefObject } from "react";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import type { CastDeviceInfo } from "@/lib/cast";
import type { PlayerSrc } from "@/lib/view";
import { registerRemotePlayback, type RemotePlaybackBinding } from "./session";

/** Registers the active player + cast session with the remote control hub. */
export function useRemotePlaybackBinding(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  bridgeReady: boolean;
  snap: PlayerSnapshot;
  src: PlayerSrc;
  castDevice: CastDeviceInfo | null;
  castPlaying: boolean;
  castPositionSec: number;
  playCast: () => Promise<void>;
  pauseCast: () => Promise<void>;
  seekCast: (sec: number) => Promise<void>;
  stopCast: () => Promise<void>;
  onPickDevice: (device: CastDeviceInfo) => Promise<void>;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onVolumeFeedback?: (volume: number, muted: boolean) => void;
  onActivity?: () => void;
}) {
  const {
    bridgeRef,
    bridgeReady,
    snap,
    src,
    castDevice,
    castPlaying,
    castPositionSec,
    playCast,
    pauseCast,
    seekCast,
    stopCast,
    onPickDevice,
    onPrevEpisode,
    onNextEpisode,
    hasPrevEpisode,
    hasNextEpisode,
    onVolumeFeedback,
    onActivity,
  } = params;

  // Keep latest callbacks in refs so we can re-register media/snap without
  // depending on unstable inline function identities each render.
  const callbacksRef = useRef({
    playCast,
    pauseCast,
    seekCast,
    stopCast,
    onPickDevice,
    onPrevEpisode,
    onNextEpisode,
    onVolumeFeedback,
    onActivity,
  });
  callbacksRef.current = {
    playCast,
    pauseCast,
    seekCast,
    stopCast,
    onPickDevice,
    onPrevEpisode,
    onNextEpisode,
    onVolumeFeedback,
    onActivity,
  };

  useEffect(() => {
    const cbs = callbacksRef.current;
    const next: RemotePlaybackBinding = {
      bridge: bridgeRef.current,
      snap,
      src,
      castDevice,
      castPlaying,
      castPositionSec,
      playCast: (...args) => cbs.playCast(...args),
      pauseCast: (...args) => cbs.pauseCast(...args),
      seekCast: (...args) => cbs.seekCast(...args),
      stopCast: (...args) => cbs.stopCast(...args),
      onPickDevice: (...args) => cbs.onPickDevice(...args),
      onPrevEpisode: () => cbs.onPrevEpisode?.(),
      onNextEpisode: () => cbs.onNextEpisode?.(),
      hasPrevEpisode,
      hasNextEpisode,
      onVolumeFeedback: (volume, muted) => cbs.onVolumeFeedback?.(volume, muted),
      onActivity: () => cbs.onActivity?.(),
    };
    // Update in place — do NOT clear to null between dep changes.
    // Clearing was broadcasting a brief idle snapshot (~every snap tick).
    registerRemotePlayback(next);
  }, [
    bridgeRef,
    bridgeReady,
    snap,
    src,
    castDevice,
    castPlaying,
    castPositionSec,
    hasPrevEpisode,
    hasNextEpisode,
  ]);

  useEffect(() => {
    return () => {
      registerRemotePlayback(null);
    };
  }, []);
}
