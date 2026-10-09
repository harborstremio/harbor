import type { MusicTrack } from "./types";
import { queueTrackKey } from "./queue-order";

const manual = new Set<string>();

export function markManuallyQueued(track: MusicTrack): void {
  manual.add(queueTrackKey(track));
}

export function forgetManuallyQueued(track: MusicTrack): void {
  manual.delete(queueTrackKey(track));
}

export function manualBlockEnd(
  queue: MusicTrack[],
  currentIndex: number,
  isManual: (track: MusicTrack) => boolean,
): number {
  const start = currentIndex < 0 ? 0 : currentIndex + 1;
  let at = start;
  while (at < queue.length && isManual(queue[at])) at += 1;
  return at;
}

export function queueInsertIndex(queue: MusicTrack[], currentIndex: number): number {
  return manualBlockEnd(queue, currentIndex, (track) => manual.has(queueTrackKey(track)));
}

export function insertIntoQueue(queue: MusicTrack[], track: MusicTrack, at: number): MusicTrack[] {
  if (queue.some((item) => queueTrackKey(item) === queueTrackKey(track))) return queue;
  const index = Math.max(0, Math.min(at, queue.length));
  return [...queue.slice(0, index), track, ...queue.slice(index)];
}
