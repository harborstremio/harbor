import type { ControlContext } from "@/components/player/transport/control-renderer";
import type { StremioRenderCtx } from "@/components/player/transport/control-renderer-stremio";
import type {
  ControlVariant,
  CustomIconMap,
  PlayerControlId,
  TimeFormat,
  VolumeStyle,
} from "@/lib/player-chrome";
import { emptySnapshot, type PlayerCapabilities } from "@/lib/player/bridge";

const NOOP = () => {};
const NOOP_NUM = (_: number) => {};
const NOOP_STR = (_: string) => {};
const NOOP_BOOL = (_: boolean) => {};

const MOCK_CAPS: PlayerCapabilities = {
  engine: "mpv",
  pictureInPicture: true,
  airplay: false,
  chromecast: true,
  hdrPassthrough: true,
  hardwareDecode: true,
};

const MOCK_SNAP = {
  ...emptySnapshot,
  status: "playing" as const,
  positionSec: 1342,
  durationSec: 6420,
  volume: 0.7,
};

export type PlayerMode = "normal" | "live" | "together";

export type MockOptions = {
  mid: boolean;
  compact: boolean;
  tight: boolean;
  mode: PlayerMode;
  customIcons?: CustomIconMap;
  controlVariants?: Partial<Record<PlayerControlId, ControlVariant>>;
  timeFormat?: TimeFormat;
  volumeStyle?: VolumeStyle;
  previewStates?: Partial<Record<PlayerControlId, string>>;
};

export function buildDefaultCtx(opts: MockOptions): ControlContext {
  const isLive = opts.mode === "live";
  const isTogether = opts.mode === "together";
  const ps = opts.previewStates ?? {};
  const playing = ps["play-pause"] === "paused" ? false : true;
  const fullscreen = ps["fullscreen"] === "fullscreen";
  const drawMode = ps["draw-toggle"] === "active";
  return {
    snap: MOCK_SNAP,
    capabilities: MOCK_CAPS,
    fullscreen,
    drawMode,
    hideOthersDrawings: false,
    showDraw: isTogether,
    isWatchTogether: isTogether,
    playing,
    mid: opts.mid,
    compact: opts.compact,
    tight: opts.tight,
    active: true,
    isLiveChannel: isLive,
    showEpisodeNav: !isLive,
    hasPrevEp: !isLive,
    hasNextEp: !isLive,
    canPickAnother: true,
    engine: "mpv",
    useOverlayPopups: false,
    customIcons: opts.customIcons,
    previewStates: opts.previewStates,
    controlVariants: opts.controlVariants,
    timeFormat: opts.timeFormat,
    volumeStyle: opts.volumeStyle,
    seekBackStepSec: 10,
    seekForwardStepSec: 10,
    title: isLive ? "Sample Channel" : "Sample Movie Title",
    subtitle: isLive ? "Live now" : "Season 1 · Episode 3",
    titleClickable: !isLive,
    onBack: NOOP,
    onTitleClick: NOOP,
    season: isLive ? null : 1,
    episode: isLive ? null : 1,
    download: { kind: "idle" },
    onPlayPause: NOOP,
    onSeekStep: NOOP_NUM,
    onMute: NOOP,
    onVolume: NOOP_NUM,
    onAudio: NOOP_STR,
    onSubtitle: NOOP,
    onSubDelay: NOOP_NUM,
    onAudioDelay: NOOP_NUM,
    onAddSubtitle: NOOP,
    onRate: NOOP_NUM,
    onPiP: NOOP,
    onFullscreen: NOOP,
    onCast: NOOP,
    onToggleDraw: NOOP,
    onToggleHideOthers: NOOP,
    onClearDraw: NOOP,
    onScreenshot: NOOP,
    onPickAnother: NOOP,
    onPrevEp: NOOP,
    onNextEp: NOOP,
    onDownloadStart: NOOP,
    onDownloadCancel: NOOP,
    onDownloadReveal: NOOP,
    onDownloadReset: NOOP,
    onOpenDvr: NOOP,
    setAudioMenuOpen: NOOP_BOOL,
    setSubtitleMenuOpen: NOOP_BOOL,
    setSpeedMenuOpen: NOOP_BOOL,
    setAspectMenuOpen: NOOP_BOOL,
    setAnime4kMenuOpen: NOOP_BOOL,
    cropMode: "fit",
    onCropMode: NOOP_STR,
    anime4kMode: "auto",
    onAnime4kMode: NOOP_STR,
    anime4kAvailable: true,
    editing: true,
  };
}

export function buildStremioCtx(opts: MockOptions): StremioRenderCtx {
  return buildDefaultCtx(opts) as unknown as StremioRenderCtx;
}
