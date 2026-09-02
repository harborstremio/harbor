import { Popcorn } from "lucide-react";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { MalLogo } from "@/components/icons/mal-logo";
import { RtBadge } from "@/components/rt-badge";
import letterboxdLogo from "@/assets/addon-logos/letterboxd.png";
import mdblistLogo from "@/assets/addon-logos/mdblist.png";
import tmdbLogo from "@/assets/addon-logos/tmdb.png";
import simklLogo from "@/assets/simkl.png";
import traktLogo from "@/assets/trakt.svg";
import type { BpCardBadge } from "./use-bp-card-badges";
import type { BpTileShape } from "./bp-tile";

// A score is neither actionable nor live, so it never takes --bp-touch or
// --bp-live. It earns attention from the darkened surface, the real provider
// mark and where it sits. Every mark sizes in em: a mark pinned to 11px like
// desktop's vanishes the moment the type scales up on a 4K panel.
const CHIP =
  "inline-flex shrink-0 items-center gap-[0.42em] rounded-md bg-[var(--bp-void)]/92 px-[0.62em] py-[0.28em] text-[clamp(9px,1.16vh,14px)] font-bold leading-none tabular-nums text-ink ring-1 ring-[var(--bp-edge-2)]";

const MARK = "h-[1.35em] w-auto max-w-[2.4em] shrink-0 object-contain";

// Desktop's cardBadgeLimit of 3 was chosen for a 12px chip. A poster tile here
// is clamp(132px, 10.6vw, 210px) wide and these chips are roughly three times
// the physical size, so three of them crush or wrap. Shrinking the type to fit
// more is the grey-smear failure state, so the count comes down instead.
export function bpScoreLimit(limit: number, shape: BpTileShape): number {
  return Math.max(1, Math.min(limit, shape === "wide" ? 3 : 2));
}

function markFor(badge: BpCardBadge, size: string) {
  switch (badge.kind) {
    case "rating":
      if (badge.source === "mal") return <MalLogo className={`${size} text-ink`} />;
      if (badge.source === "tmdb") return <img src={tmdbLogo} alt="" className={size} />;
      return <ImdbIcon className={`${size} rounded-[0.16em]`} />;
    case "rt":
      return <RtBadge score={badge.value} className={size} />;
    case "audience":
      return <Popcorn size="1.25em" strokeWidth={2.4} className="shrink-0 text-ink" />;
    case "metacritic":
      // No Metacritic mark ships with Harbor, and desktop's red/amber/green
      // tone would be a third and fourth saturated colour on this surface.
      return <span className="shrink-0 text-[0.78em] tracking-[0.04em] text-ink-muted">MC</span>;
    case "letterboxd":
      return <img src={letterboxdLogo} alt="" className={`${size} rounded-[0.16em]`} />;
    case "mdblist":
      return <img src={mdblistLogo} alt="" className={`${size} rounded-[0.16em]`} />;
    case "trakt":
      return <img src={traktLogo} alt="" className={size} />;
    case "simkl":
      return <img src={simklLogo} alt="" className={`${size} rounded-[0.16em]`} />;
  }
}

function valueFor(badge: BpCardBadge): string {
  switch (badge.kind) {
    case "rating":
      return badge.value;
    case "rt":
    case "audience":
    case "trakt":
      return `${Math.round(badge.value)}%`;
    case "letterboxd":
      return (badge.value / 2).toFixed(1);
    default:
      return String(Math.round(badge.value));
  }
}

function badgeKey(badge: BpCardBadge): string {
  return badge.kind === "rating" ? `rating:${badge.source}` : badge.kind;
}

/**
 * Hero and detail form: no plate, because a hero already sits on a scrim.
 * Renders bare spans so the caller can interleave them with its own fact run.
 */
export function BpScoreChips({ badges }: { badges: readonly BpCardBadge[] }) {
  return (
    <>
      {badges.map((b) => (
        <span
          key={badgeKey(b)}
          className="flex items-center gap-[clamp(6px,0.5vw,10px)] tabular-nums text-ink"
        >
          {markFor(b, "h-[1.6em] w-auto max-w-[2.8em] shrink-0 object-contain")}
          {valueFor(b)}
        </span>
      ))}
    </>
  );
}

/**
 * Tile form, unanchored. Laid out row-reverse so the highest-priority chip sits
 * outermost against the end edge in both writing directions. The caller owns
 * the anchor, because the same corner also holds state marks.
 */
export function BpScoreRow({
  badges,
  limit,
}: {
  badges: readonly BpCardBadge[];
  limit: number;
}) {
  const shown = badges.slice(0, limit);
  if (shown.length === 0) return null;
  return (
    <span className="flex max-w-full flex-row-reverse items-center gap-[0.34em]">
      {shown.map((b) => (
        <span key={badgeKey(b)} className={CHIP}>
          {markFor(b, MARK)}
          {valueFor(b)}
        </span>
      ))}
    </span>
  );
}
