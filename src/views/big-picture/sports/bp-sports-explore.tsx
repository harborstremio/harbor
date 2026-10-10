import { SFX } from "@/lib/sfx";
import { getGroupLabel } from "@/lib/sports/espn";
import { HUB_GROUPS } from "@/lib/sports/hub-data";
import { SportIcon } from "@/views/sports/sport-icon";
import { BpGrid, BpGridScroller } from "../bp-grid";

const COLUMNS = "repeat(auto-fill, minmax(clamp(138px, 11.5vw, 232px), 1fr))";

const CELL =
  "group relative flex aspect-[5/4] flex-col items-center justify-center gap-[clamp(7px,1vh,16px)] overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] px-[clamp(8px,0.8vw,16px)] text-center transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none data-[bp-focus=true]:border-transparent data-[bp-focus=true]:bg-[var(--bp-focus-face)]";

const MARK =
  "h-[clamp(40px,4.6vw,82px)] w-[clamp(40px,4.6vw,82px)] text-ink-subtle transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none group-data-[bp-focus=true]:text-ink";

const LABEL =
  "line-clamp-2 text-[calc(clamp(12px,1.7vh,20px)*var(--bp-up,1))] font-bold leading-[1.2] text-ink-muted transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none group-data-[bp-focus=true]:text-ink";

export function BpSportsExplore({
  onSport,
  onFocusGroup,
}: {
  onSport: (group: string) => void;
  onFocusGroup?: (group: string) => void;
}) {
  const groups = [...new Map(HUB_GROUPS.map((g) => [g.key, g])).values()];

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col px-[var(--bp-gutter)]">
      <BpGridScroller>
        <BpGrid columns={COLUMNS}>
          {groups.map((group, i) => (
            <button
              key={group.key}
              type="button"
              data-bp-focusable
              data-bp-tile
              data-bp-autofocus={i === 0 ? "true" : undefined}
              data-bp-restore-key={`bp-sports-group:${group.key}`}
              onFocus={() => onFocusGroup?.(group.key)}
              onClick={() => {
                SFX.click();
                onSport(group.key);
              }}
              className={CELL}
            >
              <SportIcon name={group.key} className={MARK} />
              <span className={LABEL}>{getGroupLabel(group)}</span>
            </button>
          ))}
        </BpGrid>
      </BpGridScroller>
    </div>
  );
}
