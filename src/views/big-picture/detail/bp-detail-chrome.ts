// The horizontal track every detail rail uses. The tall top padding and the
// negative bottom margin are what stop the focus-scaled card being clipped by
// the row above and below it.
export const BP_DETAIL_TRACK =
  "flex gap-[var(--bp-detail-gap)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// The same track at the tighter gap stills, posters and gallery tiles want. It
// was written out identically in bp-episode-still, bp-gallery-row and
// search/bp-search-group, which is one literal away from the page-padding class
// of bug: four copies of a number drift, and here two of them already rendered
// visibly tighter than the cast row directly above them.
// Lifted to --bp-detail-gap-tight in bp-tokens (base = clamp(9px,0.85vw,17px)) so
// the non-TV upscale moves the standalone value AND the tight track below in step,
// which keeps BpEpisodeSpacer's manual width calc aligned with the real cells.
export const BP_DETAIL_TRACK_GAP = "var(--bp-detail-gap-tight)";

export const BP_DETAIL_TRACK_TIGHT =
  "flex gap-[var(--bp-detail-gap-tight)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export const BP_DETAIL_HEADING =
  "mb-[clamp(6px,0.8vh,12px)] px-[var(--bp-gutter)] text-[length:var(--bp-detail-heading)] font-bold tracking-[-0.01em] text-ink";

// One darkened surface, one hairline, no second plate. --bp-void sits under the
// canvas so the fill reads as depth over a dark poster while the 15% it lets
// through keeps it from becoming a sticker over a bright one.
//
// NO backdrop-blur, and it is not an oversight. BpEpisodeRating draws this once
// per episode card, so a 24 episode strip was 24 blurred surfaces on a GPU where
// 131 of them measured p50 65ms and reaching ~0 was the only thing that paid.
// bp-cw-card-meta.tsx:309 refused the same thing for the same reason. At 85%
// void there is almost nothing left under it for a blur to soften anyway.
export const BP_METRIC_CHIP =
  "inline-flex items-center gap-[0.42em] rounded-[10px] bg-[var(--bp-void)]/85 ring-1 ring-[var(--bp-edge-2)] px-[0.62em] py-[0.28em] font-bold leading-none tabular-nums text-ink";

export function bpShortDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
