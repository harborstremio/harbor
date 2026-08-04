import { HoverTooltip } from "@/components/hover-tooltip";
import { awardSourceMeta, groupWinsBySource, parseAwardYear } from "@/lib/anime-awards";
import { resolveAwardIcon, useAwardPacks } from "@/lib/award-icons";
import type { Meta } from "@/lib/cinemeta";
import { CollectionBadges } from "@/views/manga/collection-badge";

export function HeroSlideBadges({ meta }: { meta: Meta }) {
  useAwardPacks();
  const groups = groupWinsBySource(meta.name ?? "", parseAwardYear(meta.releaseInfo));

  return (
    <div className="flex items-center gap-3">
      {groups.map((group) => {
        const source = awardSourceMeta(group.source);
        const wins = group.wins.length;
        const customIcon = resolveAwardIcon(group.source);
        const icon = customIcon ?? source.iconSmall;
        const invert = !customIcon && group.source === "animation_kobe";
        const sublabel =
          group.wins
            .slice(0, 3)
            .map((win) => `${win.year} ${win.categoryName}`)
            .join(" · ") || `${wins} ${wins === 1 ? "win" : "wins"}`;

        return (
          <HoverTooltip
            key={group.source}
            label={source.name}
            sublabel={sublabel}
            side="top"
            align="center"
            large
            className="shrink-0"
          >
            <img
              src={icon}
              alt={source.name}
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
