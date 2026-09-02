import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronsRight, FastForward, X } from "lucide-react";
import { AdSkipIcon } from "@/components/icons/adskip-icon";
import { useGamepads } from "@/lib/gamepad/store";
import { SFX } from "@/lib/sfx";
import type { SkipSegment } from "@/lib/skip-intro";
import type { SpoilerMask } from "@/lib/spoilers";
import type { PlayEpisode } from "@/lib/view";
import { useBpT } from "../bp-i18n";
import { useBpPlayerOptional } from "./bp-player-context";
import {
  BP_STAGE_BOTTOM,
  BpUpNext,
  blockSpaceActivate,
  bpSurfaceVars,
  ensureBpPlayerSurfaceTokens,
  useBpStageRing,
} from "./bp-up-next";

const EXIT_MS = 240;
const PILL_H = "clamp(56px,6.4vh,86px)";

// Why this pill is a soft target and never takes the ring on arrival.
//
// A focused <button> fires on Enter AND on Space. Space is the player's pause
// key and Enter is Select on every D-pad, so a pill that grabbed focus the
// moment an intro started would spend the next ninety seconds turning the two
// most-used remote presses into a seek nobody asked for. Netflix can afford
// that because Select does not mean pause there. Harbor cannot.
//
// So it carries no data-bp-autofocus. That attribute is not a tiebreak, it is a
// force-seed: use-bp-focus stamps it on the settle pass with no user press at
// all, and the settle pass re-arms on every chrome wake and every panel close.
// A seed here would take the ring automatically, every time, and it would beat
// the transport's own seed as well because the stage renders first in the DOM.
//
// Reachable instead, by two routes:
//   1. Up from the transport reaches the scrub bar, and Up again runs out of
//      rail rows and falls through to spatial navigation, which finds the pill
//      sitting directly above the chrome. Two presses from the default ring.
//   2. MediaFastForward fires it with no navigation at all. That is the one
//      transport key use-keyboard-shortcuts.ts leaves unbound, so claiming it
//      costs nothing. MediaTrackNext is already next-episode: do not take it.
export function BpSkipPill({
  segment,
  hasNextEp,
  nextEp,
  nextEpMask,
  remainingSec,
  leadSec,
  visible,
  seedFocus = true,
  onSkip,
  onNextEpisode,
  onCancelAutoNext,
  onDismiss,
}: {
  segment: SkipSegment | null;
  hasNextEp: boolean;
  nextEp: PlayEpisode | null;
  nextEpMask?: SpoilerMask;
  remainingSec: number;
  leadSec?: number;
  visible: boolean;
  seedFocus?: boolean;
  onSkip: () => void;
  onNextEpisode: () => void;
  onCancelAutoNext?: () => void;
  onDismiss?: () => void;
}) {
  const t = useBpT();
  const pads = useGamepads();
  const shell = useBpPlayerOptional();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState<SkipSegment | null>(segment);
  const [show, setShow] = useState(false);

  // `visible && show` is load-bearing, not belt and braces. The exit fade holds
  // this mounted for EXIT_MS after the segment clears with show already false,
  // and inertBlocked in bp-focus-core never looks at opacity, so without it the
  // ring can sit on an invisible Skip Intro and the next Enter seeks unseen.
  const focusable = (shell ? shell.chromeUp : true) && visible && show;
  useBpStageRing(rootRef, focusable);

  useLayoutEffect(() => ensureBpPlayerSurfaceTokens(), []);

  useEffect(() => {
    if (segment) {
      setMounted(segment);
      const id = window.requestAnimationFrame(() => setShow(true));
      return () => window.cancelAnimationFrame(id);
    }
    setShow(false);
    const timer = window.setTimeout(() => setMounted(null), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [segment?.kind, segment?.startSec, segment?.endSec]);

  const isOutroNext = mounted?.kind === "outro" && hasNextEp && Boolean(nextEp);
  const finalLeadSec = typeof leadSec === "number" && leadSec > 0 ? leadSec : 15;
  const asUpNext =
    isOutroNext && Boolean(nextEp) && remainingSec > 0 && remainingSec <= finalLeadSec;

  // Read through a ref so the window listener binds once per arm instead of
  // resubscribing on every playback-clock tick.
  const fireRef = useRef<() => void>(onSkip);
  fireRef.current = () => {
    SFX.click();
    if (isOutroNext) onNextEpisode();
    else onSkip();
    // A blind skip lands somewhere the viewer cannot see. The scrub readout is
    // the cheapest way to show them where, without raising the full chrome.
    shell?.peekChrome();
  };
  const armed = Boolean(mounted) && !asUpNext && visible && show;

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      // Arrows, Enter and Space are deliberately absent. Big Picture allows one
      // window listener to act on arrows, and stopPropagation does not stop a
      // second listener on the same object, so this claims one dead media key
      // and nothing else. Anything directional belongs in setBpPlayerKeyHandler.
      if (e.key !== "MediaFastForward") return;
      e.preventDefault();
      fireRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed]);

  if (!mounted) return null;

  if (asUpNext && nextEp) {
    return (
      <BpUpNext
        ep={nextEp}
        mask={nextEpMask}
        remainingSec={remainingSec}
        leadSec={finalLeadSec}
        visible={visible && show}
        seedFocus={seedFocus}
        onPlay={onNextEpisode}
        onCancel={onCancelAutoNext}
      />
    );
  }

  const isAd = mounted.kind === "ad";
  const label = isAd
    ? t("Skip injected ad?")
    : mounted.kind === "intro"
      ? t("Skip Intro")
      : mounted.kind === "recap"
        ? t("Skip Recap")
        : isOutroNext
          ? t("Next Episode")
          : t("Skip Credits");
  const Icon = isOutroNext ? ChevronsRight : FastForward;

  return (
    <div
      ref={rootRef}
      data-bp-player-surface="true"
      style={bpSurfaceVars()}
      className="pointer-events-none absolute inset-0 z-30"
    >
      <div
        data-bp-skip-pill
        className={`pointer-events-auto absolute end-[var(--bp-gutter)] flex items-center gap-[clamp(9px,0.9vw,16px)] transition-[opacity,transform,bottom] duration-[var(--bp-dur)] ease-[var(--bp-ease)] motion-reduce:transition-none ${
          visible && show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
        style={{ bottom: BP_STAGE_BOTTOM }}
      >
        {/* Resting fill, border and shadow all stay classes. The chip focus rule
            in bp-tokens sets both background and box-shadow without !important,
            so an inline value for either outranks it and the D-pad ring loses
            that half of its treatment. The --bp-touch hairline is what says
            "actionable" while it is only a soft target; focus floods the same
            colour, so the two states never read alike. */}
        <button
          type="button"
          data-bp-focusable={focusable ? "" : undefined}
          data-bp-chip
          onKeyDown={blockSpaceActivate}
          onClick={() => fireRef.current()}
          className="group flex shrink-0 items-center gap-[clamp(9px,0.9vw,16px)] rounded-[var(--bp-r-md)] border-2 border-[var(--bp-touch)] bg-[var(--bp-panel-2)] px-[clamp(18px,1.7vw,34px)] text-[clamp(15px,2.05vh,25px)] font-bold text-ink shadow-[0_26px_60px_-22px_rgba(0,0,0,0.9)]"
          style={{ height: PILL_H }}
        >
          {isAd ? (
            <AdSkipIcon className="h-[clamp(21px,2.5vh,30px)] w-[clamp(21px,2.5vh,30px)]" />
          ) : (
            <Icon size={24} strokeWidth={2.3} />
          )}
          {label}
          {/* Same glyph vocabulary as bp-hint-bar. That bar lives inside the
              hidden shell during playback, so this cap is the only place the
              viewer is told which button fires the pill. */}
          <span className="hidden items-center justify-center rounded-[var(--bp-r-xs)] border border-current px-[clamp(7px,0.6vw,12px)] py-[2px] text-[clamp(10.5px,1.35vh,15px)] font-bold uppercase tracking-[0.12em] opacity-70 group-data-[bp-focus=true]:flex">
            {pads.length > 0 ? "A" : "Enter"}
          </span>
        </button>

        {onDismiss && !isOutroNext && (
          <button
            type="button"
            data-bp-focusable={focusable ? "" : undefined}
            data-bp-chip
            onKeyDown={blockSpaceActivate}
            onClick={() => {
              SFX.close();
              onDismiss();
            }}
            aria-label={t("Hide this Skip button")}
            title={t("Hide this Skip button")}
            className="flex shrink-0 items-center justify-center rounded-[var(--bp-r-md)] border border-[var(--bp-edge-2)] bg-[var(--bp-panel-2)] text-ink-subtle"
            style={{ width: PILL_H, height: PILL_H }}
          >
            <X size={24} strokeWidth={2.6} />
          </button>
        )}
      </div>
    </div>
  );
}
