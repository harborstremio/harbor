import {
  getActiveProfile,
  updateActiveProfileConfig,
  type SaveResult,
} from "./player-chrome-profiles";

export type PlayerSlot =
  | "top-left"
  | "top-right"
  | "seek-leading"
  | "seek-trailing"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type PlayerControlId =
  | "back"
  | "title-info"
  | "time-start"
  | "time-end"
  | "volume"
  | "dvr"
  | "download"
  | "prev-episode"
  | "seek-back"
  | "play-pause"
  | "seek-forward"
  | "next-episode"
  | "pick-another"
  | "audio-menu"
  | "subtitle-menu"
  | "speed-menu"
  | "aspect-menu"
  | "anime4k-menu"
  | "hdr-toggle"
  | "rtx-hdr-toggle"
  | "draw-toggle"
  | "screenshot"
  | "song-id"
  | "pip"
  | "cast"
  | "fullscreen"
  | "window-controls";

export type PanelId = "avatars" | "chat" | "episodes";
export type PanelCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type PanelConfig = {
  corner: PanelCorner;
  hidden?: boolean;
};

export const PANELS: readonly PanelId[] = ["avatars", "chat", "episodes"];

export type PanelPlacementMode = "corner" | "side";

export const PANEL_META: Record<
  PanelId,
  { label: string; defaultCorner: PanelCorner; placementMode: PanelPlacementMode }
> = {
  avatars: { label: "Viewer avatars", defaultCorner: "top-right", placementMode: "corner" },
  chat: { label: "Chat", defaultCorner: "bottom-left", placementMode: "corner" },
  episodes: { label: "Next-up episodes tab", defaultCorner: "top-right", placementMode: "side" },
};

