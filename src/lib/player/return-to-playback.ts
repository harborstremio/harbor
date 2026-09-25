import type { PlayerSnapshot } from "./bridge";

export type PlayerReturnOptions = { restart?: boolean };

/** Uses the active player's normal controls, including their party/cast permissions. */
export async function returnToActivePlayback(
  options: PlayerReturnOptions,
  controls: {
    exitPip: () => Promise<void>;
    isCurrent: () => boolean;
    canControl: boolean;
    status: () => PlayerSnapshot["status"];
    seekTo: (seconds: number) => void;
    playPause: () => void;
    focus: () => void;
  },
): Promise<void> {
  await controls.exitPip();
  if (!controls.isCurrent()) throw new Error("Playback changed. Open the menu again.");
  if (options.restart) {
    if (!controls.canControl)
      throw new Error("Playback controls are not available in this session.");
    controls.seekTo(0);
  }
  const status = controls.status();
  if (status === "paused" || (options.restart && status === "ended")) {
    if (!controls.canControl)
      throw new Error("Playback controls are not available in this session.");
    controls.playPause();
  }
  controls.focus();
}
