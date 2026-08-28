export type PlaybackStartupProfile = "standard" | "high-bitrate";

type StartupProfileInput = {
  resolution?: string | null;
  quality?: string | null;
  source?: string | null;
  title?: string | null;
  parsedTitle?: string | null;
  size?: number | null;
};

const HIGH_BITRATE_MIN_BYTES = 12 * 1024 * 1024 * 1024;

export function playbackStartupProfile(
  stream: StartupProfileInput | null | undefined,
): PlaybackStartupProfile {
  if (!stream) return "standard";
  if (typeof stream.size === "number" && stream.size >= HIGH_BITRATE_MIN_BYTES) {
    return "high-bitrate";
  }
  const descriptor = [
    stream.resolution,
    stream.quality,
    stream.source,
    stream.parsedTitle,
    stream.title,
  ]
    .filter(Boolean)
    .join(" ");
  return /(?:^|[^a-z0-9])(?:2160p?|4320p?|4k|8k|uhd|remux)(?:[^a-z0-9]|$)/i.test(descriptor)
    ? "high-bitrate"
    : "standard";
}
