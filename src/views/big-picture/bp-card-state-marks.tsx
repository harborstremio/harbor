import { Bookmark, Check, HardDrive } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useInLocalLibrary } from "@/lib/local-library";
import { isAndroidTv } from "@/lib/platform";
import { useSettings } from "@/lib/settings";
import type { Settings } from "@/lib/settings/types";
import { isTop10, useTop10Version } from "@/lib/top10-set";
import { useMetaWatched } from "@/lib/watched-flag";
import { useInWatchlist } from "@/lib/watchlist";
import { useBpT } from "./bp-i18n";
import { BpScoreRow } from "./bp-score-chips";
import type { BpCardBadge } from "./use-bp-card-badges";

export type BpCardZones = {
  scores: "topEnd" | "bottomEnd";
  watchlist: Settings["watchlistBadge"];
  watched: "topEnd" | "bottomEnd";
};

export type BpCardState = {
  inWatchlist: boolean;
  watched: boolean;
  inLocal: boolean;
  top10: boolean;
};

export type BpCardLift = "none" | "focus" | "always";

// Desktop resolves collisions by counting occupied slots and hardcoding a pixel
// top. Everything here is a clamp(), so the corners are flex columns instead and
// nothing can land on anything else. The watched check takes whichever corner
// the scores did not.
//
// This used to take a hasRank flag that forced the scores off the top-end corner
// whenever a ranked row printed a position pill there. There is no pill any
// more: a ranked cell draws the numeral OUTSIDE the poster, so it cannot collide
// with anything in the corners and the placement setting is free again.
export function bpCardZones(settings: Settings): BpCardZones {
  const scores: BpCardZones["scores"] =
    settings.badgePlacement === "top" ? "topEnd" : "bottomEnd";
  return {
    scores,
    watchlist: settings.watchlistBadge,
    watched: scores === "bottomEnd" ? "topEnd" : "bottomEnd",
  };
}

export function useBpCardState(
  meta: Meta,
  imdbId: string | undefined,
  zones: BpCardZones,
): BpCardState {
  const { settings } = useSettings();
  const altIds = useMemo(() => [imdbId], [imdbId]);
  // An off switch becomes an undefined id rather than a skipped hook, so a row
  // of hundreds pays nothing for a mark the user turned off. topStart is off
  // here too: that corner belongs to BpCardMarks, which subscribes itself, and
  // asking twice would put two entries per tile in the watchlist listener set.
  const owned = zones.watchlist !== "off" && zones.watchlist !== "topStart";
  const inWatchlist = useInWatchlist(owned ? meta.id : undefined, altIds);
  const watched = useMetaWatched(
    settings.showWatchedBadge ? meta.id : undefined,
    meta.type,
    imdbId,
  );
  const inLocal = useInLocalLibrary(
    settings.showLocalLibraryBadge ? meta.id : undefined,
    altIds,
  );
  useTop10Version();
  // On a television the ribbon is not a preference, it is the mark. The only
  // control that writes settings.top10Ribbon is desktop Settings then Library,
  // and it defaults to false, so a viewer who only ever sees Harbor on a TV had
  // no way to reach it and the mark could not appear however the feed was wired.
  // Defaulting it here rather than in lib/settings/defaults.ts on purpose: that
  // file is shared, and flipping it there would turn the ribbon on for every
  // desktop user who has never asked for it.
  const top10 = (isAndroidTv() || settings.top10Ribbon) && isTop10(meta.id, meta.name);
  return { inWatchlist, watched, inLocal, top10 };
}

const CIRCLE =
  "flex h-[1em] w-[1em] shrink-0 items-center justify-center rounded-full bg-[var(--bp-void)]/92 text-[clamp(21px,2.7vh,34px)] text-ink ring-1 ring-[var(--bp-edge-2)]";

const GLYPH = "h-[0.5em] w-[0.5em]";

export function BpStateCircle({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className={CIRCLE} title={label} aria-label={label}>
      {children}
    </span>
  );
}

// Exported because watchlistBadge: "topStart" puts this in the marks column,
// which BpCardMarks owns.
export function BpWatchlistMark() {
  const t = useBpT();
  return (
    <BpStateCircle label={t("In watchlist")}>
      <Bookmark className={GLYPH} strokeWidth={2.6} fill="currentColor" />
    </BpStateCircle>
  );
}

// Tailwind v4 compiles translate-y-* to the CSS translate property, so the
// transition names translate. Naming transform leaves this as a hard jump.
const LIFT_STYLE = {
  "--bp-mark-lift": "calc(-2.5 * clamp(10.5px, 1.4vh, 16px) - 2px)",
} as React.CSSProperties;

// --bp-focus-fade, not --bp-dur: this runs on the incoming and the outgoing card
// of every single focus move, so it is one of the transitions BP_TOKENS zeroes
// on a television. See the cliff record there before giving it its own duration.
const LIFT_BASE =
  "transition-[translate] duration-[var(--bp-focus-fade)] ease-[var(--bp-ease)] motion-reduce:transition-none";

