import { useMemo } from "react";
import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import { mergeBundledAwards } from "@/lib/awards-history";
import type { Meta } from "@/lib/cinemeta";
import { awardSummary, useAwards, type AwardType } from "@/lib/providers/wikidata";
import { parseAwardYear } from "@/lib/anime-awards";
import { useView } from "@/lib/view";

function shortName(type: AwardType): string {
  return AWARD_CATALOG[type]?.shorthand ?? "Award";
}

export function AwardChips({
  meta,
  imdbId,
  limit = 4,
  size = "md",
}: {
  meta: Meta;
  imdbId?: string | null;
  limit?: number;
  size?: "sm" | "md";
}) {
  const isAnime = meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:");
  const live = useAwards(isAnime ? undefined : imdbId ?? undefined, meta.type === "series");
  const { openAward } = useView();
  const chips = useMemo(() => {
    if (isAnime) return [];
    const awards = mergeBundledAwards(live, meta.name, parseAwardYear(meta.releaseInfo));
    return awardSummary(awards)
      .filter((s) => s.wins > 0 || s.nominations > 0)
      .slice(0, limit);
  }, [isAnime, live, meta.name, meta.releaseInfo, limit]);

  if (chips.length === 0) return null;
  const iconPx = size === "sm" ? 13 : 15;
  const pad = size === "sm" ? "h-6 gap-1 px-2 text-[10.5px]" : "h-7 gap-1.5 px-2.5 text-[11.5px]";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c) => {
        const tint = laurelColorFor(c.type);
        const label = c.wins > 0 ? `${shortName(c.type)}${c.wins > 1 ? ` · ${c.wins}` : ""}` : shortName(c.type);
        return (
          <button
            key={c.type}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openAward(c.type);
            }}
            title={
              c.wins > 0
                ? `${c.wins} win${c.wins === 1 ? "" : "s"}${c.nominations > 0 ? `, ${c.nominations} nomination${c.nominations === 1 ? "" : "s"}` : ""}`
                : `${c.nominations} nomination${c.nominations === 1 ? "" : "s"}`
            }
            className={`inline-flex shrink-0 items-center rounded-full border font-semibold transition-colors ${pad} ${
              c.wins > 0
                ? "border-edge-soft bg-elevated/60 text-ink hover:bg-elevated"
                : "border-edge-soft/70 bg-canvas/40 text-ink-muted hover:text-ink"
            }`}
            style={c.wins > 0 ? { color: tint } : undefined}
          >
            <AwardLogo type={c.type as AwardType} size={iconPx} />
            <span className={c.wins > 0 ? "" : "italic"}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
