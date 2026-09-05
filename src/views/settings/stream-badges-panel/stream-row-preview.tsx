import { useMemo } from "react";
import { Play } from "@/components/icons/play-filled";
import {
  FormatBadge,
  RuleBadgeChip,
  streamBadges,
  type BadgeKind,
} from "@/components/format-badge";
import { useMatchedRules } from "@/lib/stream-badges";
import { parseStream } from "@/lib/streams/parser/parser-stream";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";

export const SAMPLE_TITLE = "Movie.2026.2160p.WEB-DL.DV.Atmos.x265-GROUP";

const SAMPLE_LINE = "4.31 GB · 128 seeders · Torrentio";

export function StreamRowPreview({
  sample = SAMPLE_TITLE,
  headline,
  detail,
  caption,
}: {
  sample?: string;
  headline?: string;
  detail?: string;
  caption?: string;
}) {
  const t = useT();
  const { settings } = useSettings();
  const matched = useMatchedRules(sample);
  const kinds = useMemo(() => {
    if (!settings.showQualityBadge) return [] as BadgeKind[];
    try {
      return streamBadges(
        parseStream({ name: sample, title: sample, addonId: "preview", addonName: "preview" }),
      );
    } catch {
      return [] as BadgeKind[];
    }
  }, [sample, settings.showQualityBadge]);

  const empty = kinds.length === 0 && matched.length === 0;

  return (
    <div
      data-tv-skip
      className="flex flex-col gap-3 rounded-md border border-edge-soft bg-canvas/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="harbor-settings-label">{t("Live preview")}</span>
        <span className="text-[15.5px] leading-[22px] text-ink-subtle">
          {t("A stream row in the play picker")}
        </span>
      </div>

      <div className="flex items-stretch gap-4 rounded-[14px] bg-elevated/50 p-4 ring-1 ring-edge-soft/60">
        <span className="grid h-12 w-12 shrink-0 place-items-center self-center rounded-[10px] bg-raised text-[16.5px] font-semibold text-ink-subtle">
          T
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <p className="truncate text-[16.5px] font-semibold leading-[24px] text-ink">
            {headline ?? t("Torrentio 4K")}
          </p>
          <p
            className={`truncate text-[15.5px] leading-[22px] text-ink-muted ${
              detail ? "font-mono" : ""
            }`}
          >
            {detail ?? SAMPLE_LINE}
          </p>
          <div className="flex min-h-[26px] flex-wrap items-center gap-1.5">
            {empty ? (
              <span className="text-[15.5px] leading-[22px] text-ink-subtle">
                {settings.showQualityBadge
                  ? t("Nothing in this title to badge.")
                  : t("Chips are off, so the row stays bare.")}
              </span>
            ) : (
              <>
                {kinds.map((k) => (
                  <FormatBadge key={k} kind={k} size="sm" />
                ))}
                {matched.map((r) => (
                  <RuleBadgeChip key={r.id} rule={r} size="sm" />
                ))}
              </>
            )}
          </div>
        </div>
        <span className="grid h-12 w-12 shrink-0 place-items-center self-center rounded-full bg-accent text-canvas">
          <Play size={16} />
        </span>
      </div>

      {caption && (
        <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">{caption}</p>
      )}
    </div>
  );
}
