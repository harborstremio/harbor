import { reportMusicVideoPlayback, setMusicVideoController } from "./player";
import { musicVideoSyncCorrection } from "./video-sync";
import type { MusicVideoStream } from "./video";

export type MusicVideoHost = { video: HTMLVideoElement; audio: HTMLAudioElement };

/**
 * Parked, not removed. A media element taken out of the document is paused by the browser, so
 * the picture waits here between surfaces: still in the page, still decoding, only its audio
 * track audible. That is what lets leaving the watch page cost nothing.
 */
const PARK_CSS =
  "position:fixed;inset-block-start:0;inset-inline-start:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;";
const SYNC_MS = 250;

let host: MusicVideoHost | null = null;
let park: HTMLElement | null = null;
let sourceKey = "";
let sourceStream: MusicVideoStream | null = null;
let detachTransport: (() => void) | null = null;

export function musicVideoHost(): MusicVideoHost | null {
  if (host) return host;
  if (typeof document === "undefined") return null;
  const video = document.createElement("video");
  video.className = "music-video-media";
  video.playsInline = true;
  video.preload = "auto";
  video.disablePictureInPicture = true;
  const audio = document.createElement("audio");
  audio.preload = "auto";
  park = document.createElement("div");
  park.setAttribute("data-music-video-park", "");
  park.style.cssText = PARK_CSS;
  document.body.appendChild(park);
  park.append(video, audio);
  host = { video, audio };
  return host;
}

export function parkMusicVideoHost(): void {
  if (!host || !park) return;
  if (host.video.parentElement !== park) park.appendChild(host.video);
  if (host.audio.parentElement !== park) park.appendChild(host.audio);
}

/**
 * A handoff is a re-parent inside the same commit, never a rebuild. The nodes go in ahead of the
 * surface's own children so the placeholder and controls keep painting over the picture.
 */
export function adoptMusicVideoHost(parent: HTMLElement): () => void {
  const nodes = musicVideoHost();
  if (!nodes) return () => {};
  parent.insertBefore(nodes.audio, parent.firstChild);
  parent.insertBefore(nodes.video, parent.firstChild);
  return () => {
    if (nodes.video.parentElement === parent || nodes.audio.parentElement === parent)
      parkMusicVideoHost();
  };
}

function attachTransport(nodes: MusicVideoHost, sound: HTMLAudioElement | null): void {
  detachTransport?.();
  const picture = nodes.video;
  const clock: HTMLMediaElement = sound ?? picture;
  const release = setMusicVideoController({
    setPaused: (next) => {
      if (next) {
        sound?.pause();
        picture.pause();
        return;
      }
      void sound?.play().catch(() => {});
      void picture.play().catch(() => {});
    },
    seek: (position) => {
      clock.currentTime = position;
      if (sound) picture.currentTime = position;
    },
    setVolume: (next) => {
      clock.volume = Math.max(0, Math.min(1, next));
    },
  });
  const time = () =>
    reportMusicVideoPlayback({
      currentTime: clock.currentTime,
      duration: Number.isFinite(clock.duration) ? clock.duration : undefined,
    });
  const started = () =>
    reportMusicVideoPlayback({ phase: "playing", currentTime: clock.currentTime });
  const stopped = () =>
    reportMusicVideoPlayback({ phase: "paused", currentTime: clock.currentTime });
  const finished = () => reportMusicVideoPlayback({ ended: true });
  const failed = () => reportMusicVideoPlayback({ error: "music.videos.playbackError" });
  clock.addEventListener("timeupdate", time);
  clock.addEventListener("durationchange", time);
  clock.addEventListener("playing", started);
  clock.addEventListener("pause", stopped);
  clock.addEventListener("ended", finished);
  clock.addEventListener("error", failed);
  picture.addEventListener("error", failed);
  const drift = () => {
    if (!sound) return;
    const correction = musicVideoSyncCorrection({
      audioTime: sound.currentTime,
      videoTime: picture.currentTime,
      baseRate: sound.playbackRate,
      pictureBusy: picture.seeking || picture.readyState < 2,
    });
    if (correction.seekTo !== null) picture.currentTime = correction.seekTo;
    if (picture.playbackRate !== correction.rate) picture.playbackRate = correction.rate;
  };
  const sync = sound ? setInterval(drift, SYNC_MS) : null;
  detachTransport = () => {
    detachTransport = null;
    clock.removeEventListener("timeupdate", time);
    clock.removeEventListener("durationchange", time);
    clock.removeEventListener("playing", started);
    clock.removeEventListener("pause", stopped);
    clock.removeEventListener("ended", finished);
    clock.removeEventListener("error", failed);
    picture.removeEventListener("error", failed);
    if (sync !== null) clearInterval(sync);
    release();
  };
}

