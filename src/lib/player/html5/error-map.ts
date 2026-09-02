import type { PlayerSnapshot } from "../bridge";

export type Html5MediaErrorCode = Exclude<PlayerSnapshot["errorCode"], null>;

export const HTML5_ERROR_SOURCE_KEYS = {
  decode: "Codec not supported in WebView2. Falling back is required, or pick a different stream.",
  codec: "This format isn't playable here. Try a different stream or wait for the mpv backend.",
  network: "Network error while loading the video.",
  source: "Playback failed.",
  unknown: "Playback failed.",
} as const satisfies Record<Html5MediaErrorCode, string>;

export type Html5ErrorSourceKey = (typeof HTML5_ERROR_SOURCE_KEYS)[Html5MediaErrorCode];

export function mapErrorCode(code: number): Html5MediaErrorCode {
  if (code === MediaError.MEDIA_ERR_DECODE) return "decode";
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return "codec";
  if (code === MediaError.MEDIA_ERR_NETWORK) return "network";
  if (code === MediaError.MEDIA_ERR_ABORTED) return "source";
  return "unknown";
}

export function mapErrorSourceKey(code: Html5MediaErrorCode): Html5ErrorSourceKey {
  return HTML5_ERROR_SOURCE_KEYS[code];
}
