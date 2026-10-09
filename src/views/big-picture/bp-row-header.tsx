import { ChevronRight } from "lucide-react";
import { goBigPictureTab, type BigPictureTabKind } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";

/**
 * What a row says about itself, and where it goes.
 *
 * This replaced BpRowLabel, which described a focusable CARD rendered as the
 * first cell of the track. Every destination that card ever had was already a
 * top bar tab, and Home stamped one on up to fifty eight rows whose action was
 * one of exactly two strings, so it was a per-row reprint of the global nav
 * costing a full poster of first-screen content each time.
 *
 * `tab` is the whole mechanism now: the row declares which tab it belongs to,
 * the nav honours it, Left at the start of the row lands the ring on that exact
 * tab, and Right at the end of the row lands it on the see-all below, which
 * opens the same place.
 */
export type BpRowLead = {
  rowKey: string;
  title: string;
  /**
   * Human name of the destination, already translated. This is the see-all
   * label now, so it reads as the place it opens ("All movies") rather than as
   * an instruction. Omit for a row with no escape.
   */
  action?: string;
  tab?: BigPictureTabKind;
  /**
   * Where the see-all goes when the destination is not a tab.
   *
   * A catalog page cannot use `tab`: the tab a movies row belongs to IS Movies,
   * so on Movies itself the press would reload the page it was pressed from,
   * and bp-addon-row records why a focus stop that answers with itself is worse
   * than a dead end. Those rows open their own feed as a full grid instead.
   * `tab` still drives the Left escape, so it may be set alongside this.
   */
  open?: () => void;
};

// Raised off clamp(14px, 2.05vh, 26px). On the 641px television canvas 2.05vh is
// 13.1px, so that clamp shipped on its 14px floor: only 1.07x its own vh term
// where bp-tokens records the measured norm for fonts as 1.21x. The row heading
// was therefore undersized against every neighbour by the file's own rule, and
// it has just inherited the job of naming the row from a tile that set its title
// at clamp(15px, 2.15vh, 28px). NEEDS AN EYE at 1140x641: this is an apparent
// size across a room, so push it live and go bigger or smaller rather than
// deriving it again.
//
// leading-[1.25] is load bearing, not typographic taste. Nothing sets a
// line-height in this tree, so the heading inherited Tailwind's preflight 1.5
// and a 19px title drew a 28.5px line box: 9.5px of leading on a row band that
// has 641px to spend. 1.25 is the tightest value that is still safe with
// truncate, because truncate is overflow:hidden and Switzer's content area is
// about 1.25em, so anything below this clips the descender off a "y".
// Exported so a surface that cannot use BpRowHeader still renders its heading at
// the house scale. bp-anime-row spelled its own and shipped five pixels smaller
// than the identical heading on Home.
// The clamp is lifted to --bp-row-title in bp-tokens (base = clamp(19px,2.6vh,32px))
// so the non-TV upscale can raise every row heading from one place while the
// television keeps the floor this comment records.
export const BP_ROW_TITLE =
  "min-w-0 truncate text-[length:var(--bp-row-title)] font-bold leading-[1.25] tracking-[-0.015em] text-[color-mix(in_oklab,var(--color-ink)_55%,transparent)] transition-colors duration-[var(--bp-focus-fade)] ease-[var(--bp-ease)] [[data-bp-row-focus]_&]:text-ink motion-reduce:transition-none";

