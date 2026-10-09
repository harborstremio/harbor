import { awardSourceMeta, groupWinsBySource, parseAwardYear } from "@/lib/anime-awards";
import { resolveAwardIcon, useAwardPacks } from "@/lib/award-icons";
import type { Meta } from "@/lib/cinemeta";
import { HoverTooltip } from "@/components/hover-tooltip";
import { CollectionBadges } from "@/views/manga/collection-badge";

export function HeroSlideBadges({ meta }: { meta: Meta }) {
  useAwardPacks();
  const groups = groupWinsBySource(meta.name ?? "", parseAwardYear(meta.releaseInfo), meta.id);
  return (
    <div className="flex items-center gap-3">
      {groups.map((g) => {
        const src = awardSourceMeta(g.source);
        const wins = g.wins.length;
        const custom = resolveAwardIcon(g.source);
        const icon = custom ?? src.iconSmall;
        const invert = !custom && g.source === "animation_kobe";
        const sub =
          g.wins
            .slice(0, 3)
            .map((w) => `${w.year} ${w.categoryName}`)
            .join(" · ") || `${wins} ${wins === 1 ? "win" : "wins"}`;
        return (
          <HoverTooltip
            key={g.source}
            label={src.name}
            sublabel={sub}
            side="top"
            align="center"
            large
            className="shrink-0"
          >
            <img
              src={icon}
              alt={src.name}
              draggable={false}
              className={`h-[26px] w-auto max-w-[40px] object-contain drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)] ${
                invert ? "brightness-0 invert" : ""
              }`}
            />
          </HoverTooltip>
        );
      })}
      <CollectionBadges title={meta.name} size={30} side="top" />
    </div>
  );
}
