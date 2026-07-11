import { exitWindowFullscreenOnPlayerClose } from "@/lib/fullscreen-state";
import { clearOnePickerCache } from "@/lib/picker-cache";
import { clearPlayback, readPlayback, savePlayback, streamMatchesEntry } from "@/lib/playback-history";
import type { PlayerBridge } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import { saveResumeMs } from "@/lib/resume";
import type { PartialSyncState } from "@/lib/together/provider";
import { useView, type PlayerSrc, type PlayerStreamRef } from "@/lib/view";
import { useCallback, type RefObject } from "react";

import { MAX_AUTORETRY_ATTEMPTS } from "../player-utils";

const REMEMBER_MIN_SEC = 30;

export function usePlayerExit(params: {
  src: PlayerSrc;
  season: number | undefined;
  episode: number | undefined;
  bridgeRef: RefObject<PlayerBridge | null>;
  liveUrl: string;
  liveStreamRef: PlayerStreamRef | undefined;
  inRoom: boolean;
  isHost: boolean;
  instantPlay: boolean;
  captureExitSnapshot: () => Promise<void>;
  exitPip: () => Promise<void>;
  castActiveRef: RefObject<boolean>;
  stopCast: () => Promise<void>;
  publishState: (state: PartialSyncState) => void;
  notifyHostLeaving: () => void;
  clearInvite: () => void;
  exitPlayback: () => void;
  openPicker: ReturnType<typeof useView>["openPicker"];
}) {
  const {
    src,
    season,
    episode,
    bridgeRef,
    liveUrl,
    liveStreamRef,
    inRoom,
    isHost,
    instantPlay,
    captureExitSnapshot,
    exitPip,
    castActiveRef,
    stopCast,
    publishState,
    notifyHostLeaving,
    clearInvite,
    exitPlayback,
    openPicker,
  } = params;

  const closePlayer = useCallback(async () => {
    await captureExitSnapshot();
    const pos = getPlaybackPosition();
    if (Number.isFinite(pos) && pos > 0) {
      saveResumeMs(src.meta.id, pos * 1000, season, episode);
      if (liveStreamRef && pos >= REMEMBER_MIN_SEC) {
        savePlayback(src.meta.id, { ...liveStreamRef, url: liveUrl || src.url, title: src.meta.name }, season, episode);
      }
    }
    await exitPip();
    if (castActiveRef.current) await stopCast().catch(() => {});
    await exitWindowFullscreenOnPlayerClose();
    if (inRoom && isHost) {
      publishState({
        mediaId: null,
        mediaTitle: null,
        episode: null,
        posterUrl: null,
        positionSeconds: 0,
        playing: false,
      });
      notifyHostLeaving();
      clearInvite();
    }
    exitPlayback();
  }, [
    captureExitSnapshot,
    exitPlayback,
    src.meta.id,
    src.meta.name,
    season,
    episode,
    inRoom,
    isHost,
    notifyHostLeaving,
    clearInvite,
    publishState,
    exitPip,
    liveStreamRef,
    liveUrl,
    src.url,
    stopCast,
    castActiveRef,
  ]);

  const onStubEject = useCallback(() => {
    const nextAttempt = (src.attempt ?? 0) + 1;
    if (bridgeRef.current) {
      bridgeRef.current.destroy();
      bridgeRef.current = null;
    }
    if (src.streamRef) {
      const remembered = readPlayback(src.meta.id, season, episode);
      if (remembered && streamMatchesEntry(src.streamRef, remembered)) {
        clearPlayback(src.meta.id, season, episode);
      }
    }
    if (nextAttempt > MAX_AUTORETRY_ATTEMPTS) {
      void closePlayer();
      return;
    }
    if (nextAttempt >= 2) clearOnePickerCache(src.meta, src.episode);
    openPicker(
      src.meta,
      src.episode,
      instantPlay || inRoom ? { autoPlay: true, attempt: nextAttempt } : { autoPlay: false },
    );
  }, [
    src.attempt,
    src.meta,
    src.episode,
    src.streamRef,
    season,
    episode,
    openPicker,
    instantPlay,
    inRoom,
    closePlayer,
    bridgeRef,
  ]);

  return { closePlayer, onStubEject };
}
