import type { LocalEntry } from "@/lib/local-library";
import { parseLocalEntry } from "@/lib/local-library/versions";
import { formatBytes } from "@/lib/together/source-descriptor";
import { FormatBadge, streamBadges, type BadgeSize } from "@/components/format-badge";

/**
 * The same badge stack addon streams get (source · resolution · codec · HDR ·
 * audio), driven by the parsed filename of a local file, plus its size.
 */
export function LocalVersionBadges({
  entry,
  size = "sm",
  className = "",
}: {
  entry: LocalEntry;
  size?: BadgeSize;
  className?: string;
}) {
  const parsed = parseLocalEntry(entry);
  const badges = streamBadges(parsed);
  const bytes = parsed.size ?? entry.size ?? null;
  const sizeLabel = bytes != null ? formatBytes(bytes) : "";
  if (badges.length === 0 && !sizeLabel) return null;
  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((kind) => (
        <FormatBadge key={kind} kind={kind} size={size} />
      ))}
      {sizeLabel && (
        <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-ink-muted">
          {sizeLabel}
        </span>
      )}
    </span>
  );
}
