import { useMemo } from "react";
import { AWARD_CATALOG } from "@/lib/awards-catalog";
import { mergeBundledAwards } from "@/lib/awards-history";
import { useBundledAwardsVersion } from "@/lib/use-bundled-awards";
import { parseAwardYear } from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";
import { awardSummary, useAwards, type AwardEntry, type AwardType } from "@/lib/providers/wikidata";
import { SFX } from "@/lib/sfx";
import { BpAwardMark } from "../bp-award-mark";
import { useBpT } from "../bp-i18n";
import { BP_DETAIL_HEADING } from "./bp-detail-chrome";

export type BpAwardGroup = {
  type: AwardType;
  entries: AwardEntry[];
  wins: number;
  nominations: number;
};

const NO_GROUPS: BpAwardGroup[] = [];

export function useBpTitleAwards(meta: Meta, imdbId: string | null): BpAwardGroup[] {
  const isAnime = meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:");
  const live = useAwards(isAnime ? undefined : (imdbId ?? undefined), meta.type === "series");

  const awardsV = useBundledAwardsVersion();
  return useMemo(() => {
    if (isAnime) return NO_GROUPS;
    const merged = mergeBundledAwards(live, meta.name, parseAwardYear(meta.releaseInfo));
    if (merged.length === 0) return NO_GROUPS;
    const byType = new Map<AwardType, AwardEntry[]>();
    for (const e of merged) {
      if (e.type === "other") continue;
      const list = byType.get(e.type) ?? [];
      list.push(e);
      byType.set(e.type, list);
    }
    return awardSummary(merged)
      .filter((s) => s.wins > 0 || s.nominations > 0)
      .map((s) => ({
        type: s.type,
        entries: byType.get(s.type) ?? [],
        wins: s.wins,
        nominations: s.nominations,
      }));
  }, [awardsV, isAnime, live, meta.name, meta.releaseInfo]);
}

// Real award photography at real size, never a trophy glyph beside a number.
// BpAwardMark carries all eighteen bodies and the laurel is the only place a
// tint is allowed, because it is the body's own colour and not UI accent.
export function BpAwardsRow({
  groups,
  onOpen,
}: {
  groups: BpAwardGroup[];
  onOpen: (type: AwardType) => void;
}) {
  const t = useBpT();
  if (groups.length === 0) return null;

  return (
    <section
      data-bp-row
      data-bp-row-key="awards"
      className="relative"
      style={{ containIntrinsicSize: "auto 250px" }}
    >
      <h2 className={BP_DETAIL_HEADING}>{t("Awards & Recognition")}</h2>
      <div
        data-bp-scroll-x
        className="flex items-stretch gap-[clamp(12px,1vw,22px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(18px,2.2vh,34px)] pb-[54px] -mb-[34px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((g) => (
          <button
            key={g.type}
            type="button"
            data-bp-focusable
            data-bp-tile
            data-bp-restore-key={`bp-award:${g.type}`}
            onClick={() => {
              SFX.click();
              onOpen(g.type);
            }}
            aria-label={AWARD_CATALOG[g.type]?.title ?? g.type}
            className="flex shrink-0 flex-col items-center gap-[clamp(7px,0.9vh,14px)] rounded-[var(--bp-r-md)] px-[clamp(12px,1vw,20px)] py-[clamp(12px,1.4vh,22px)] text-center"
            style={{ width: "clamp(150px, 12.5vw, 244px)" }}
          >
            <BpAwardMark type={g.type} size="clamp(56px, 7.2vh, 106px)" />
            <span className="line-clamp-2 text-[clamp(11.5px,1.55vh,17.5px)] font-semibold leading-tight text-ink">
              {AWARD_CATALOG[g.type]?.title ?? g.type}
            </span>
            <span className="text-[clamp(10px,1.3vh,14.5px)] font-medium tabular-nums text-ink-subtle">
              {g.wins > 0
                ? t("{n} wins", { n: g.wins })
                : t("{n} nominations", { n: g.nominations })}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
