import type { SubCue } from "@/lib/subtitles/parser";
import type { SubtitleLoadMetadata } from "@/lib/subtitles/types";
import type { SubtitleMatchConfidence } from "@/lib/subtitles/release-match";

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
  secondary?: boolean;
  url?: string;
  release?: string;
  provider?: string;
  fps?: number;
  downloads?: number;
  author?: string;
  matchScore?: number;
  matchConfidence?: SubtitleMatchConfidence;
  matchReasons?: string[];
  subId?: string;
};

export type Chapter = {
  title: string;
  startSec: number;
};

export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

export type PlayerSeekPrecision = "exact" | "keyframes";

export type PlayerSnapshot = {
  status: PlayerStatus;
  positionSec: number;
  durationSec: number;
  bufferedSec: number;
  buffering: boolean;
  firstFrameReady: boolean;
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
  secondarySubText: string;
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
  traceId?: string;
  startupProfile?: "standard" | "high-bitrate";
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
  seek: (sec: number, precision?: PlayerSeekPrecision) => void;
  frameStep?: (dir: 1 | -1) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setRate: (r: number) => void;
  setAudioTrack: (id: string) => void;
  setSubtitleTrack: (id: string | null) => void;
  setSecondarySubtitleTrack: (id: string | null) => void;
  setSubVisible: (on: boolean) => void;
  setSubDelay: (sec: number) => void;
  setAudioDelay: (sec: number) => void;
  setPanscan: (value: number) => void;
  setVideoZoom: (log2: number) => void;
  setAspectOverride: (ratio: string) => void;
  setStretch: (on: boolean) => void;
  setVideoEq: (name: string, value: number) => void;
  setAnime4kShaders: (shaders: string[]) => void;
  setShaderProps?: (props: Record<string, string>) => void;
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
  firstFrameReady: false,
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
  secondarySubText: "",
  audioNormalize: false,
  videoWidth: 0,
  videoHeight: 0,
  hdrGamma: "",
  errorMessage: null,
  errorCode: null,
};
