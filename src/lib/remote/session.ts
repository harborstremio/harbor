import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import type { CastDeviceInfo } from "@/lib/cast";
import type { PlayerSrc } from "@/lib/view";
import { injectHostNav } from "./inject-host-nav";
import {
  applyTextToFocused,
  armFocusedTextEntry,
  disarmFocusedTextEntry,
  readHostTextEntry,
  submitFocusedText,
} from "./text-entry";
import {
  idleSnapshot,
  REMOTE_PROTO,
  type RemoteCastDevice,
  type RemoteCommand,
  type RemoteEpisodeRef,
  type RemoteSnapshot,
  type RemoteSourceInfo,
  type RemoteTarget,
} from "./protocol";

export { readHostTextEntry } from "./text-entry";

export type RemotePlaybackBinding = {
  bridge: PlayerBridge | null;
  snap: PlayerSnapshot;
  src: PlayerSrc | null;
  castDevice: CastDeviceInfo | null;
  castPlaying: boolean;
  castPositionSec: number;
  playCast: () => Promise<void>;
  pauseCast: () => Promise<void>;
  seekCast: (sec: number) => Promise<void>;
  stopCast: () => Promise<void>;
  /** Full cast path (URL resolve + load), same as the player cast menu. */
  onPickDevice: (device: CastDeviceInfo) => Promise<void>;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  /** Show the in-player volume HUD (same as wheel / hotkeys). */
  onVolumeFeedback?: (volume: number, muted: boolean) => void;
};

type StickyMedia = {
  mediaId: string | null;
  mediaTitle: string | null;
  posterUrl: string | null;
  episode: RemoteEpisodeRef | null;
  source: RemoteSourceInfo | null;
  positionSec: number;
  durationSec: number;
  volume: number;
  muted: boolean;
  playing: boolean;
  hasPrevEpisode: boolean;
  hasNextEpisode: boolean;
  subtitlesOn: boolean;
  canToggleSubtitles: boolean;
};

function subtitleFlags(b: RemotePlaybackBinding): {
  subtitlesOn: boolean;
  canToggleSubtitles: boolean;
} {
  const casting = !!b.castDevice;
  const tracks = b.snap.subtitleTracks ?? [];
  return {
    subtitlesOn: !casting && tracks.some((t) => t.selected),
    canToggleSubtitles: !casting && tracks.length > 0,
  };
}

type Listener = () => void;

const LOCAL_TARGET: RemoteTarget = { kind: "local", label: "This PC" };

let binding: RemotePlaybackBinding | null = null;
let preferredTarget: RemoteTarget = LOCAL_TARGET;
let castDevices: RemoteCastDevice[] = [];
let castDiscovering = false;
let sticky: StickyMedia | null = null;
let stickyClearTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

/** Keep last media briefly when PlayerView unmounts during episode switches. */
const STICKY_CLEAR_MS = 1200;

/** Armed by next-episode / autoplay hops so unmount doesn't flash the remote idle. */
let stickyHopArmed = false;

function notify() {
  for (const l of listeners) l();
}

function clearStickyTimer() {
  if (stickyClearTimer != null) {
    clearTimeout(stickyClearTimer);
    stickyClearTimer = null;
  }
}

/** Call before replacing the player with a picker (next episode, auto-retry, etc.). */
export function armRemoteStickyHop(): void {
  stickyHopArmed = true;
}

function clearStickyMedia() {
  clearStickyTimer();
  stickyHopArmed = false;
  sticky = null;
}

function rememberStickyFromBinding(b: RemotePlaybackBinding) {
  if (!b.src) return;
  const casting = !!b.castDevice;
  const status = b.snap.status;
  const playing = casting
    ? b.castPlaying
    : status === "playing" || status === "loading" || status === "ready";
  sticky = {
    mediaId: b.src.meta.id,
    mediaTitle: remoteMediaTitle(b.src),
    posterUrl: b.src.meta.poster ?? b.src.meta.background ?? null,
    episode: episodeFromSrc(b.src),
    source: b.src.streamRef
      ? {
          label: b.src.streamRef.parsedTitle ?? b.src.streamRef.title ?? null,
          resolution: b.src.streamRef.resolution ?? null,
          quality: b.src.streamRef.quality ?? null,
          releaseGroup: b.src.streamRef.releaseGroup ?? null,
        }
      : null,
    positionSec: casting ? b.castPositionSec || b.snap.positionSec : b.snap.positionSec,
    durationSec: b.snap.durationSec || sticky?.durationSec || 0,
    volume: b.snap.volume,
    muted: b.snap.muted,
    playing,
    hasPrevEpisode: !!b.onPrevEpisode && !!b.hasPrevEpisode,
    hasNextEpisode: !!b.onNextEpisode && !!b.hasNextEpisode,
    ...subtitleFlags(b),
  };
}

