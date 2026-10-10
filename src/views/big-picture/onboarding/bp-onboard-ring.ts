import { bpFirstVisible } from "../bp-visible";
import { setBpFocus, type BpDir } from "../use-bp-focus";

/**
 * The one way anything in the onboarding flow moves the focus ring.
 *
 * The shell's own seed pass keeps reading [data-bp-autofocus] for six seconds
 * after a route change, so a mover that calls setBpFocus and leaves the mark
 * behind on the cell it moved off gets the ring dragged straight back. The mark
 * and the ring travel together here, and nothing in onboarding may move one
 * without the other.
 */

const FRAME = "[data-bp-onboard-frame]";
const PRIMARY = "[data-bp-onboard-primary]";

type BpRingOpts = { silent?: boolean; dir?: BpDir };

export function parkBpOnboardRing(scope: HTMLElement, el: HTMLElement, opts?: BpRingOpts): boolean {
  for (const prev of scope.querySelectorAll<HTMLElement>("[data-bp-autofocus='true']")) {
    prev.removeAttribute("data-bp-autofocus");
  }
  // Set whether or not focus lands. A candidate that refuses this frame is
  // still where the seed pass should aim once it stops refusing.
  el.setAttribute("data-bp-autofocus", "true");
  return setBpFocus(el, opts);
}

/**
 * Synchronous on purpose: the escape handler has to know inside the same tick
 * whether it claimed the press. Sounds like any other directional arrival
 * unless silenced, so a held Down that lands here is confirmed by the tick.
 */
export function focusBpOnboardPrimary(opts?: BpRingOpts): boolean {
  const primary = bpFirstVisible(PRIMARY);
  const scope = primary?.closest<HTMLElement>(FRAME) ?? null;
  if (!primary || !scope) return false;
  return parkBpOnboardRing(scope, primary, opts);
}

/**
 * What a step calls when its answer can no longer change on this screen. Silent
 * because the select that finished the answer already sounded, and two sounds
 * on one press reads as a stutter. The ring moving is the feedback.
 */
export function advanceBpOnboardRing(): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    focusBpOnboardPrimary({ silent: true });
  });
}
