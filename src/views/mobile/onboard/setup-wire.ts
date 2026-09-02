import {
  HANDOFF_PARAM,
  HANDOFF_STEPS,
  type HandoffPayload,
  type HandoffStepId,
} from "@/lib/tv-handoff/handoff-protocol";
import { readHandoffCodeFromLocation } from "@/lib/tv-handoff/handoff-code";

/**
 * The phone speaks the TV's contract directly. An earlier pass mirrored a
 * second dialect here and neither side could ever parse the other, so nothing
 * below may redeclare a frame shape: import it or it drifts again.
 */
export type SetupStepId = HandoffStepId;
export type SetupPayload = HandoffPayload;

export const STEP_ORDER: readonly SetupStepId[] = HANDOFF_STEPS;

/**
 * Normalised, not merely trimmed. This value is also read aloud off a TV and
 * retyped, and links get lowercased in transit, so O/0 and I/L/1 have to fold
 * before the TV scores the claim against its lockout budget.
 */
export function setupToken(): string | null {
  return readHandoffCodeFromLocation();
}

export function hasSetupToken(): boolean {
  return setupToken() !== null;
}

/**
 * Drops the parameter so a reload lands on the ordinary remote rather than
 * re-entering setup against a code the TV has already retired.
 */
export function clearSetupToken(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(HANDOFF_PARAM)) return;
    url.searchParams.delete(HANDOFF_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // A blocked replaceState costs the user one stale reload, never the flow.
  }
}
