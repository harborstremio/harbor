import { isAnyFullscreen, exitAnyFullscreen } from "@/lib/fullscreen-state";
import { effectiveBinding, eventToBinding, isTypingTarget, type HotkeyId } from "@/lib/hotkeys";
import { writePlayerPrefs } from "@/lib/player-prefs";
import { writePlayerVolume } from "@/lib/player-volume";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { getLeaveConfirm, openLeaveConfirm } from "@/lib/player/leave-confirm";
import { useSettings } from "@/lib/settings";
import { useEffect, useRef, useState, type RefObject } from "react";

import { round2 } from "../player-utils";

export function useKeyboardShortcuts(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  snap: PlayerSnapshot;
  drawMode: boolean;
  setDrawMode: (v: boolean) => void;
  closePlayer: () => void;
  playPauseToggle: () => void;
  seekStep: (delta: number) => void;
  seekTo: (sec: number) => void;
  onFrameStep?: (dir: 1 | -1) => void;
  toggleFullscreen: () => void;
  togglePip?: () => void;
  fullscreen: boolean;
  cycleSubtitles: () => void;
  setShowStats: (updater: (prev: boolean) => boolean) => void;
  metaId: string;
  onNextEp?: () => void;
  onPrevEp?: () => void;
  hasNextEp?: boolean;
  hasPrevEp?: boolean;
  toggleSwitcher?: () => void;
  toggleEpisodePanel?: () => void;
  toggleGuide?: () => void;
  toggleDvr?: () => void;
  toggleSleep?: () => void;
  onScreenshot?: () => void;
  onGifRecord?: () => void;
  onClipRecord?: () => void;
  onToggleCrop?: () => void;
  onPanscanUp?: () => void;
  onPanscanDown?: () => void;
  onPrevChannel?: () => void;
  onToggleAnime4k?: () => void;
  onAnime4kOn?: () => void;
  onAnime4kOff?: () => void;
  onVolumeFeedback?: (volume: number, muted: boolean) => void;
}) {
  const {
    bridgeRef,
    snap,
    drawMode,
    setDrawMode,
    closePlayer,
    playPauseToggle,
    seekStep,
    seekTo,
    onFrameStep,
    toggleFullscreen,
    togglePip,
    cycleSubtitles,
    setShowStats,
    metaId,
    onNextEp,
    onPrevEp,
    hasNextEp,
    hasPrevEp,
    toggleSwitcher,
    toggleEpisodePanel,
    toggleGuide,
    toggleDvr,
    toggleSleep,
    onScreenshot,
    onGifRecord,
    onClipRecord,
    onToggleCrop,
    onPanscanUp,
    onPanscanDown,
    onPrevChannel,
    onToggleAnime4k,
    onAnime4kOn,
    onAnime4kOff,
    onVolumeFeedback,
  } = params;
  const { settings, update } = useSettings();
  const overrides = settings.hotkeys ?? {};
  const seekBackStepSec = settings.seekBackStepSec;
  const seekForwardStepSec = settings.seekForwardStepSec;
  const holdRef = useRef<{
    key: string | null;
    timer: number | null;
    engaged: boolean;
    baseRate: number;
  }>({ key: null, timer: null, engaged: false, baseRate: 1 });
  const [holdSpeedActive, setHoldSpeedActive] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;

      const binding = eventToBinding(e);
      const match = (id: HotkeyId): boolean => effectiveBinding(id, overrides) === binding;

      if (e.key === "MediaPlayPause") {
        e.preventDefault();
        playPauseToggle();
        return;
      }
      if (e.key === "MediaTrackNext" && hasNextEp && onNextEp) {
        e.preventDefault();
        onNextEp();
        return;
      }
      if (e.key === "MediaTrackPrevious" && hasPrevEp && onPrevEp) {
        e.preventDefault();
        onPrevEp();
        return;
      }

      if (match("playerClose")) {
        if (getLeaveConfirm().open) return;
        if (drawMode) {
          setDrawMode(false);
          return;
        }
        void (async () => {
          if (settings.playerEscExitsFullscreen && (await isAnyFullscreen())) {
            await exitAnyFullscreen();
            return;
          }
          if (settings.playerConfirmLeave) {
            openLeaveConfirm((remember) => {
              if (remember) update({ playerConfirmLeave: false });
              closePlayer();
            });
            return;
          }
          closePlayer();
        })();
        return;
      }
      if (match("playerPip")) {
        e.preventDefault();
        togglePip?.();
        return;
      }
      if (match("playerPlayPause")) {
        e.preventDefault();
        if (e.repeat) return;
        const h = holdRef.current;
        // Track physical key (e.code) so keyup still matches under Arabic layouts
        h.key = e.code || e.key;
        h.baseRate = snap.rate;
        h.timer = window.setTimeout(() => {
          h.timer = null;
          h.engaged = true;
          setHoldSpeedActive(true);
          bridgeRef.current?.setRate(Math.max(2, h.baseRate));
        }, 350);
        return;
      }
      if (match("playerSeekBack10")) {
        e.preventDefault();
        seekStep(-seekBackStepSec);
        return;
      }
      if (match("playerSeekForward10")) {
        e.preventDefault();
        seekStep(seekForwardStepSec);
        return;
      }
      if (match("playerSeekBack30")) {
        e.preventDefault();
        seekStep(-30);
        return;
      }
      if (match("playerSeekForward30")) {
        e.preventDefault();
        seekStep(30);
        return;
      }
      if (match("playerFrameForward") && onFrameStep) {
        e.preventDefault();
        onFrameStep(1);
        return;
      }
      if (match("playerFrameBack") && onFrameStep) {
        e.preventDefault();
        onFrameStep(-1);
        return;
      }
      if (match("playerVolumeUp")) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.05;
        const max = bridgeRef.current?.capabilities().engine === "mpv" ? 6 : 1;
        const next = Math.min(max, Math.max(0, snap.volume + step));
        bridgeRef.current?.setVolume(next);
        bridgeRef.current?.setMuted(false);
        writePlayerVolume({ volume: next, muted: false });
        onVolumeFeedback?.(next, false);
        return;
      }
      if (match("playerVolumeDown")) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.05;
        const max = bridgeRef.current?.capabilities().engine === "mpv" ? 6 : 1;
        const next = Math.min(max, Math.max(0, snap.volume - step));
        bridgeRef.current?.setVolume(next);
        bridgeRef.current?.setMuted(false);
        writePlayerVolume({ volume: next, muted: false });
        onVolumeFeedback?.(next, false);
        return;
      }
      if (match("playerMute")) {
        e.preventDefault();
        const next = !snap.muted;
        bridgeRef.current?.setMuted(next);
        writePlayerVolume({ muted: next });
        onVolumeFeedback?.(snap.volume, next);
        return;
      }
      if (match("playerFullscreen")) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (match("playerCrop") && onToggleCrop) {
        e.preventDefault();
        onToggleCrop();
        return;
      }
      if (match("playerAnime4kToggle") && onToggleAnime4k) {
        e.preventDefault();
        onToggleAnime4k();
        return;
      }
      if (match("playerAnime4kOn") && onAnime4kOn) {
        e.preventDefault();
        onAnime4kOn();
        return;
      }
      if (match("playerAnime4kOff") && onAnime4kOff) {
        e.preventDefault();
        onAnime4kOff();
        return;
      }
      if (match("playerPanscanUp") && onPanscanUp) {
        e.preventDefault();
        onPanscanUp();
        return;
      }
      if (match("playerPanscanDown") && onPanscanDown) {
        e.preventDefault();
        onPanscanDown();
        return;
      }
      if (match("playerPrevChannel") && onPrevChannel) {
        e.preventDefault();
        onPrevChannel();
        return;
      }
      if (match("playerSubtitleCycle") || match("playerSubtitleCycleAlt")) {
        e.preventDefault();
        cycleSubtitles();
        return;
      }
      if (match("playerNextEpisode") && hasNextEp && onNextEp) {
        e.preventDefault();
        onNextEp();
        return;
      }
      if (match("playerPrevEpisode") && hasPrevEp && onPrevEp) {
        e.preventDefault();
        onPrevEp();
        return;
      }
      if (match("playerStart")) {
        e.preventDefault();
        seekTo(0);
        return;
      }
      if (match("playerEnd")) {
        e.preventDefault();
        if (snap.durationSec > 0) seekTo(snap.durationSec - 0.5);
        return;
      }
      if (match("playerStats")) {
        e.preventDefault();
        setShowStats((v) => !v);
        return;
      }
      if (match("playerSpeedDown")) {
        e.preventDefault();
        const r = Math.max(0.25, +(snap.rate - 0.25).toFixed(2));
        bridgeRef.current?.setRate(r);
        writePlayerPrefs(metaId, { rate: r });
        return;
      }
      if (match("playerSpeedUp")) {
        e.preventDefault();
        const r = Math.min(3, +(snap.rate + 0.25).toFixed(2));
        bridgeRef.current?.setRate(r);
        writePlayerPrefs(metaId, { rate: r });
        return;
      }
      if (match("playerSubDelayDown")) {
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : 0.1;
        const delay = round2(snap.subDelaySec - step);
        bridgeRef.current?.setSubDelay(delay);
        writePlayerPrefs(metaId, { subDelaySec: delay });
        return;
      }
      if (match("playerSubDelayUp")) {
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : 0.1;
        const delay = round2(snap.subDelaySec + step);
        bridgeRef.current?.setSubDelay(delay);
        writePlayerPrefs(metaId, { subDelaySec: delay });
        return;
      }
      if (match("playerStreamSwitcher") && toggleSwitcher) {
        e.preventDefault();
        toggleSwitcher();
        return;
      }
      if (match("playerEpisodePanel") && toggleEpisodePanel) {
        e.preventDefault();
        toggleEpisodePanel();
        return;
      }
      if (match("playerTvGuide") && toggleGuide) {
        e.preventDefault();
        toggleGuide();
        return;
      }
      if (match("playerDvr") && toggleDvr) {
        e.preventDefault();
        toggleDvr();
        return;
      }
      if (match("playerSleep") && toggleSleep) {
        e.preventDefault();
        toggleSleep();
        return;
      }
      if (match("playerScreenshot") && onScreenshot) {
        e.preventDefault();
        if (e.repeat) return;
        onScreenshot();
        return;
      }
      if (match("playerGifRecord") && onGifRecord) {
        e.preventDefault();
        if (e.repeat) return;
        onGifRecord();
        return;
      }
      if (match("playerClipRecord") && onClipRecord) {
        e.preventDefault();
        if (e.repeat) return;
        onClipRecord();
        return;
      }
      // Jump to N/10 of duration via physical top-row / numpad digits (layout-independent)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const digitCode = /^Digit([0-9])$/.exec(e.code) ?? /^Numpad([0-9])$/.exec(e.code);
        if (digitCode) {
          e.preventDefault();
          const digit = parseInt(digitCode[1], 10);
          if (digit === 0) {
            seekTo(0);
            return;
          }
          if (snap.durationSec > 0) {
            seekTo((snap.durationSec * digit) / 10);
          }
          return;
        }
      }
    };
    const releaseHold = () => {
      const h = holdRef.current;
      h.key = null;
      if (h.timer != null) {
        window.clearTimeout(h.timer);
        h.timer = null;
        return "tap" as const;
      }
      if (h.engaged) {
        h.engaged = false;
        setHoldSpeedActive(false);
        bridgeRef.current?.setRate(h.baseRate);
      }
      return "held" as const;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const h = holdRef.current;
      const released = e.code || e.key;
      if (h.key == null || released !== h.key) return;
      if (releaseHold() === "tap") playPauseToggle();
    };
    const onBlur = () => {
      if (holdRef.current.key != null) releaseHold();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    closePlayer,
    togglePip,
    drawMode,
    snap.muted,
    snap.volume,
    snap.rate,
    snap.durationSec,
    snap.subDelaySec,
    overrides,
    seekBackStepSec,
    seekForwardStepSec,
    seekTo,
    toggleSwitcher,
    toggleEpisodePanel,
    toggleGuide,
    toggleDvr,
    toggleSleep,
    onScreenshot,
    onGifRecord,
    onClipRecord,
    onToggleCrop,
    onPanscanUp,
    onPanscanDown,
    onPrevChannel,
    onToggleAnime4k,
    onAnime4kOn,
    onAnime4kOff,
    onFrameStep,
    onVolumeFeedback,
    settings.playerEscExitsFullscreen,
    settings.playerConfirmLeave,
    update,
  ]);

  return { holdSpeedActive };
}
