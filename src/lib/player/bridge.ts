import type { SubCue } from "@/lib/subtitles/parser";
import type { SubtitleLoadMetadata } from "./subtitle-load";

export type TrackInfo = {
  id: string;
  label: string;
  lang?: string;
  kind: "audio" | "subtitle";
  selected: boolean;
  codec?: string;
  channels?: string;
  channelCount?: number;
  title?: string;
  external?: boolean;
  externalFilename?: string;
  forced?: boolean;
  default?: boolean;
  hearingImpaired?: boolean;
  url?: string;
};

export type Chapter = {
  title: string;
  startSec: number;
};

export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

export function loadingSurfaceFor(input: {
  forceShow: boolean;
  everPlayed: boolean;
  buffering: boolean;
  status: PlayerStatus;
  errorCode: PlayerSnapshot["errorCode"];
}): "startup" | "buffering" | null {
  if (input.errorCode != null || input.status === "ended") return null;
  if (input.forceShow || !input.everPlayed) return "startup";
  return input.buffering ? "buffering" : null;
}

export type PlayerSnapshot = {
  status: PlayerStatus;
  positionSec: number;
  durationSec: number;
  bufferedSec: number;
  buffering: boolean;
  volume: number;
  muted: boolean;
  rate: number;
  audioTracks: TrackInfo[];
  subtitleTracks: TrackInfo[];
  chapters: Chapter[];
  subDelaySec: number;
  audioDelaySec: number;
  subText: string;
  subStartSec: number;
  audioNormalize: boolean;
  videoWidth: number;
  videoHeight: number;
  hdrGamma: string;
  errorMessage: string | null;
  errorCode: "decode" | "codec" | "network" | "source" | "unknown" | null;
  noAudio?: boolean;
};

export type PlayerSource = {
  url: string;
  subtitles?: { id?: string; url: string; lang?: string; m?: string }[];
  notWebReady?: boolean;
  startAtSec?: number;
  isLive?: boolean;
  headers?: Record<string, string>;
};

export type PlayerBridge = {
  attach: (host: HTMLElement) => void;
  detach: () => void;
  load: (src: PlayerSource) => Promise<void>;
  play: () => Promise<void>;
  pause: () => void;
  seek: (sec: number) => void;
  frameStep?: (dir: 1 | -1) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setRate: (r: number) => void;
  setAudioTrack: (id: string) => void;
  setSubtitleTrack: (id: string | null) => void;
  setSubVisible: (on: boolean) => void;
  setSubDelay: (sec: number) => void;
  setAudioDelay: (sec: number) => void;
  setPanscan: (value: number) => void;
  setVideoZoom: (log2: number) => void;
  setAspectOverride: (ratio: string) => void;
  setStretch: (on: boolean) => void;
  setVideoEq: (name: string, value: number) => void;
  setAnime4kShaders: (shaders: string[]) => void;
  addSubtitle: (
    url: string,
    lang?: string,
    title?: string,
    select?: boolean,
    metadata?: SubtitleLoadMetadata,
  ) => Promise<boolean>;
  getSelectedTrackCues: () => SubCue[] | null;
  getSelectedTrackUrl: () => string | null;
  setAudioNormalize: (on: boolean) => void;
  setAudioProfile?: (profile: string) => void;
  setHdrToSdr?: (on: boolean, oled: boolean) => void;
  setAudioDevice?: (name: string) => void;
  setMediaInfo?: (info: { title: string; artist?: string; artwork?: string }) => void;
  screenshot: (path: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  setAbLoop: (a: number | null, b: number | null) => void;
  requestPiP: () => Promise<void>;
  exitPiP: () => Promise<void>;
  requestFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  capabilities: () => PlayerCapabilities;
  subscribe: (listener: (snap: PlayerSnapshot) => void) => () => void;
  destroy: () => void;
};

export type PlayerCapabilities = {
  engine: "html5" | "mpv";
  pictureInPicture: boolean;
  airplay: boolean;
  chromecast: boolean;
  hdrPassthrough: boolean;
  hardwareDecode: boolean;
};

export const emptySnapshot: PlayerSnapshot = {
  status: "idle",
  positionSec: 0,
  durationSec: 0,
  bufferedSec: 0,
  buffering: false,
  volume: 1,
  muted: false,
  rate: 1,
  audioTracks: [],
  subtitleTracks: [],
  chapters: [],
  subDelaySec: 0,
  audioDelaySec: 0,
  subText: "",
  subStartSec: 0,
  audioNormalize: false,
  videoWidth: 0,
  videoHeight: 0,
  hdrGamma: "",
  errorMessage: null,
  errorCode: null,
};