export function musicVideoHostSource(key: string): MusicVideoStream | null {
  return sourceKey !== "" && sourceKey === key ? sourceStream : null;
}

export function musicVideoHostLive(): MusicVideoStream | null {
  return sourceStream;
}

/** Assigning src reloads the decoder, so the same stream must never be assigned twice. */
let pendingStart: { key: string; position: number } | null = null;

function seekHostTo(nodes: MusicVideoHost, position: number): void {
  const clock: HTMLMediaElement = nodes.audio.hasAttribute("src") ? nodes.audio : nodes.video;
  const apply = () => {
    const duration = clock.duration;
    const ceiling =
      Number.isFinite(duration) && duration > 0 ? duration - 0.5 : Number.POSITIVE_INFINITY;
    const at = Math.min(position, ceiling);
    if (!(at > 0.5)) return;
    for (const node of [clock, nodes.video] as HTMLMediaElement[]) {
      if (!node.hasAttribute("src")) continue;
      if (Math.abs(node.currentTime - at) > 0.75) node.currentTime = at;
    }
  };
  if (clock.readyState >= 1) apply();
  else clock.addEventListener("loadedmetadata", apply, { once: true });
}

export function primeMusicVideoHostPosition(key: string, position: number): void {
  if (!Number.isFinite(position) || position <= 0.5) {
    pendingStart = null;
    return;
  }
  const nodes = musicVideoHost();
  if (nodes && sourceKey === key && nodes.video.hasAttribute("src")) {
    pendingStart = null;
    seekHostTo(nodes, position);
    return;
  }
  pendingStart = { key, position };
}

export function setMusicVideoHostSource(
  key: string,
  stream: MusicVideoStream,
): MusicVideoHost | null {
  const nodes = musicVideoHost();
  if (!nodes) return null;
  detachTransport?.();
  sourceKey = key;
  sourceStream = stream;
  nodes.video.muted = !!stream.audioUrl;
  if (nodes.video.getAttribute("src") !== stream.url) nodes.video.src = stream.url;
  if (stream.audioUrl) {
    if (nodes.audio.getAttribute("src") !== stream.audioUrl) nodes.audio.src = stream.audioUrl;
  } else if (nodes.audio.hasAttribute("src")) {
    nodes.audio.pause();
    nodes.audio.removeAttribute("src");
    nodes.audio.load();
  }
  attachTransport(nodes, stream.audioUrl ? nodes.audio : null);
  if (pendingStart && pendingStart.key === key) {
    const at = pendingStart.position;
    pendingStart = null;
    seekHostTo(nodes, at);
  }
  return nodes;
}

/** Only the session that owns the current source may end it; a newer one has already replaced it. */
export function releaseMusicVideoHostSource(key: string): void {
  if (!host || (key !== "" && key !== sourceKey)) return;
  sourceKey = "";
  sourceStream = null;
  detachTransport?.();
  for (const node of [host.video, host.audio] as HTMLMediaElement[]) {
    node.pause();
    if (!node.hasAttribute("src")) continue;
    node.removeAttribute("src");
    node.load();
  }
  parkMusicVideoHost();
}
