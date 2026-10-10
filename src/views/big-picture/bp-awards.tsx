import { useMemo } from "react";
import { AwardLogo } from "@/components/icons/award-logo";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import { mergeBundledAwards } from "@/lib/awards-history";
import { useBundledAwardsVersion } from "@/lib/use-bundled-awards";
import { parseAwardYear } from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";
import { awardSummary, useAwards } from "@/lib/providers/wikidata";

export function BpAwards({ meta, imdbId }: { meta: Meta; imdbId?: string | null }) {
  const isAnime = meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:");
  const live = useAwards(isAnime ? undefined : (imdbId ?? undefined), meta.type === "series");

  const awardsV = useBundledAwardsVersion();
  const chips = useMemo(() => {
    if (isAnime) return [];
    const merged = mergeBundledAwards(live, meta.name, parseAwardYear(meta.releaseInfo));
    return awardSummary(merged)
      .filter((s) => s.wins > 0 || s.nominations > 0)
      .slice(0, 4);
  }, [awardsV, isAnime, live, meta.name, meta.releaseInfo]);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-[clamp(5px,0.5vw,10px)]">
      {chips.map((c) => {
        const short = AWARD_CATALOG[c.type]?.shorthand ?? "Award";
        const label =
          c.wins > 0
            ? `${c.wins} ${short}${c.wins > 1 ? "s" : ""}`
            : `${c.nominations} ${short} nom${c.nominations > 1 ? "s" : ""}`;
        return (
          <span
            key={c.type}
            className={`inline-flex h-[clamp(26px,3.1vh,36px)] shrink-0 items-center gap-1.5 rounded-full border px-[clamp(9px,0.85vw,15px)] text-[clamp(11px,1.5vh,17px)] font-semibold ${
              c.wins > 0
                ? "border-[var(--bp-edge-2)] bg-[var(--bp-glass)] text-ink"
                : "border-[var(--bp-edge)] text-ink-muted"
            }`}
          >
            <AwardLogo type={c.type} size={15} />
            {label}
          </span>
        );
      })}
    </div>
  );
}
