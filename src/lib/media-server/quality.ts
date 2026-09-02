import type { MediaServerConnection, MediaServerQuality, MediaServerVersion } from "./types";

export const MEDIA_SERVER_QUALITIES: ReadonlyArray<{
  id: MediaServerQuality;
  label: string;
  maxWidth?: number;
  maxHeight?: number;
  maxBitrateKbps?: number;
}> = [
  { id: "original", label: "Original" },
  { id: "4k-40", label: "4K · 40 Mbps", maxWidth: 3840, maxHeight: 2160, maxBitrateKbps: 40_000 },
  {
    id: "1080p-20",
    label: "1080p · 20 Mbps",
    maxWidth: 1920,
    maxHeight: 1080,
    maxBitrateKbps: 20_000,
  },
  {
    id: "1080p-12",
    label: "1080p · 12 Mbps",
    maxWidth: 1920,
    maxHeight: 1080,
    maxBitrateKbps: 12_000,
  },
  { id: "720p-4", label: "720p · 4 Mbps", maxWidth: 1280, maxHeight: 720, maxBitrateKbps: 4_000 },
  { id: "480p-2", label: "480p · 2 Mbps", maxWidth: 854, maxHeight: 480, maxBitrateKbps: 2_000 },
  { id: "360p-0.7", label: "360p · 0.7 Mbps", maxWidth: 640, maxHeight: 360, maxBitrateKbps: 700 },
];

export function qualityPreset(quality: MediaServerQuality) {
  return MEDIA_SERVER_QUALITIES.find((entry) => entry.id === quality) ?? MEDIA_SERVER_QUALITIES[0];
}

export function connectionQuality(
  connection: Pick<MediaServerConnection, "preferredQuality" | "remoteBitrateKbps">,
): MediaServerQuality {
  if (connection.preferredQuality) return connection.preferredQuality;
  const legacy = connection.remoteBitrateKbps;
  if (!legacy) return "original";
  return (
    [...MEDIA_SERVER_QUALITIES]
      .reverse()
      .find((entry) => entry.maxBitrateKbps != null && legacy <= entry.maxBitrateKbps)?.id ??
    "original"
  );
}

export function versionFitsQuality(
  version: MediaServerVersion,
  quality: MediaServerQuality,
): boolean {
  const preset = qualityPreset(quality);
  if (quality === "original") return true;
  return (
    (version.height == null || version.height <= (preset.maxHeight ?? Infinity)) &&
    (version.bitrateKbps == null || version.bitrateKbps <= (preset.maxBitrateKbps ?? Infinity))
  );
}
