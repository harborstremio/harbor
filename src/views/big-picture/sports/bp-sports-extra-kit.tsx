import type { CSSProperties, ReactNode } from "react";
import { SFX } from "@/lib/sfx";
import type { SportsGame } from "@/lib/sports/espn-types";
import { BP_DETAIL_HEADING, BP_DETAIL_TRACK } from "../detail/bp-detail-chrome";
import { useBpWatchFixture } from "./bp-sports-broadcast-play";

export const BP_SPORTS_LIFT = { "--bp-focus-lift-wide": "1.012" } as CSSProperties;

export const BP_SPORTS_PANEL =
  "flex w-full shrink-0 flex-col gap-[clamp(7px,0.9vh,14px)] rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] p-[clamp(18px,1.7vw,34px)] text-start";

export const BP_SPORTS_PAIRS =
  "grid w-full gap-x-[clamp(22px,2.4vw,56px)] gap-y-[clamp(9px,1.05vh,17px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,clamp(340px,34vw,700px)),1fr))]";

export const BP_SPORTS_FOOT =
  "pt-[clamp(4px,0.6vh,10px)] text-[calc(clamp(12.5px,1.7vh,19px)*var(--bp-up,1))] font-semibold text-ink-muted";

export const BP_SPORTS_LABEL =
  "text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-bold uppercase tracking-[0.15em] text-ink-subtle";

export const BP_SPORTS_VALUE =
  "text-[calc(clamp(15px,2.06vh,25px)*var(--bp-up,1))] font-semibold leading-snug text-ink";

export const BP_SPORTS_MICRO =
  "text-[calc(clamp(12.5px,1.7vh,19px)*var(--bp-up,1))] font-bold tabular-nums text-ink-subtle";

export const BP_SPORTS_NAME = "text-[calc(clamp(14px,1.95vh,23px)*var(--bp-up,1))] text-ink";

export const BP_SPORTS_CELL =
  "text-[calc(clamp(13.5px,1.85vh,22px)*var(--bp-up,1))] font-semibold tabular-nums";

export const BP_SPORTS_POS =
  "text-[calc(clamp(11.5px,1.58vh,18px)*var(--bp-up,1))] font-semibold text-ink-subtle";

export const BP_SPORTS_NOTE =
  "text-[calc(clamp(11.5px,1.52vh,17px)*var(--bp-up,1))] font-medium leading-relaxed text-ink-subtle";

export const BP_SPORTS_ROWCOL = "w-[clamp(30px,2.8vw,50px)] shrink-0";

export const BP_SPORTS_STATCOL = "min-w-[clamp(38px,4vw,70px)] flex-1 text-end";

export const BP_SPORTS_TIP =
  "text-[calc(clamp(11px,1.45vh,16px)*var(--bp-up,1))] font-semibold uppercase tracking-[0.13em] text-ink-subtle";

export type BpSportsPanelRowProps = {
  rowKey: string;
  reserve: string;
  title: string;
  foot?: ReactNode;
  children: ReactNode;
};

export function BpSportsPanelRow({
  rowKey,
  reserve,
  title,
  foot,
  children,
}: BpSportsPanelRowProps) {
  return (
    <section
      data-bp-row
      data-bp-row-key={rowKey}
      className="relative"
      style={{ containIntrinsicSize: `auto ${reserve}` }}
    >
      <h2 className={BP_DETAIL_HEADING}>{title}</h2>
      <div data-bp-scroll-x className={BP_DETAIL_TRACK}>
        {children}
      </div>
      {foot}
    </section>
  );
}

export type BpSportsPanelCellProps = {
  restoreKey: string;
  width?: string;
  grow?: string;
  shrink?: string;
  foot?: string;
  onPress?: () => void;
  expanded?: boolean;
  padded?: boolean;
  children: ReactNode;
};

export function BpSportsPanelCell({
  restoreKey,
  width,
  grow,
  shrink,
  foot,
  onPress,
  expanded,
  padded = true,
  children,
}: BpSportsPanelCellProps) {
  const shell = padded
    ? BP_SPORTS_PANEL
    : "flex w-full shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] text-start";
  const size: CSSProperties = {};
  if (width) size.width = width;
  if (grow) {
    size.flexGrow = 1;
    size.maxWidth = grow;
  }
  if (shrink) {
    size.flexShrink = 1;
    size.minWidth = shrink;
  }
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-restore-key={restoreKey}
      aria-expanded={expanded}
      style={{ ...BP_SPORTS_LIFT, ...size }}
      onClick={() => {
        if (!onPress) return;
        SFX.click();
        onPress();
      }}
      className={shell}
    >
      {children}
      {foot ? <span className={BP_SPORTS_FOOT}>{foot}</span> : null}
    </button>
  );
}

export function useBpSportsFixture(preferred: SportsGame | null | undefined): SportsGame | null {
  const bus = useBpWatchFixture();
  return preferred ?? bus;
}
