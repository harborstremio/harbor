import { useDebridClients } from "@/lib/debrid/registry";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackBuffered, getPlaybackPosition, setPlaybackClock } from "@/lib/player/playback-clock";
import type { Settings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { useEffect, useMemo, type RefObject } from "react";

import { useCastPick } from "./use-cast-pick";
import { useCastSession } from "./use-cast-session";

export function usePlayerCast(params: {
  src: PlayerSrc;
  debrids: ReturnType<typeof useDebridClients>;
  snapRef: RefObject<PlayerSnapshot>;
  bridgeRef: RefObject<PlayerBridge | null>;
  settings: Settings;
}) {
  const { src, debrids, snapRef, bridgeRef, settings } = params;
  const session = useCastSession(bridgeRef);
  const pick = useCastPick({
    src,
    debrids,
    snapRef,
    bridgeRef,
    settings,
    burnSubsOnTv: session.burnSubsOnTv,
    closeCastMenu: session.closeCastMenu,
    pickCastDevice: session.pickCastDevice,
    setCastErrorInfo: session.setCastErrorInfo,
  });

  useEffect(() => {
    if (session.castDevice) {
      setPlaybackClock(session.castPositionSec || getPlaybackPosition(), getPlaybackBuffered());
    }
  }, [session.castDevice, session.castPositionSec]);

  const sync = useMemo(
    () => ({
      activeRef: session.castActiveRef,
      play: session.playCast,
      pause: session.pauseCast,
      seek: session.seekCast,
      getPosition: session.getCastPosition,
      isPlaying: session.isCastPlaying,
    }),
    [
      session.castActiveRef,
      session.playCast,
      session.pauseCast,
      session.seekCast,
      session.getCastPosition,
      session.isCastPlaying,
    ],
  );

  return { ...session, ...pick, sync };
}

export type PlayerCastController = ReturnType<typeof usePlayerCast>;
