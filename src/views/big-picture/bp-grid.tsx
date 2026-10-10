// The clamp is multiplied by --bp-up (the non-TV upscale in bp-tokens, default 1)
// so desktop and Steam Deck lay out fewer, larger poster columns while the 607px
// television keeps the authored floor. See bp-art BP_UP / bpBoxCss.
export const BP_POSTER_COLUMNS =
  "repeat(auto-fill, minmax(clamp(122px, 9.8vw, 186px), 1fr))";

// A focused tile scales past its own box and paints a ring outside that, and a
// scroll container cannot reach content before its origin. The headroom is on
// the scroller, cancelled by margin so the columns still meet the gutter.
const HEADROOM = "-mx-[14px] px-[14px] pt-[14px]";

// The hint bar is position:absolute bottom:0 and carries a scrim at 180% of its
// own height, so it sits ON TOP of anything that reaches the bottom edge. Every
// page built on this scroller overflows by more than a screen, and with no
// reserve the last row parks under the bar with the pills across its title.
// Seen on the stick on search, and measured here: library overflowed 3252px and
// collections 1832px, both with padding-bottom 0.
//
// Reserve on the scroller, not by shrinking it from the parent. The scrim exists
// so content can pass under the bar and stay legible; ending the viewport above
// the bar instead would spend 66px of a 641px canvas on permanent dead space.
const HINT_RESERVE = "pb-[var(--bp-hint-h)]";

export function BpGridScroller({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-bp-scroll-y
      className={`relative min-h-0 flex-1 overflow-y-auto ${HEADROOM} ${HINT_RESERVE} [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
    >
      {children}
    </div>
  );
}

export function BpGrid({
  columns,
  gap = "clamp(10px,0.95vw,19px)",
  children,
}: {
  columns: string;
  gap?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-bp-grid
      className="grid pb-6 pt-[14px]"
      style={{ gridTemplateColumns: columns, gap }}
    >
      {children}
    </div>
  );
}