// The focused tile paints its title across the bottom of the art, so the marks
// that live down there step above it rather than fade out. The focused card is
// the one being read; blanking its scores is the wrong trade.
function liftClass(lift: BpCardLift): string {
  if (lift === "none") return "";
  if (lift === "always") return `${LIFT_BASE} translate-y-[var(--bp-mark-lift)]`;
  return `${LIFT_BASE} group-data-[bp-focus=true]:translate-y-[var(--bp-mark-lift)]`;
}

export function BpCardStateMarks({
  zones,
  state,
  badges,
  limit,
  lift,
}: {
  zones: BpCardZones;
  state: BpCardState;
  badges: readonly BpCardBadge[];
  limit: number;
  lift: BpCardLift;
}) {
  const t = useBpT();
  const { settings } = useSettings();
  const topTenSide = settings.top10RibbonSide === "left" ? "left" : "right";
  const scores = badges.length > 0 ? <BpScoreRow badges={badges} limit={limit} /> : null;
  // The real ribbon, the same art desktop uses. This used to be swapped for a
  // text pill on any card carrying a position string, which is how the one row
  // named Top 10 became the only place the ribbon could never appear. The pill
  // rendered at clamp(9.5px, 1.2vh, 13px), which on the 641px television canvas
  // resolves to its 9.5px floor: the smallest glyph Big Picture draws anywhere,
  // on the row whose entire purpose is the number. A mark is read before a word
  // at ten feet, and 9.5px is neither.
  //
  // Bigger than desktop's 17 percent / 34px cap on purpose. That is a two-foot
  // size; at 17 percent of a 132px poster the words inside the tab are about
  // four pixels tall. NEEDS AN EYE at 1140x641 rather than another derivation.
  //
  // No drop-shadow. It is a CSS filter, so it opens a render surface on every
  // card that carries the mark, and this mark now ships on Home, Search,
  // Discover, Library and More Like This rather than nowhere. A saturated orange
  // tab on a poster does not need a shadow to separate.
  const topTen = state.top10 ? (
    <img
      src={topTenSide === "left" ? "/toptabl.png" : "/toptabr.png"}
      alt=""
      draggable={false}
      className={`pointer-events-none absolute top-0 z-20 w-[27%] min-w-[34px] max-w-[72px] select-none ${
        topTenSide === "left" ? "start-[7px]" : "end-[7px]"
      }`}
    />
  ) : null;
  const bookmark = state.inWatchlist ? <BpWatchlistMark /> : null;
  // A watched check is neither actionable nor live, so it does not get
  // --bp-live. The ring and the glyph carry it.
  const watched = state.watched ? (
    <BpStateCircle label={t("Watched")}>
      <Check className={GLYPH} strokeWidth={3} />
    </BpStateCircle>
  ) : null;
  const local = state.inLocal ? (
    <BpStateCircle label={t("In your local library")}>
      <HardDrive className={GLYPH} strokeWidth={2.6} />
    </BpStateCircle>
  ) : null;

  const topEndScores = zones.scores === "topEnd" ? scores : null;
  const bottomEndScores = zones.scores === "bottomEnd" ? scores : null;
  const topEndMark = zones.watchlist === "topEnd" ? bookmark : null;
  const bottomEndMark = zones.watchlist === "bottomEnd" ? bookmark : null;
  const bottomStartMark = zones.watchlist === "bottomStart" ? bookmark : null;
  const topEndWatched = zones.watched === "topEnd" ? watched : null;
  const bottomEndWatched = zones.watched === "bottomEnd" ? watched : null;

  const hasTopEnd = !!topEndScores || !!topEndMark || !!topEndWatched;
  const hasBottomEnd = !!bottomEndScores || !!bottomEndMark || !!bottomEndWatched;
  const hasBottomStart = !!local || !!bottomStartMark;
  const drop = liftClass(lift);

  return (
    <>
      {topTen}
      {hasTopEnd && (
        <span className="pointer-events-none absolute end-[7px] top-[7px] flex max-w-[calc(100%-14px)] flex-col items-end gap-[5px]">
          {topEndScores}
          {topEndMark}
          {topEndWatched}
        </span>
      )}
      {hasBottomEnd && (
        <span
          style={lift === "none" ? undefined : LIFT_STYLE}
          className={`pointer-events-none absolute bottom-[7px] end-[7px] flex max-w-[calc(100%-14px)] flex-col items-end gap-[5px] ${drop}`}
        >
          {bottomEndWatched}
          {bottomEndMark}
          {bottomEndScores}
        </span>
      )}
      {hasBottomStart && (
        <span
          style={lift === "none" ? undefined : LIFT_STYLE}
          className={`pointer-events-none absolute bottom-[7px] start-[7px] flex items-center gap-[5px] ${drop}`}
        >
          {local}
          {bottomStartMark}
        </span>
      )}
    </>
  );
}
