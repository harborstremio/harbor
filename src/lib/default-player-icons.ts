import type { CustomIconMap } from "./player-chrome";

const B = "/player-icons/";

export const DEFAULT_PLAYER_ICONS: CustomIconMap = {
  back: B + "back.svg",
  "seek-back": B + "seek-back.svg",
  "seek-forward": B + "seek-forward.svg",
  "prev-episode": B + "prev-episode.svg",
  "next-episode": B + "next-episode.svg",
  "pick-another": B + "pick-another.svg",

  // The files are named for the glyph they draw, the keys for the player state,
  // and those are opposites: while the player IS playing the button must offer
  // pause. Reading the key as "this is the play icon" is what swapped them.
  "play-pause:playing": B + "play-pause--paused.svg",
  "play-pause:paused": B + "play-pause--playing.svg",
  "play-pause": B + "play-pause--playing.svg",

  "fullscreen:windowed": B + "fullscreen--fullscreen.svg",
  "fullscreen:fullscreen": B + "fullscreen--windowed.svg",
  fullscreen: B + "fullscreen--fullscreen.svg",

  "draw-toggle:active": B + "draw-toggle--active.svg",
  "draw-toggle:inactive": B + "draw-toggle--inactive.svg",
  "draw-toggle": B + "draw-toggle--inactive.svg",

  "cast:connected": B + "cast--connected.svg",
  "cast:idle": B + "cast--idle.svg",
  cast: B + "cast--idle.svg",

  "dvr:recording": B + "dvr--recording.svg",
  "dvr:idle": B + "dvr--idle.svg",
  dvr: B + "dvr--idle.svg",

  "pip:inactive": B + "pip--active.svg",
  pip: B + "pip--active.svg",
  "pip:active": B + "pip--inactive.svg",

  "download:idle": B + "download--idle.svg",
  "download:downloading": B + "download--downloading.svg",
  "download:complete": B + "download--complete.svg",
  "download:error": B + "download--error.svg",
  download: B + "download--idle.svg",

  "audio-menu": B + "audio.svg",
  "subtitle-menu": B + "subtitle.svg",
  "speed-menu": B + "speed.svg",
  "aspect-menu": B + "aspect.svg",
  "anime4k-menu": B + "anime4k.svg",
  "shader-menu": B + "shader.svg",
  "rtx-hdr-toggle": B + "rtx-hdr.svg",
  "rtx-vsr-toggle": B + "rtx-vsr.svg",
  screenshot: B + "screenshot.svg",
  "song-id": B + "song-id.svg",
  volume: B + "volume.svg",
  "volume:muted": B + "volume--mute.svg",
};
