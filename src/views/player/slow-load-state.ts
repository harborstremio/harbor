const PLAYBACK_STARTED_THRESHOLD_SEC = 0.5;

export type SlowLoadSessionState = {
  sourceUrl: string;
  playbackStarted: boolean;
};

export function hasPlaybackStarted(input: { positionSec: number; bufferedSec: number }): boolean {
  // Buffered bytes can exist before the player decodes its first frame.
  return input.positionSec > PLAYBACK_STARTED_THRESHOLD_SEC;
}

export function initialSlowLoadSessionState(sourceUrl: string): SlowLoadSessionState {
  return { sourceUrl, playbackStarted: false };
}

export function advanceSlowLoadSessionState(
  state: SlowLoadSessionState,
  input: { sourceUrl: string; playbackStartedNow: boolean },
): SlowLoadSessionState {
  if (state.sourceUrl !== input.sourceUrl) {
    return initialSlowLoadSessionState(input.sourceUrl);
  }
  if (state.playbackStarted || !input.playbackStartedNow) return state;
  return { ...state, playbackStarted: true };
}

export function shouldArmSlowLoadWarning(input: {
  isLocal: boolean;
  playbackStarted: boolean;
  playbackSuspended: boolean;
}): boolean {
  return !input.isLocal && !input.playbackStarted && !input.playbackSuspended;
}
