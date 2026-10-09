import { SFX } from "@/lib/sfx";
import type { PickerItem } from "@/views/detail/series-episodes/season-arc-picker";
import { useBpT } from "./bp-i18n";

function yearOf(value: string | undefined): string {
  return value && value.length >= 4 ? value.slice(0, 4) : "";
}

// The panel gives a season an airDate year plus the first and last airdate of
// its episodes, so a two cour run reads as its real span instead of one year.
export function seasonYears(item: PickerItem): string {
  const from = yearOf(item.from) || yearOf(item.year);
  const to = yearOf(item.to);
  if (!from) return to;
  return to && to !== from ? `${from}-${to}` : from;
}

/**
 * Same pill vocabulary as BpChip, one line taller. A season carries a name and a
 * run of years, and squeezing both into BpChip's single truncating line is what
 * turns a season rail into a row of identical dark rectangles.
 *
 * item.badge (OVA / Movie / Special) only arrives once a caller feeds the panel
 * a franchise pool, which Big Picture does not fetch yet. It is rendered so the
 * chip is already right on the day it does.
 */
export function BpAnimeSeasonChip({
  item,
  selected,
  onSelect,
}: {
  item: PickerItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useBpT();
  const years = seasonYears(item);
  const meta = [years, item.count > 0 ? t("{n} episodes", { n: item.count }) : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-restore-key={`bp-anime-season:${item.key}`}
      aria-pressed={selected}
      onClick={() => {
        SFX.click();
        onSelect();
      }}
      className={`group flex min-h-[clamp(56px,7vh,72px)] shrink-0 flex-col justify-center gap-[2px] rounded-[calc(var(--bp-r-lg)_+_4px)] px-[clamp(14px,1.2vw,22px)] py-[clamp(6px,0.7vh,10px)] text-start transition-colors duration-[var(--bp-dur-fast)] ${
        selected
          ? "border border-transparent bg-[color-mix(in_oklab,var(--bp-void)_72%,transparent)] text-ink"
          : "border border-[var(--bp-edge)] text-ink-subtle"
      }`}
    >
      <span className="flex items-center gap-[clamp(5px,0.45vw,9px)]">
        <span className="max-w-[clamp(220px,24vw,420px)] truncate text-[clamp(18px,2.5vh,24px)] font-semibold">
          {item.name}
        </span>
        {item.badge && (
          <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--bp-void)_45%,transparent)] px-[9px] py-[2px] text-[clamp(14px,1.9vh,18px)] font-bold uppercase tracking-[0.12em] group-data-[bp-focus=true]:bg-[var(--bp-void)]/25">
            {item.badge}
          </span>
        )}
      </span>
      {meta && (
        <span className="text-[clamp(15px,2.1vh,20px)] font-medium tabular-nums text-ink-muted group-data-[bp-focus=true]:text-[var(--color-canvas)]">
          {meta}
        </span>
      )}
    </button>
  );
}