export const PANEL_CORNERS: readonly PanelCorner[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export type ControlVariant = "auto" | "full" | "condensed";

export type PlayerControlConfig = {
  id: PlayerControlId;
  slot: PlayerSlot;
  order: number;
  hidden?: boolean;
  variant?: ControlVariant;
};

export const VARIANT_AWARE_CONTROLS: readonly PlayerControlId[] = ["prev-episode", "next-episode"];

export function isVariantAware(id: PlayerControlId): boolean {
  return VARIANT_AWARE_CONTROLS.includes(id);
}

export type VolumeStyle = "slider" | "stepper" | "icon-only";
export type TimeFormat = "start-end" | "remaining" | "elapsed-only";

export type CustomIconMap = Record<string, string>;

export const CONTROL_STATES: Partial<Record<PlayerControlId, readonly string[]>> = {
  "play-pause": ["playing", "paused"],
  fullscreen: ["fullscreen", "windowed"],
  "draw-toggle": ["active", "inactive"],
  cast: ["connected", "idle"],
  dvr: ["recording", "idle"],
  pip: ["active", "inactive"],
  download: ["idle", "downloading", "complete", "error"],
};

export const STATE_LABEL: Record<string, string> = {
  playing: "Playing",
  paused: "Paused",
  fullscreen: "Fullscreen",
  windowed: "Windowed",
  active: "Active",
  inactive: "Inactive",
  connected: "Connected",
  idle: "Idle",
  recording: "Recording",
  downloading: "Downloading",
  complete: "Complete",
  error: "Error",
};

export function controlStates(id: PlayerControlId): readonly string[] {
  return CONTROL_STATES[id] ?? [];
}

export function iconKey(id: PlayerControlId, state?: string): string {
  return state ? `${id}:${state}` : id;
}

export function getCustomIcon(
  map: CustomIconMap | undefined,
  id: PlayerControlId,
  state?: string,
): string | undefined {
  if (!map) return undefined;
  if (state) {
    const k = iconKey(id, state);
    if (map[k]) return map[k];
  }
  return map[id];
}

export const ICON_REPLACEABLE_CONTROLS: readonly PlayerControlId[] = [
  "back",
  "play-pause",
  "seek-back",
  "seek-forward",
  "prev-episode",
  "next-episode",
  "pick-another",
  "dvr",
  "download",
  "draw-toggle",
  "pip",
  "cast",
  "fullscreen",
];

export function isIconReplaceable(id: PlayerControlId): boolean {
  return ICON_REPLACEABLE_CONTROLS.includes(id);
}

export type PlayerChromeConfig = {
  controls: PlayerControlConfig[];
  customIcons?: CustomIconMap;
  panels?: Partial<Record<PanelId, PanelConfig>>;
  options: {
    volumeStyle: VolumeStyle;
    timeFormat: TimeFormat;
  };
};

export const DEFAULT_DEFAULT_CONFIG: PlayerChromeConfig = {
  controls: [
    { id: "back", slot: "top-left", order: 0 },
    { id: "title-info", slot: "top-left", order: 10 },
    { id: "window-controls", slot: "top-right", order: 100 },
    { id: "time-start", slot: "seek-leading", order: 0 },
    { id: "time-end", slot: "seek-trailing", order: 0 },
    { id: "volume", slot: "bottom-left", order: 0 },
    { id: "dvr", slot: "bottom-left", order: 10 },
    { id: "download", slot: "bottom-left", order: 20 },
    { id: "prev-episode", slot: "bottom-center", order: 0 },
    { id: "seek-back", slot: "bottom-center", order: 10 },
    { id: "play-pause", slot: "bottom-center", order: 20 },
    { id: "seek-forward", slot: "bottom-center", order: 30 },
    { id: "next-episode", slot: "bottom-center", order: 40 },
    { id: "pick-another", slot: "bottom-right", order: 0 },
    { id: "audio-menu", slot: "bottom-right", order: 10 },
    { id: "subtitle-menu", slot: "bottom-right", order: 20 },
    { id: "aspect-menu", slot: "bottom-right", order: 25, hidden: true },
    { id: "anime4k-menu", slot: "bottom-right", order: 27 },
    { id: "hdr-toggle", slot: "bottom-right", order: 28, hidden: true },
    { id: "rtx-hdr-toggle", slot: "bottom-right", order: 29, hidden: true },
    { id: "speed-menu", slot: "bottom-right", order: 30 },
    { id: "draw-toggle", slot: "bottom-right", order: 40 },
    { id: "screenshot", slot: "bottom-right", order: 45, hidden: true },
    { id: "song-id", slot: "bottom-right", order: 46 },
    { id: "pip", slot: "bottom-right", order: 50 },
    { id: "cast", slot: "bottom-right", order: 60 },
    { id: "fullscreen", slot: "bottom-right", order: 70 },
  ],
  options: {
    volumeStyle: "slider",
    timeFormat: "start-end",
  },
};

export const DEFAULT_STREMIO_CONFIG: PlayerChromeConfig = {
  controls: [
    { id: "back", slot: "top-left", order: 0 },
    { id: "title-info", slot: "top-left", order: 10 },
    { id: "fullscreen", slot: "top-right", order: 0 },
    { id: "window-controls", slot: "top-right", order: 100 },
    { id: "play-pause", slot: "bottom-left", order: 0 },
    { id: "volume", slot: "bottom-left", order: 10 },
    { id: "time-start", slot: "bottom-left", order: 20 },
    { id: "time-end", slot: "bottom-left", order: 30 },
    { id: "dvr", slot: "bottom-left", order: 40 },
    { id: "prev-episode", slot: "bottom-center", order: 0 },
    { id: "seek-back", slot: "bottom-center", order: 10 },
    { id: "seek-forward", slot: "bottom-center", order: 20 },
    { id: "next-episode", slot: "bottom-center", order: 30 },
    { id: "speed-menu", slot: "bottom-right", order: 0 },
    { id: "audio-menu", slot: "bottom-right", order: 10 },
    { id: "subtitle-menu", slot: "bottom-right", order: 20 },
    { id: "aspect-menu", slot: "bottom-right", order: 25, hidden: true },
    { id: "anime4k-menu", slot: "bottom-right", order: 27 },
    { id: "hdr-toggle", slot: "bottom-right", order: 28, hidden: true },
    { id: "rtx-hdr-toggle", slot: "bottom-right", order: 29, hidden: true },
    { id: "draw-toggle", slot: "bottom-right", order: 30 },
    { id: "screenshot", slot: "bottom-right", order: 35, hidden: true },
    { id: "song-id", slot: "bottom-right", order: 36 },
    { id: "cast", slot: "bottom-right", order: 40 },
    { id: "pick-another", slot: "bottom-right", order: 50 },
    { id: "pip", slot: "bottom-right", order: 60 },
  ],
  options: {
    volumeStyle: "slider",
    timeFormat: "start-end",
  },
};

export const CONTROL_META: Record<
  PlayerControlId,
  { label: string; group: "transport" | "menus" | "info" | "actions"; defaultSlot: PlayerSlot }
> = {
  back: { label: "Back", group: "actions", defaultSlot: "top-left" },
  "title-info": { label: "Title & info", group: "info", defaultSlot: "top-left" },
  "time-start": { label: "Time elapsed", group: "info", defaultSlot: "seek-leading" },
  "time-end": { label: "Time remaining or duration", group: "info", defaultSlot: "seek-trailing" },
  volume: { label: "Volume", group: "transport", defaultSlot: "bottom-left" },
  dvr: { label: "DVR record (Live TV)", group: "actions", defaultSlot: "bottom-left" },
  download: { label: "Download", group: "actions", defaultSlot: "bottom-left" },
  "prev-episode": { label: "Previous episode", group: "transport", defaultSlot: "bottom-center" },
  "seek-back": { label: "Seek back", group: "transport", defaultSlot: "bottom-center" },
  "play-pause": { label: "Play / Pause", group: "transport", defaultSlot: "bottom-center" },
  "seek-forward": { label: "Seek forward", group: "transport", defaultSlot: "bottom-center" },
  "next-episode": { label: "Next episode", group: "transport", defaultSlot: "bottom-center" },
  "pick-another": {
    label: "Switch stream / TV Guide",
    group: "actions",
    defaultSlot: "bottom-right",
  },
  "audio-menu": { label: "Audio tracks", group: "menus", defaultSlot: "bottom-right" },
  "subtitle-menu": { label: "Subtitles", group: "menus", defaultSlot: "bottom-right" },
  "speed-menu": { label: "Playback speed", group: "menus", defaultSlot: "bottom-right" },
  "aspect-menu": {
    label: "Picture (adjustments & aspect)",
    group: "menus",
    defaultSlot: "bottom-right",
  },
  "anime4k-menu": { label: "Anime4K", group: "menus", defaultSlot: "bottom-right" },
  "hdr-toggle": { label: "HDR to SDR toggle", group: "menus", defaultSlot: "bottom-right" },
  "rtx-hdr-toggle": { label: "RTX Video HDR toggle", group: "menus", defaultSlot: "bottom-right" },
  "draw-toggle": { label: "Draw on video", group: "actions", defaultSlot: "bottom-right" },
  screenshot: { label: "Screenshot", group: "actions", defaultSlot: "bottom-right" },
  "song-id": { label: "Identify song", group: "actions", defaultSlot: "bottom-right" },
  pip: { label: "Picture-in-picture", group: "actions", defaultSlot: "bottom-right" },
  cast: { label: "Cast", group: "actions", defaultSlot: "bottom-right" },
  fullscreen: { label: "Fullscreen", group: "transport", defaultSlot: "bottom-right" },
  "window-controls": {
    label: "Window buttons (minimize, maximize, close)",
    group: "actions",
    defaultSlot: "top-right",
  },
};

export type ThemeId = "default" | "stremio";

function baselineFor(theme: ThemeId): PlayerChromeConfig {
  return theme === "stremio" ? DEFAULT_STREMIO_CONFIG : DEFAULT_DEFAULT_CONFIG;
}

export function readPlayerChromeConfig(theme: ThemeId): PlayerChromeConfig {
  const active = getActiveProfile(theme);
  return active?.config ?? baselineFor(theme);
}

export function writePlayerChromeConfig(theme: ThemeId, config: PlayerChromeConfig): SaveResult {
  const res = updateActiveProfileConfig(theme, config);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export function resetPlayerChromeConfig(theme: ThemeId): PlayerChromeConfig {
  const baseline = baselineFor(theme);
  updateActiveProfileConfig(theme, baseline);
  return baseline;
}

export function controlsInSlot(
  config: PlayerChromeConfig,
  slot: PlayerSlot,
): PlayerControlConfig[] {
  return config.controls
    .filter((c) => c.slot === slot && !c.hidden)
    .slice()
    .sort((a, b) => a.order - b.order);
}

export const PLAYER_CHROME_CHANGED_EVENT = "harbor:player-chrome-changed";

export function notifyPlayerChromeChanged(theme: ThemeId): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PLAYER_CHROME_CHANGED_EVENT, { detail: { theme } }));
}