export function subscribeRemoteSession(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function registerRemotePlayback(next: RemotePlaybackBinding | null): void {
  binding = next;
  if (next?.src) {
    clearStickyTimer();
    stickyHopArmed = false;
    rememberStickyFromBinding(next);
  } else if (next === null) {
    clearStickyTimer();
    if (stickyHopArmed) {
      // Episode hop / auto-retry: hold Now Playing briefly across the picker gap.
      stickyHopArmed = false;
      stickyClearTimer = setTimeout(() => {
        stickyClearTimer = null;
        if (!binding?.src) {
          sticky = null;
          notify();
        }
      }, STICKY_CLEAR_MS);
    } else {
      // Real exit — drop sticky immediately so the remote leaves Now Playing fast.
      clearStickyMedia();
    }
  }
  if (next?.castDevice) {
    preferredTarget = {
      kind: "cast",
      deviceId: next.castDevice.id,
      label: next.castDevice.name,
      castKind: next.castDevice.kind,
    };
  } else if (next?.src && preferredTarget.kind === "cast" && !next.castDevice) {
    preferredTarget = LOCAL_TARGET;
  }
  notify();
}

export function setRemoteCastDevices(devices: CastDeviceInfo[]): void {
  castDevices = devices.map((d) => ({
    id: d.id,
    name: d.name,
    kind: d.kind,
    host: d.host,
    port: d.port,
    model: d.model,
    controlUrl: d.control_url,
    audioOnly: d.audio_only,
  }));
  notify();
}

export function setRemoteCastDiscovering(next: boolean): void {
  castDiscovering = next;
  notify();
}

export function getRemoteCastDevices(): RemoteCastDevice[] {
  return castDevices;
}

export function getPreferredRemoteTarget(): RemoteTarget {
  return preferredTarget;
}

export function setPreferredRemoteTarget(target: RemoteTarget): void {
  preferredTarget = target;
  notify();
}

function episodeFromSrc(src: PlayerSrc | null): RemoteEpisodeRef | null {
  if (!src?.episode) return null;
  return {
    season: src.episode.season,
    episode: src.episode.episode,
    name: src.episode.name,
  };
}

/** Show name for series; movie/stream title otherwise. */
function remoteMediaTitle(src: PlayerSrc): string | null {
  if (src.episode) return src.meta.name || src.title || null;
  return src.title || src.meta.name || null;
}

function snapshotFromSticky(): RemoteSnapshot {
  const s = sticky!;
  return {
    proto: REMOTE_PROTO,
    idle: false,
    mediaId: s.mediaId,
    mediaTitle: s.mediaTitle,
    posterUrl: s.posterUrl,
    episode: s.episode,
    source: s.source,
    positionSec: s.positionSec,
    durationSec: s.durationSec,
    // While resolving the next stream, keep UI as "playing" so controls don't flicker.
    playing: true,
    volume: s.volume,
    muted: s.muted,
    target: preferredTarget,
    castDevices,
    castDiscovering,
    hasPrevEpisode: s.hasPrevEpisode,
    hasNextEpisode: s.hasNextEpisode,
    subtitlesOn: s.subtitlesOn,
    canToggleSubtitles: s.canToggleSubtitles,
    textEntry: readHostTextEntry(),
    updatedAt: Date.now(),
  };
}

export function buildRemoteSnapshot(positionSec?: number): RemoteSnapshot {
  const b = binding;
  if (!b?.src) {
    if (sticky) return snapshotFromSticky();
    return idleSnapshot({
      target: preferredTarget,
      castDevices,
      castDiscovering,
      volume: b?.snap.volume ?? 1,
      muted: b?.snap.muted ?? false,
      textEntry: readHostTextEntry(),
    });
  }

  const casting = !!b.castDevice;
  const status = b.snap.status;
  // Treat loading/ready as playing so remote doesn't flash paused between
  // buffer stalls / episode loads.
  const playing = casting
    ? b.castPlaying
    : status === "playing" || status === "loading" || status === "ready";
  const pos = casting ? b.castPositionSec || positionSec || 0 : (positionSec ?? b.snap.positionSec);
  const target: RemoteTarget = casting
    ? {
        kind: "cast",
        deviceId: b.castDevice!.id,
        label: b.castDevice!.name,
        castKind: b.castDevice!.kind,
      }
    : preferredTarget.kind === "cast"
      ? preferredTarget
      : LOCAL_TARGET;

  rememberStickyFromBinding(b);

  return {
    proto: REMOTE_PROTO,
    idle: false,
    mediaId: b.src.meta.id,
    mediaTitle: remoteMediaTitle(b.src),
    posterUrl: b.src.meta.poster ?? b.src.meta.background ?? null,
    episode: episodeFromSrc(b.src),
    source: b.src.streamRef
      ? {
          label: b.src.streamRef.parsedTitle ?? b.src.streamRef.title ?? null,
          resolution: b.src.streamRef.resolution ?? null,
          quality: b.src.streamRef.quality ?? null,
          releaseGroup: b.src.streamRef.releaseGroup ?? null,
        }
      : null,
    positionSec: pos,
    durationSec: b.snap.durationSec || sticky?.durationSec || 0,
    playing,
    volume: b.snap.volume,
    muted: b.snap.muted,
    target,
    castDevices,
    castDiscovering,
    hasPrevEpisode: !!b.onPrevEpisode && !!b.hasPrevEpisode,
    hasNextEpisode: !!b.onNextEpisode && !!b.hasNextEpisode,
    ...subtitleFlags(b),
    textEntry: readHostTextEntry(),
    updatedAt: Date.now(),
  };
}

export async function dispatchRemoteCommand(command: RemoteCommand): Promise<void> {
  const b = binding;

  switch (command.action) {
    case "ping":
    case "castDiscover":
      return;
    case "nav": {
      if (command.key === "select" && armFocusedTextEntry()) {
        notify();
        return;
      }
      injectHostNav(command.key);
      return;
    }
    case "setText": {
      applyTextToFocused(command.value);
      return;
    }
    case "submitText": {
      if (typeof command.value === "string") applyTextToFocused(command.value);
      submitFocusedText();
      return;
    }
    case "blurText": {
      disarmFocusedTextEntry();
      notify();
      return;
    }
    case "openSearch": {
      if (typeof window === "undefined") return;
      window.dispatchEvent(new Event("harbor:open-search"));
      return;
    }
    case "toggleSubtitles": {
      // Simple remote-friendly toggle: on uses the first available subtitle track,
      // off clears subtitles. Local player only.
      if (!b || b.castDevice) return;
      const bridge = b.bridge;
      if (!bridge) return;
      const subs = b.snap.subtitleTracks;
      if (subs.length === 0) return;
      const hasSelected = subs.some((t) => t.selected);
      if (hasSelected) bridge.setSubtitleTrack(null);
      else bridge.setSubtitleTrack(subs[0].id);
      notify();
      return;
    }
    case "castStop": {
      await b?.stopCast();
      preferredTarget = LOCAL_TARGET;
      notify();
      return;
    }
    case "setTarget": {
      if (command.target === "local") {
        preferredTarget = LOCAL_TARGET;
        if (b?.castDevice) {
          const pos = b.castPositionSec || b.snap.positionSec;
          await b.stopCast();
          b.bridge?.seek(pos);
          await b.bridge?.play().catch(() => {});
        }
        notify();
        return;
      }
      const castDeviceId = command.target.castDeviceId;
      const device = castDevices.find((d) => d.id === castDeviceId);
      if (!device || !b) return;
      preferredTarget = {
        kind: "cast",
        deviceId: device.id,
        label: device.name,
        castKind: device.kind,
      };
      const full: CastDeviceInfo = {
        id: device.id,
        name: device.name,
        host: device.host,
        port: device.port,
        model: device.model ?? null,
        kind: device.kind,
        control_url: device.controlUrl ?? null,
        audio_only: device.audioOnly ?? false,
      };
      if (!b.src) {
        notify();
        return;
      }
      await b.onPickDevice(full);
      notify();
      return;
    }
    case "play": {
      if (!b) return;
      if (b.castDevice) await b.playCast();
      else await b.bridge?.play().catch(() => {});
      notify();
      return;
    }
    case "prevEpisode": {
      b?.onPrevEpisode?.();
      notify();
      return;
    }
    case "nextEpisode": {
      b?.onNextEpisode?.();
      notify();
      return;
    }
    case "pause": {
      if (!b) return;
      if (b.castDevice) await b.pauseCast();
      else b.bridge?.pause();
      notify();
      return;
    }
    case "seek": {
      if (!b) return;
      if (b.castDevice) await b.seekCast(Math.max(0, command.positionSec));
      else b.bridge?.seek(Math.max(0, command.positionSec));
      notify();
      return;
    }
    case "setVolume": {
      if (!b?.bridge) return;
      const v = Math.max(0, Math.min(1, command.volume));
      b.bridge.setVolume(v);
      const muted = v > 0 ? false : b.snap.muted;
      if (v > 0 && b.snap.muted) b.bridge.setMuted(false);
      b.onVolumeFeedback?.(v, muted);
      notify();
      return;
    }
    case "setMuted": {
      b?.bridge?.setMuted(command.muted);
      if (b) b.onVolumeFeedback?.(b.snap.volume, command.muted);
      notify();
      return;
    }
    default:
      return;
  }
}
