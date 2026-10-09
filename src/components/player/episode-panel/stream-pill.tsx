import { FormatBadge, RuleBadges, streamBadges } from "@/components/format-badge";
import type { ScoredStream } from "@/lib/streams/types";
import { useT } from "@/lib/i18n";

export function StreamPill({
  stream,
  cached,
  onPick,
}: {
  stream: ScoredStream;
  cached: boolean;
  onPick: () => void;
}) {
  const t = useT();
  void cached;
  const headline = stream.name?.trim() || stream.parsedTitle || stream.title || stream.addonName || t("Source");
  const description = stream.title?.trim() || stream.description?.trim() || "";
  const badges = streamBadges(stream);
  return (
    <button
      onClick={onPick}
      className="group flex w-full items-start gap-3 rounded-xl bg-elevated/40 px-3 py-2.5 text-start ring-1 ring-edge-soft/40 transition-colors hover:bg-raised hover:ring-edge"
    >
      <div className="flex flex-1 flex-col gap-1.5 min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {badges.slice(0, 3).map((k) => (
            <FormatBadge key={k} kind={k} size="sm" />
          ))}
          <RuleBadges stream={stream} size="sm" />
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug text-ink">
            {headline}
          </p>
        </div>
        {description && (
          <p className="whitespace-pre-line text-[12px] leading-snug text-ink-muted">
            {description}
          </p>
        )}
      </div>
    </button>
  );
}
