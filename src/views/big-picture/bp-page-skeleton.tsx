import type { CSSProperties } from "react";
import { BP_TILE_BOX, bpBoxCss } from "./bp-art";
import { BpRowHeader } from "./bp-row-header";

// The boot state, shared by home, shows and movies, which each spelled their own
// and drifted.
//
// PLATES. This started as twenty seven animate-pulse blocks breathing in unison,
// which is twenty seven group opacities strictly between 0 and 1, so twenty
// seven live offscreen passes against a cliff that saturates at eight.
//
// SHAPE MATCHED, which is the other half. The hero box is deliberately the
// COLLAPSED clamp and not the expanded one: BpSpotlight's own no-copy branch
// renders clamp(374px, 58.3vh, 560px), so that is the state this actually hands
// over to, and matching the expanded height would introduce the reflow it was
// meant to remove. The poster cells are the real BP_TILE_BOX poster clamp and
// the real track padding, so the swap does not move anything sideways either.
const PLATE = "bg-[var(--bp-panel)]";

const HERO = "h-[clamp(374px,58.3vh,560px)]";

const HEAD = "mb-[clamp(4px,0.5vh,10px)] flex min-h-[24px] items-center px-[var(--bp-gutter)]";

const TITLE_BAR = `h-[clamp(19px,2.6vh,32px)] w-[min(17vw,260px)] rounded-full ${PLATE}`;

const TRACK =
  "flex gap-[clamp(21px,1.9vw,32px)] px-[var(--bp-gutter)] pt-[clamp(12px,1.5vh,24px)] pb-[22px]";

const CELL = `shrink-0 overflow-hidden rounded-sm ${PLATE}`;

const STAGGER = 90;

const ROWS = [0, 1, 2];

export function BpSkeletonRow({
  title,
  wide,
  index = 0,
}: {
  title?: string;
  wide?: boolean;
  index?: number;
}) {
  const box = BP_TILE_BOX[wide ? "wide" : "poster"];
  return (
    <section
      data-bp-row
      className="relative"
      style={{ "--bp-plate-delay": `${index * STAGGER}ms` } as CSSProperties}
    >
      {title ? (
        <BpRowHeader title={title} />
      ) : (
        <div aria-hidden className={HEAD}>
          <div data-bp-plate className={TITLE_BAR} />
        </div>
      )}
      <div aria-hidden className={TRACK}>
        {Array.from({ length: wide ? 5 : 8 }).map((_, c) => (
          <div
            key={c}
            data-bp-plate
            className={CELL}
            style={{ width: bpBoxCss(box), aspectRatio: wide ? "16 / 9" : "2 / 3" }}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * @param topClass the page's own top padding, so the skeleton clears the bar by
 * exactly what the real page does. Every caller now resolves to
 * var(--bp-page-top): the parallel clamp that shows, movies and service used to
 * carry is gone, and bp-rail records why it was a bug rather than a variant.
 */
export function BpPageSkeleton({ topClass }: { topClass: string }) {
  return (
    <div aria-hidden className={`flex h-full flex-col ${topClass}`}>
      {/* Empty on purpose. The hero has nothing to say yet, and BpAmbient is
          mounted outside main so the wash is already painting behind this. A
          grey bar here would cover the one thing on screen that is real. */}
      <div className={HERO} />
      <div className="mt-[clamp(20px,3vh,44px)] flex flex-col gap-[var(--bp-row-gap)]">
        {ROWS.map((r) => (
          <BpSkeletonRow key={r} index={r} />
        ))}
      </div>
    </div>
  );
}
