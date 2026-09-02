import { FormatBadge, streamBadges, type BadgeSize } from "@/components/format-badge";
import type { MediaServerVersion } from "@/lib/media-server/types";
import { parseStream } from "@/lib/streams/parser";
import { formatBytes } from "@/lib/together/source-descriptor";

export function MediaServerVersionBadges({
  version,
  filename,
  size: badgeSize = "sm",
  showSize = true,
  className = "",
}: {
  version: MediaServerVersion;
  filename: string;
  size?: BadgeSize;
  showSize?: boolean;
  className?: string;
}) {
  const descriptor = [
    filename,
    version.resolution,
    version.videoCodec,
    version.videoProfile,
    version.hdr,
    version.dolbyVisionProfile ? "Dolby Vision" : null,
    version.audioCodec,
    version.audioProfile,
    version.atmos ? "Dolby Atmos" : null,
    version.container,
  ]
    .filter(Boolean)
    .join(" ");
  const parsed = parseStream({
    name: descriptor,
    title: descriptor,
    addonId: "harbor-home-server",
    addonName: "Home server",
    behaviorHints: { filename, videoSize: version.sizeBytes },
  });
  const size = showSize && version.sizeBytes ? formatBytes(version.sizeBytes) : "";
  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {streamBadges(parsed).map((badge) => (
        <FormatBadge key={badge} kind={badge} size={badgeSize} />
      ))}
      {size && (
        <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-ink-muted">
          {size}
        </span>
      )}
    </span>
  );
}
