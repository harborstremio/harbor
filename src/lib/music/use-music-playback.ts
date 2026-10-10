import { useSyncExternalStore } from "react";
import { getMusicState, subscribeMusic } from "./player";
import { createMusicPlaybackSelection } from "./player-selection";

const snapshot = createMusicPlaybackSelection(getMusicState);

/** Use the full player hook only for transport, progress, and timed lyrics. */
export function useMusicPlayback() {
  return useSyncExternalStore(subscribeMusic, snapshot, snapshot);
}
