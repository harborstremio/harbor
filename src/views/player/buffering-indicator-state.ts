const STALL_CONFIRM_MS = 300;
const POSITION_PROGRESS_EPSILON_SEC = 0.05;

export type BufferingIndicatorState = {
  candidateSinceMs: number | null;
  lastPositionSec: number | null;
  visible: boolean;
};

export type BufferingIndicatorSample = {
  buffering: boolean;
  eligible: boolean;
  nowMs: number;
  positionSec: number;
};

export function initialBufferingIndicatorState(): BufferingIndicatorState {
  return {
    candidateSinceMs: null,
    lastPositionSec: null,
    visible: false,
  };
}

export function advanceBufferingIndicator(
  state: BufferingIndicatorState,
  sample: BufferingIndicatorSample,
): BufferingIndicatorState {
  if (!sample.buffering || !sample.eligible) return initialBufferingIndicatorState();

  const positionAdvanced =
    state.lastPositionSec != null &&
    sample.positionSec > state.lastPositionSec + POSITION_PROGRESS_EPSILON_SEC;
  const candidateSinceMs =
    state.candidateSinceMs == null || positionAdvanced ? sample.nowMs : state.candidateSinceMs;

  return {
    candidateSinceMs,
    lastPositionSec: sample.positionSec,
    visible: !positionAdvanced && sample.nowMs - candidateSinceMs >= STALL_CONFIRM_MS,
  };
}
