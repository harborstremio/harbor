import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import type { PlayEpisode } from "@/lib/view";
import { useClipRecorder } from "./use-clip-recorder";
import { useFrameGrab } from "./use-frame-grab";
import { useGifRecorder } from "./use-gif-recorder";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
import { useLiveChannelOverlay } from "./use-live-channel-overlay";
import { useSleepTimer } from "./use-sleep-timer";
import { useVideoFill } from "./use-video-fill";

export function usePlayerHotkeys(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  snap: PlayerSnapshot;
  metaId: string;
  svpActive: boolean;
  drawMode: boolean;
  setDrawMode: Dispatch<SetStateAction<boolean>>;
  closePlayer: () => Promise<void>;
  playPauseToggle: () => void;
  seekStep: (delta: number) => void;
  seekTo: (sec: number) => void;
  toggleFullscreen: () => void;
  togglePip: () => void;
  fullscreen: boolean;
  cycleSubtitles: () => void;
  canChangeEpisode: boolean;
  adjacent: { prev: PlayEpisode | null; next: PlayEpisode | null };
  goToEpisode: (ep: PlayEpisode | null) => void;
  toggleSwitcher: () => void;
  toggleEpisodePanel: () => void;
  liveOverlay: ReturnType<typeof useLiveChannelOverlay>;
  toggleDvr: () => void;
  sleep: ReturnType<typeof useSleepTimer>;
  quickToolsEnabled: boolean;
  frameGrab: ReturnType<typeof useFrameGrab>;
  gif: ReturnType<typeof useGifRecorder>;
  clip: ReturnType<typeof useClipRecorder>;
  videoFill: ReturnType<typeof useVideoFill>;
  onToggleAnime4k?: () => void;
  onAnime4kOn?: () => void;
  onAnime4kOff?: () => void;
  onVolumeFeedback?: (volume: number, muted: boolean) => void;
}) {
  const {
    bridgeRef,
    snap,
    metaId,
    svpActive,
    drawMode,
    setDrawMode,
    closePlayer,
    playPauseToggle,
    seekStep,
    seekTo,
    toggleFullscreen,
    togglePip,
    fullscreen,
    cycleSubtitles,
    canChangeEpisode,
    adjacent,
    goToEpisode,
    toggleSwitcher,
    toggleEpisodePanel,
    liveOverlay,
    toggleDvr,
    sleep,
    quickToolsEnabled,
    frameGrab,
    gif,
    clip,
    videoFill,
    onToggleAnime4k,
    onAnime4kOn,
    onAnime4kOff,
    onVolumeFeedback,
  } = params;

  const [showStats, setShowStats] = useState(false);
  const { holdSpeedActive } = useKeyboardShortcuts({
    bridgeRef,
    snap,
    drawMode,
    setDrawMode,
    closePlayer,
    playPauseToggle,
    seekStep,
    seekTo,
    toggleFullscreen,
    togglePip,
    fullscreen,
    cycleSubtitles,
    setShowStats,
    metaId,
    svpActive,
    onNextEp: canChangeEpisode && adjacent.next ? () => goToEpisode(adjacent.next) : undefined,
    onPrevEp: canChangeEpisode && adjacent.prev ? () => goToEpisode(adjacent.prev) : undefined,
    hasNextEp: canChangeEpisode && !!adjacent.next,
    hasPrevEp: canChangeEpisode && !!adjacent.prev,
    toggleSwitcher,
    toggleEpisodePanel,
    toggleGuide: () => {
      if (liveOverlay.isLive) liveOverlay.setOpen((o) => !o);
    },
    toggleDvr: () => {
      if (liveOverlay.isLive) toggleDvr();
    },
    toggleSleep: () =>
      sleep.mode.kind === "off" ? sleep.set({ kind: "end_episode" }) : sleep.cancel(),
    onScreenshot: quickToolsEnabled ? () => frameGrab.trigger() : undefined,
    onGifRecord: quickToolsEnabled ? () => gif.toggle() : undefined,
    onClipRecord: quickToolsEnabled ? () => clip.openChooser() : undefined,
    onToggleCrop: () => videoFill.cycle(),
    onPanscanUp: () => videoFill.step(0.1),
    onPanscanDown: () => videoFill.step(-0.1),
    onPrevChannel: liveOverlay.isLive ? liveOverlay.goPrevChannel : undefined,
    onToggleAnime4k,
    onAnime4kOn,
    onAnime4kOff,
    onFrameStep: (dir) => bridgeRef.current?.frameStep?.(dir),
    onVolumeFeedback,
  });

  return { holdSpeedActive, showStats };
}
