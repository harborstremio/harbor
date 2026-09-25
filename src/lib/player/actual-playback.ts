import type { ActualPlayback, PlaybackActor } from "../playback-history";
import type { PlayerSrc } from "../view";
import type { PlayerSnapshot } from "./bridge";
import { isLivePlaybackSrc } from "./live-src";
import { isNaturalEnd } from "./playback-end";
import { playbackAudioChoice } from "./audio-choice";

export function actualPlaybackSnapshot(
  src: PlayerSrc,
  snapshot: PlayerSnapshot,
  positionSec: number,
  session: { id: string; actor: PlaybackActor },
  at = Date.now(),
): ActualPlayback | null {
  if (
    isLivePlaybackSrc(src) ||
    !snapshot.firstFrameReady ||
    !["playing", "paused", "ended"].includes(snapshot.status) ||
    !Number.isFinite(positionSec) ||
    positionSec <= 0 ||
    !src.meta.id ||
    !src.url
  )
    return null;
  // Runtime-only handles cannot survive restarting Harbor. Keep the original
  // source identity and send proxy/torrent sources through normal preparation.
  const {
    continuation: _continuation,
    playbackTraceId: _trace,
    proxySessionId,
    attempt: _attempt,
    autoFired: _auto,
    startPositionMs: _start,
    startPaused: _paused,
    startFromZero: _zero,
    ...saved
  } = src;
  const { videos: _videos, description: _description, ...meta } = src.meta;
  const selectedAudio = snapshot.audioTracks.find((track) => track.selected);
  return {
    ...session,
    playedAt: at,
    positionMs: Math.round(positionSec * 1000),
    durationMs: Math.max(0, Math.round(snapshot.durationSec * 1000)),
    // Watched/progress thresholds do not mean the player finished. A paused
    // near-end session must still continue from its actual position.
    completed: isNaturalEnd(snapshot, positionSec),
    src: { ...saved, meta, url: src.historyUrl ?? src.url },
    requiresSourceRefresh: !!proxySessionId || !!src.streamRef?.infoHash || !!src.homeServer,
    audioTrack: selectedAudio ? playbackAudioChoice(selectedAudio) : undefined,
  };
}