// Focusable, and reachable by exactly one press: Right at the last cell of the
// row. The comment this replaces refused that, and its reasoning still holds
// for the route it was refusing. A horizontal move is scoped by bpTrackScope to
// the closest [data-bp-scroll-x], which is the track, so making this reachable
// GEOMETRICALLY would mean either stripping data-bp-scroll-x from the track,
// which kills centerScroll's one-cell-per-press paging, or teaching the scope to
// escape upward, which re-widens the candidate pool that use-bp-focus keeps
// narrow on purpose (271 focusables, 16ms settled, 1577ms over an unlaid-out
// subtree). Neither happened. bp-row-see-all.ts is an explicit hop the nav takes
// only once a Right has already dead-ended inside the track, so the scope and
// the pool are exactly what they were.
//
// Two things keep it off every other path, and both are load bearing.
//
// It sits OUTSIDE [data-bp-scroll-x]. That is what stops Left and Right walking
// onto it mid-row, and it is also what stops the ring landing here from paging
// a CHUNK in: centerScroll finds no track to glide, so bp-row's scroll listener
// never fires. bp-row records the same trap from its own side.
//
// It is visibility:hidden until its row holds the ring, not merely opacity 0.
// measureFocusables tests visibility and deliberately does NOT test opacity, so
// an opacity-only reveal would have put one of these in every pool on the page:
// twenty five extra rects per measure, a seed pass that can park the ring on a
// heading, and a live row advertising itself as reachable while it is still a
// strip of skeletons. Hidden means bpRailStep cannot see it at all, which is
// what keeps "a row of placeholders is not something a remote can act on" true.
// The chicken and egg is deliberate: a row only holds the ring because a cell in
// it does, so the link is always already visible by the time anything focuses
// it.
//
// Revealed only while the row holds the ring, for the same reason as before: a
// legend on all sixty rows at once is the same uniformity tell as the tile it
// replaces. Keyed off the data-bp-row-focus attribute applyBpFocus already
// writes to the row, never off :has(): Chromium re-checks a :has() against every
// candidate subtree whenever the tested attribute changes anywhere, which is the
// recalc storm bp-tokens records.
//
// The negative margin is the house pattern, not a fudge, and removing it undoes
// the band work the margin comment below records. 44px is the minimum focus
// target, but a 44px flex item would drive the whole header band and cost every
// one of the rows about twenty vertical pixels. -my pulls the MARGIN box back to
// the title's own line box while the border box, which is what the eye and the
// ring see, stays 44. Same trick as the track's pb-[60px] -mb-[38px].
//
// data-bp-chip is the top bar's own focus treatment, an accent fill rather than
// a ring. That is the right one here: this is the same destination the tab strip
// holds, and at 44px it is the same height as the tab it leads to.
const SEE_ALL =
  "invisible -my-[10px] flex min-h-[44px] shrink-0 items-center gap-[clamp(3px,0.3vw,6px)] rounded-[var(--bp-r-xs)] px-[clamp(11px,1vw,20px)] text-[clamp(15px,1.9vh,22px)] font-semibold text-ink-muted opacity-0 transition-[opacity,visibility,background-color,color] duration-[var(--bp-dur-fast)] ease-[var(--bp-ease)] [[data-bp-row-focus]_&]:visible [[data-bp-row-focus]_&]:opacity-100 motion-reduce:transition-none";

// The restore key is lead-namespaced so bpRailStep's first-card fallback steps
// over it if the visibility gate above is ever loosened. It is never written to
// the position memory: use-bp-focus refuses to remember a see-all, because a way
// out of a row is not a position in it.
function BpRowSeeAll({
  rowKey,
  title,
  action,
  tab,
  open,
}: {
  rowKey: string;
  title: string;
  action: string;
  tab?: BigPictureTabKind;
  open?: () => void;
}) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-chip
      data-bp-row-see-all
      data-bp-restore-key={`bp-lead:see-all:${rowKey}`}
      onClick={() => {
        SFX.click();
        if (open) {
          open();
          return;
        }
        if (tab) goBigPictureTab(tab);
      }}
      aria-label={`${title}, ${action}`}
      className={SEE_ALL}
    >
      <span className="truncate">{action}</span>
      <ChevronRight className="dir-icon shrink-0" size={17} strokeWidth={2.4} />
    </button>
  );
}

export function BpRowHeader({ title, lead }: { title: string; lead?: BpRowLead }) {
  return (
    // items-center, not items-baseline. The see-all is a flex row whose last
    // item is an svg with no baseline of its own, so baseline alignment against
    // a much larger title resolves inconsistently.
    //
    // The margin is small on purpose and must stay small. The track below already
    // pays clamp(22px,2.6vh,40px) of top padding, and that padding is not a gap,
    // it is the reserve the focus lift grows up into (198px poster at 1.06 plus a
    // 6px ring is 17.9px of the 22). So this margin and that padding are the same
    // band read twice: at the old clamp(10px,1.3vh,18px) the heading sat 32px off
    // the posters unfocused and the row cost 38.5px of a 641px panel for a 19px
    // word. 4px here leaves 8px between the heading and a grown card's ring.
    <div className="mb-[clamp(4px,0.5vh,10px)] flex items-center justify-between gap-[clamp(10px,1vw,20px)] px-[var(--bp-gutter)]">
      <h2 className={BP_ROW_TITLE}>{title}</h2>
      {/* A label AND somewhere to go, never one. A label with no destination
          would be a focus stop that does nothing on Enter, which is the exact
          failure the addon lead tile was. */}
      {lead?.action && (lead.open || lead.tab) && (
        <BpRowSeeAll
          rowKey={lead.rowKey}
          title={title}
          action={lead.action}
          tab={lead.tab}
          open={lead.open}
        />
      )}
    </div>
  );
}
