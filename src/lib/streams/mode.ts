import { isP2pStream } from "./cached";

export type StreamMode = "both" | "addons" | "p2p";

type StreamProxyHeaders = {
  request?: Record<string, string> | null;
  response?: Record<string, string> | null;
};

type StreamModeCandidate = {
  infoHash?: string | null;
  url?: string | null;
  externalUrl?: string | null;
  ytId?: string | null;
  nzbUrl?: string | null;
  cached?: Partial<Record<string, boolean>>;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  behaviorHints?: {
    filename?: string | null;
    fileName?: string | null;
    videoSize?: number | null;
    notWebReady?: boolean | null;
    proxyHeaders?: StreamProxyHeaders | null;
    headers?: Record<string, string> | null;
  } | null;
};

const VIDEO_FILE_EXTENSION_RX =
  /\.(?:mkv|mp4|avi|mov|m4v|webm|ts|m3u8|mpd|flv|wmv|m2ts|mpg|mpeg|ogv|3gp)(?:[?#]|$)/i;
const HTTP_URL_RX = /^(?:https?:)?\/\//i;

export function hasVideoFileExtension(value: string | null | undefined): boolean {
  return VIDEO_FILE_EXTENSION_RX.test(value?.trim() ?? "");
}

function hasProxyHeaders(value: StreamProxyHeaders | null | undefined): boolean {
  if (!value) return false;
  return (
    Object.keys(value.request ?? {}).length > 0 || Object.keys(value.response ?? {}).length > 0
  );
}

/**
 * Returns whether a non-P2P result carries enough evidence to be treated as an
 * internally playable stream. Plain web links are intentionally inconclusive:
 * addons sometimes place external watch pages in `url` instead of `externalUrl`.
 */
export function hasDirectMediaEvidence(stream: StreamModeCandidate): boolean {
  const hints = stream.behaviorHints;
  const url = stream.url?.trim() ?? "";
  const filename = hints?.filename ?? hints?.fileName;

  if (hasVideoFileExtension(url) || hasVideoFileExtension(filename)) return true;
  if (
    typeof hints?.videoSize === "number" &&
    Number.isFinite(hints.videoSize) &&
    hints.videoSize > 0
  ) {
    return true;
  }
  if (
    hints?.notWebReady === true ||
    hasProxyHeaders(hints?.proxyHeaders) ||
    Object.keys(hints?.headers ?? {}).length > 0
  ) {
    return true;
  }
  if (url && url !== "#" && !HTTP_URL_RX.test(url)) return true;

  return Boolean(stream.infoHash && !isP2pStream(stream));
}

/**
 * Applies the user's transport preference without letting external/watch-page
 * results hide valid torrents. When a preferred transport is unavailable, all
 * results remain visible so the picker never becomes artificially empty.
 */
export function filterStreamsByMode<T extends StreamModeCandidate>(
  streams: readonly T[],
  mode: StreamMode | string | null | undefined,
): T[] {
  if (mode === "p2p") {
    const p2p = streams.filter((stream) => isP2pStream(stream));
    return p2p.length > 0 ? p2p : [...streams];
  }

  // Backups can be hand-edited and older/future builds may persist a value
  // this build does not understand. Unknown values must use the safest default
  // rather than accidentally falling through to the restrictive mode.
  if (mode !== "addons") return [...streams];

  const nonP2p = streams.filter((stream) => !isP2pStream(stream));
  return nonP2p.some(hasDirectMediaEvidence) ? nonP2p : [...streams];
}
