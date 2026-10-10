import { useEffect, useState } from "react";
import { ThumbsUp } from "lucide-react";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import { getUpvotedIds, setVote } from "@/lib/feed/preferences";
import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";
import type { BpOnboardStepProps } from "../../bp-onboarding-frame";
import { useBpT } from "../../bp-i18n";
import { BpTasteDetail } from "../bp-taste-detail";
import { BpDecisionNote, BpDecisionScroll } from "../bp-step-parts";
import { useBpTasteTitles } from "../use-bp-taste-titles";

const MAX = 5;
const PER_ROW = 6;

/**
 * A real [data-bp-grid], never chunked [data-bp-row]s. Two traps live here.
 *
 * A focused tile scales 1.06 from a bottom origin, which lifts its centre about
 * seven pixels, so under plain geometry its own row neighbours score as below
 * it and Down walked sideways forever. gridStep drops same-row candidates
 * outright, which kills that, and it scores rowGap*4 + horizontal distance, so
 * Down keeps the column the eye is on. Rail indices also killed the sideways
 * walk but bpRailStep has no column memory on a first pass and landed every
 * Down on cell one of the next row.
 *
 * The rows carry no [data-bp-row] because that would give them
 * content-visibility:auto, and candidatesFor measures a grid from an already
 * measured pool with no reveal: skipped cells vanish, gridStep finds nothing
 * below, and the first Down escapes the grid straight onto the action rail.
 * Every other grid in Big Picture is built this way for the same reason.
 */
function reducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function BpStepTaste({ setSatisfied }: BpOnboardStepProps) {
  const t = useBpT();
  const { settings } = useSettings();
  const items = useBpTasteTitles(settings.tmdbKey);
  const [picked, setPicked] = useState<Set<string>>(() => getUpvotedIds());
  // Ring only, never the pointer. Mouse hover set this too and the panel then
  // described whatever the cursor last brushed while the ring sat elsewhere.
  const [hover, setHover] = useState<Meta | null>(null);

  // Counted against what this grid shows, not the whole vote store. A returning
  // user already carrying five upvotes would otherwise meet a frozen grid.
  const onScreen = items ? items.filter((m) => picked.has(m.id)).length : 0;
  const atMax = onScreen >= MAX;

  // Latched, never level. Five is a hard cap, so the fifth pick is the last act
  // on this screen and the ring belongs on Continue, and a user who arrives
  // already holding five is in exactly the same state. Reporting false again on
  // a deselect would re-run the frame's arrival pass and throw the ring back to
  // poster one while the user was mid swap.
  useEffect(() => {
    if (atMax) setSatisfied(true);
  }, [atMax, setSatisfied]);

  // Written on select, never on Continue. The desktop modal held picks in
  // component state, so Skip, the close button and a dot jump all threw them away.
  const toggle = (m: Meta, el: HTMLElement) => {
    const on = picked.has(m.id);
    if (!on && atMax) {
      // At the cap an unpicked tile is a no-op, and a no-op with no sound, no
      // movement and no ring change reads as the app having frozen. This is the
      // same refusal the engine gives a dead-end arrow press.
      if (!reducedMotion()) {
        el.animate?.([{ translate: "0 0" }, { translate: "0 -6px" }, { translate: "0 0" }], {
          duration: 190,
          easing: "cubic-bezier(0.22,1,0.36,1)",
        });
      }
      SFX.hover();
      return;
    }
    SFX.click();
    setVote(m.id, on ? null : "up", { name: m.name, type: m.type });
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
  };

  if (items === null) {
    return (
      <BpDecisionScroll>
        {/* Six animate-pulse plates are six live offscreen passes against a
            cliff that saturates at eight, and this one runs for as long as
            seventeen network calls take. */}
        <div aria-hidden className="shrink-0">
          <div className="flex gap-[clamp(6px,0.6vw,12px)]">
            {Array.from({ length: PER_ROW }).map((_, i) => (
              <div
                key={i}
                data-bp-plate
                className="aspect-[2/3] flex-1 rounded-sm bg-[var(--bp-panel)]"
              />
            ))}
          </div>
        </div>
        <BpDecisionNote text={t("Finding titles…")} />
      </BpDecisionScroll>
    );
  }

  return (
    <BpDecisionScroll>
      <BpTasteDetail meta={hover ?? items[0] ?? null} />
      <div
        data-bp-grid
        // Read by the held-Down escape to answer "is there a row below me"
        // without a rect. Every cell in a grid is a DOM sibling, so a sibling
        // walk says yes for all but the very last tile and the whole last row
        // then scores Skip and Continue against each other by distance.
        data-bp-grid-cols={PER_ROW}
        className="grid shrink-0 gap-[clamp(8px,0.8vw,16px)] px-[16px] py-[30px]"
        style={{ gridTemplateColumns: `repeat(${PER_ROW}, minmax(0, 1fr))` }}
      >
        {items.map((m) => {
          const on = picked.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              data-bp-focusable
              data-bp-tile
              aria-pressed={on}
              aria-disabled={!on && atMax}
              aria-label={m.name}
              onFocus={() => setHover(m)}
              onClick={(e) => toggle(m, e.currentTarget)}
              className={`relative block min-w-[44px] overflow-hidden rounded-[var(--bp-r-sm)] ${
                !on && atMax ? "opacity-40" : ""
              }`}
            >
              <Poster src={m.poster} seed={m.id} ratio="portrait" />
              {on && (
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  style={{ background: "color-mix(in oklab, var(--bp-void) 62%, transparent)" }}
                >
                  <ThumbsUp size={28} strokeWidth={2.2} style={{ color: "var(--bp-live)" }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <BpDecisionNote
        text={
          atMax
            ? t("That is five. Deselect one to swap it out.")
            : t("{n} of {max} picked", { n: onScreen, max: MAX })
        }
      />
    </BpDecisionScroll>
  );
}
