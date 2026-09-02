import { awardSourceMeta, groupWinsBySource, parseAwardYear } from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";
import { BpAwardSourceIcon } from "./bp-award-icon";

// One mark per award body the title won, not one per title. Desktop's
// HeroSlideBadges draws the same set; the hover tooltip has no 10-foot analogue.
export function BpHeroAwardMarks({ meta }: { meta: Meta }) {
  const groups = groupWinsBySource(meta.name ?? "", parseAwardYear(meta.releaseInfo), meta.id);
  if (groups.length === 0) return null;
  return (
    // A bare row of logos says a prize exists without saying which one, so each
    // mark carries its own year and category. No ms-auto: the caller stacks
    // these above the manga card, and a second ms-auto in that row was what
    // left them floating in the middle of it.
    <span className="pointer-events-none flex shrink-0 flex-wrap items-center justify-end gap-x-[clamp(10px,0.9vw,18px)] gap-y-[3px]">
      {groups.map((g) => (
        <span key={g.source} className="flex items-center gap-[clamp(5px,0.45vw,9px)]">
          <BpAwardSourceIcon
            source={g.source}
            title={`${awardSourceMeta(g.source).name} · ${g.wins[0].year} ${g.wins[0].categoryName}`}
            className="h-[clamp(17px,2.1vh,28px)] w-auto max-w-[clamp(26px,3vw,44px)] drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]"
          />
          <span className="whitespace-nowrap text-[clamp(9px,1.15vh,13.5px)] font-bold uppercase tracking-[0.12em] text-ink-subtle">
            {`${g.wins[0].year} ${g.wins[0].categoryName}`}
          </span>
        </span>
      ))}
    </span>
  );
}
