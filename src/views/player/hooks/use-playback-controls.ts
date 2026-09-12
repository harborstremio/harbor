import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { CastDeviceInfo } from "@/lib/cast";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition } from "@/lib/player/playback-clock";
import { writePlayerPrefs } from "@/lib/player-prefs";
import {
  rememberedFromChoice,
  readRememberedSub,
  subtitleSourceIsLocal,
  writeRememberedSub,
  type SubChoiceInput,
} from "@/lib/subtitles/subtitle-memory";
import { hasImportedSubTitle } from "@/lib/player/imported-subs";
import type { RoomCommand } from "@/lib/together/protocol";
import { cacheSelectedSubtitle } from "@/lib/subtitles/selected-subtitle-cache";

const SEEK_ACCUM_WINDOW_MS = 700;

export function usePlaybackControls(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  snapRef: RefObject<PlayerSnapshot>;
  metaId: string;
  mediaKey: string;
  subtitleStreamKey?: string;
  inRoom: boolean;
  isHost: boolean;
  hasStarted: boolean;
  canControl: boolean;
  castDevice: CastDeviceInfo | null;
  startHost: () => void;
  togglePlayCast: () => Promise<void>;
  seekCast: (sec: number) => Promise<void>;
  sendCommand: (command: RoomCommand) => void;
}) {
  const {
    bridgeRef,
    snapRef,
    metaId,
    mediaKey,
    subtitleStreamKey,
    inRoom,
    isHost,
    hasStarted,
    canControl,
    castDevice,
    startHost,
    togglePlayCast,
    seekCast,
    sendCommand,
  } = params;

  const pendingSubtitleCacheRef = useRef<(() => void) | null>(null);
  const subtitleCacheContextRef = useRef({ mediaKey, subtitleStreamKey, revision: 0 });
  if (
    subtitleCacheContextRef.current.mediaKey !== mediaKey ||
    subtitleCacheContextRef.current.subtitleStreamKey !== subtitleStreamKey
  ) {
    pendingSubtitleCacheRef.current?.();
    subtitleCacheContextRef.current = {
      mediaKey,
      subtitleStreamKey,
      revision: subtitleCacheContextRef.current.revision + 1,
    };
  }
  useEffect(() => () => pendingSubtitleCacheRef.current?.(), []);

  const rememberSubChoice = useCallback(
    (choice: SubChoiceInput | null | undefined) => {
      pendingSubtitleCacheRef.current?.();
      const revision = ++subtitleCacheContextRef.current.revision;
      if (choice) {
        writePlayerPrefs(
          metaId,
          choice.lang ? { subLang: choice.lang, subsOff: false } : { subsOff: false },
        );
        const source =
          choice.source ?? choice.url ?? choice.originalUrl ?? choice.externalFilename ?? undefined;
        const imported =
          choice.imported === true ||
          hasImportedSubTitle(choice.title) ||
          subtitleSourceIsLocal(source);
        const rememberedChoice = { ...choice, imported, streamKey: subtitleStreamKey };
        const remembered = writeRememberedSub(mediaKey, rememberedFromChoice(rememberedChoice));
        if (!choice.external || !source || (imported && subtitleSourceIsLocal(source))) {
          return;
        }
        const bridge = bridgeRef.current;
        if (!bridge || !remembered) return;
        let off: (() => void) | null = null;
        let timeout: number | null = null;
        let stopped = false;
        const stopWaiting = () => {
          stopped = true;
          off?.();
          if (timeout != null) window.clearTimeout(timeout);
          if (pendingSubtitleCacheRef.current === stopWaiting)
            pendingSubtitleCacheRef.current = null;
        };
        pendingSubtitleCacheRef.current = stopWaiting;
        off = bridge.subscribe((snapshot) => {
          if (stopped) return;
          if (
            subtitleCacheContextRef.current.revision !== revision ||
            bridgeRef.current !== bridge ||
            readRememberedSub(mediaKey) !== remembered
          ) {
            stopWaiting();
            return;
          }
          const selected = snapshot.subtitleTracks.find((track) => track.selected);
          if (!selected) return;
          const matches = choice.id
            ? selected.id === choice.id
            : choice.subId
              ? selected.subId === choice.subId
              : [selected.url, selected.originalUrl, selected.externalFilename].includes(source);
          if (!matches) return;
          // Capture identity and bytes from the same bridge event. React may
          // still be displaying the preceding selection when this arrives.
          const playableUrl = bridge.getSelectedTrackUrl();
          const cues = bridge.getSelectedTrackCues();
          stopWaiting();
          void cacheSelectedSubtitle({
            mediaKey,
            streamKey: subtitleStreamKey,
            choice: { ...rememberedChoice, ...selected, source, url: source },
            playableUrl,
            cues,
          })
            .then((cached) => {
              // The copy may finish after the player was closed and reopened.
              if (!cached || readRememberedSub(mediaKey) !== remembered) return;
              writeRememberedSub(
                mediaKey,
                rememberedFromChoice({ ...cached, streamKey: subtitleStreamKey }),
              );
            })
            .catch(() => {});
        });
        if (stopped) off();
        else timeout = window.setTimeout(stopWaiting, 15_000);
      } else {
        writePlayerPrefs(metaId, { subsOff: true });
        writeRememberedSub(mediaKey, { off: true });
      }
    },
    [bridgeRef, metaId, mediaKey, subtitleStreamKey],
  );

  const cycleSubtitles = () => {
    const subs = snapRef.current.subtitleTracks;
    const idx = subs.findIndex((t) => t.selected);
    const off = idx === -1;
    if (subs.length === 0) return;
    if (off) {
      bridgeRef.current?.setSubtitleTrack(subs[0].id);
      rememberSubChoice(subs[0]);
      return;
    }
    const next = idx + 1;
    if (next >= subs.length) {
      bridgeRef.current?.setSubtitleTrack(null);
      rememberSubChoice(null);
    } else {
      bridgeRef.current?.setSubtitleTrack(subs[next].id);
      rememberSubChoice(subs[next]);
    }
  };

  const playPauseToggle = () => {
    if (inRoom && isHost && !hasStarted) {
      startHost();
      return;
    }
    if (castDevice) {
      void togglePlayCast();
      return;
    }
    if (!canControl) return;
    if (inRoom && !isHost) {
      sendCommand(snapRef.current.status === "playing" ? { action: "pause" } : { action: "play" });
      return;
    }
    const b = bridgeRef.current;
    if (!b) return;
    if (snapRef.current.status === "playing") b.pause();
    else b.play().catch(() => {});
  };

  const seekAccumRef = useRef<{ target: number; at: number } | null>(null);

  const seekStep = (delta: number) => {
    const now = performance.now();
    const acc = seekAccumRef.current;
    const base = acc && now - acc.at < SEEK_ACCUM_WINDOW_MS ? acc.target : getPlaybackPosition();
    const dur = snapRef.current.durationSec;
    const upper = dur > 0 ? dur : Number.POSITIVE_INFINITY;
    const target = Math.min(upper, Math.max(0, base + delta));
    if (castDevice) {
      seekAccumRef.current = { target, at: now };
      void seekCast(target);
      return;
    }
    if (!canControl) return;
    seekAccumRef.current = { target, at: now };
    if (inRoom && !isHost) {
      sendCommand({ action: "seek", positionSeconds: target });
      return;
    }
    bridgeRef.current?.seek(target, "keyframes");
  };

  const seekTo = useCallback(
    (sec: number) => {
      const target = Math.max(0, sec);
      if (castDevice) {
        seekAccumRef.current = { target, at: performance.now() };
        void seekCast(target);
        return;
      }
      if (!canControl) return;
      seekAccumRef.current = { target, at: performance.now() };
      if (inRoom && !isHost) {
        sendCommand({ action: "seek", positionSeconds: target });
        return;
      }
      bridgeRef.current?.seek(target, "keyframes");
    },
    [castDevice, canControl, inRoom, isHost, sendCommand, seekCast, bridgeRef],
  );

  return { rememberSubChoice, cycleSubtitles, playPauseToggle, seekStep, seekTo };
}
