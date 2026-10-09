import type { MusicPlayerState } from "./types";

export type MusicPlaybackState = Omit<MusicPlayerState, "currentTime">;

/** Catalogs need track/queue changes, not a complete rerender on every clock tick. */
export function createMusicPlaybackSelection(read: () => MusicPlayerState) {
  let selected: MusicPlaybackState | undefined;
  return () => {
    const { currentTime: _time, ...next } = read();
    if (!selected || (Object.keys(next) as (keyof MusicPlaybackState)[])
      .some(key => !Object.is(next[key], selected![key]))) selected = next;
    return selected;
  };
}
