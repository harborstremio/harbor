import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { PlayEpisode } from "@/lib/view";
import { SFX } from "@/lib/sfx";
import { BpEpisodeCard } from "./detail/bp-episode-card";
import { BP_DETAIL_HEADING } from "./detail/bp-detail-chrome";
import { BP_EPISODE_STRIP } from "./bp-episode-still";
import {
  bpTrackHoldsRing,
  BpEpisodeSpacer,
  BP_EPISODE_GROW_EDGE,
  BP_EPISODE_GROW_STEP,
} from "./bp-episode-window";
import { bpRailRoute } from "./bp-focus-core";
import { readBpRowPosition, rememberBpRowPosition } from "./bp-restore";
import type { BpEpisodeStripState } from "./detail/use-bp-episode-strip";
import { useBpT } from "./bp-i18n";

export { useBpEpisodeStrip } from "./detail/use-bp-episode-strip";
export type { BpEp, BpEpisodeStripState } from "./detail/use-bp-episode-strip";

function BpEpisodesHeading() {
  const t = useBpT();
  return <h2 className={BP_DETAIL_HEADING}>{t("Episodes")}</h2>;
}

// A twenty four episode strip that always opens on episode one is unusable from
// a couch, the same thing BpAnimeEpisodeStrip fixed at bp-anime-seasons.tsx:268,
// and a twenty season chip row that always opens on S1 was the identical bug one
// row up: the strip below it was already showing season fifteen while the only
// chip on screen said S1. Two halves, and one without the other is worse than
// neither: the track parks so the viewer SEES where they left off, and the row
// memory is seeded so the first Down lands there instead of on cell one and
// gliding the track straight back to the start.
//
// Focus is never moved here. The ring belongs to whoever the engine put it on.
function useBpParkedTrack(rowKey: string, index: number, base: number, stamp: string) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const parkedRef = useRef("");

  useEffect(() => {
    if (index <= 0 || parkedRef.current === stamp) return;

    // ONE retry, never a loop. The row carries content-visibility:auto until the
    // ring is in it, so a first attempt can land on a subtree the browser has
    // skipped and read zeroes. A rescheduling frame would keep the panel
    // rendering forever whenever this row never comes near the viewport.
    let frame = 0;
    const park = (last: boolean) => {
      const track = trackRef.current;
      if (!track || track.contains(document.activeElement)) return;
      const cell = track.querySelectorAll<HTMLElement>("[data-bp-focusable]")[index - base];
      if (!cell) return;
      const t0 = track.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      // A stale zero-width rect computes a hugely negative offset and throws the
      // track back to cell one.
      if (t0.width < 2 || c.width < 2) {
        if (!last) frame = window.requestAnimationFrame(() => park(true));
        return;
      }
      parkedRef.current = stamp;
      track.scrollTo({
        left: Math.max(0, track.scrollLeft + (c.left - t0.left) - 24),
        behavior: "auto",
      });
      // Never over a real one. The viewer's own last cell in this row outranks a
      // resume point they have already navigated away from.
      const key = cell.dataset.bpRestoreKey ?? "";
      const route = bpRailRoute();
      if (key && !readBpRowPosition(route, rowKey)) {
        rememberBpRowPosition(route, rowKey, key);
      }
    };

    park(false);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [rowKey, index, base, stamp]);

  return trackRef;
}

// The chip strip and the card strip are two rail rows, never one. bpRailStep
// steps by rail index and takes the first focusable in the whole subtree, so a
// single index holding both sections landed every Down on a season chip and the
// episode cards were unreachable by D-pad on any multi-season series.
export function BpEpisodeSeasonChips({
  state,
  open,
  onOpen,
}: {
  state: BpEpisodeStripState;
  open: boolean;
  onOpen: () => void;
}) {
  const t = useBpT();
  if (state.seasons.length <= 1) return null;

  return (
    <section data-bp-row data-bp-row-key="episode-filters" className="relative">
      <BpEpisodesHeading />
      <div className="flex items-center px-[var(--bp-gutter)]">
        <button
          type="button"
          data-bp-focusable
          data-bp-chip
          data-bp-restore-key="bp-season-trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            SFX.open();
            onOpen();
          }}
          className="flex h-[clamp(48px,5.6vh,66px)] min-w-[clamp(190px,17vw,300px)] shrink-0 items-center gap-[clamp(9px,0.9vw,16px)] rounded-full bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] text-[clamp(14px,1.95vh,23px)] font-bold text-ink transition-colors duration-[var(--bp-dur-fast)] motion-reduce:transition-none data-[bp-focus=true]:bg-[var(--color-ink)] data-[bp-focus=true]:text-[var(--color-canvas)]"
        >
          <span>{t("Season {n}", { n: state.active })}</span>
          <span className="flex-1 text-start text-[clamp(12px,1.6vh,19px)] font-semibold tabular-nums text-ink-subtle">
            {t("{n} episodes", { n: state.seasonCounts.get(state.active) ?? 0 })}
          </span>
          <ChevronDown size={20} strokeWidth={2.4} className="shrink-0 text-ink-subtle" />
        </button>
      </div>
    </section>
  );
}

const ROW_KEY = "episodes";

export function BpEpisodeStrip({
  state,
  onPlay,
}: {
  state: BpEpisodeStripState;
  onPlay: (e: PlayEpisode) => void;
}) {
  const { active, resumeIndex, base, end } = state;
  const trackRef = useBpParkedTrack(ROW_KEY, resumeIndex, base, `${active}:${resumeIndex}`);

  if (state.seasons.length === 0) return null;

  return (
    <section data-bp-row data-bp-row-key={ROW_KEY} className="relative">
      {state.seasons.length <= 1 && <BpEpisodesHeading />}
      <div
        ref={trackRef}
        data-bp-scroll-x
        className={BP_EPISODE_STRIP}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollWidth - el.scrollLeft - el.clientWidth >= 1200) return;
          if (!bpTrackHoldsRing(el)) state.anchor(end - 1);
          state.grow(end + BP_EPISODE_GROW_STEP);
        }}
      >
        <BpEpisodeSpacer count={base} />
        {state.episodes.map((ep, i) => {
          const at = base + i;
          return (
            <BpEpisodeCard
              key={ep.key}
              ep={ep}
              stills={state.stillsOf(ep)}
              backdrop={state.backdrop}
              fact={state.factOf(ep)}
              onPlay={onPlay}
              watched={state.watchedOf(ep)}
              progress={state.progressOf(ep)}
              onFocus={() => {
                state.anchor(at);
                if (at >= end - BP_EPISODE_GROW_EDGE) state.grow(end + BP_EPISODE_GROW_STEP);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
