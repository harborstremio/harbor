import { useSyncExternalStore } from "react";
import { MusicQueueOrder } from "./queue-order";
import { readMusicPreference, writeMusicPreference } from "./preferences";
import type { MusicTrack } from "./types";

export type MusicRepeatMode = "off" | "all" | "one";
export type MusicTransport = { shuffle: boolean; repeat: MusicRepeatMode };

const SHUFFLE_KEY = "harbor.music.shuffle.v1";
const REPEAT_KEY = "harbor.music.repeat.v1";
const REPEAT_ORDER: MusicRepeatMode[] = ["off", "all", "one"];

function readTransport(): MusicTransport {
  const stored = readMusicPreference(REPEAT_KEY);
  return {
    shuffle: readMusicPreference(SHUFFLE_KEY) === "1",
    repeat: REPEAT_ORDER.find((mode) => mode === stored) ?? "off",
  };
}

let transport = readTransport();
const queueOrder = new MusicQueueOrder();
let priorityNext: MusicTrack | null = null;
const transportListeners = new Set<() => void>();

function publishTransport(patch: Partial<MusicTransport>): void {
  transport = { ...transport, ...patch };
  writeMusicPreference(SHUFFLE_KEY, transport.shuffle ? "1" : "0");
  writeMusicPreference(REPEAT_KEY, transport.repeat);
  if (patch.shuffle !== undefined) queueOrder.reset();
  for (const listener of transportListeners) listener();
}

function subscribeTransport(listener: () => void): () => void {
  transportListeners.add(listener);
  return () => {
    transportListeners.delete(listener);
  };
}

export function toggleMusicShuffle(): void {
  publishTransport({ shuffle: !transport.shuffle });
}

export function cycleMusicRepeat(): void {
  const at = REPEAT_ORDER.indexOf(transport.repeat);
  publishTransport({ repeat: REPEAT_ORDER[(at + 1) % REPEAT_ORDER.length] ?? "off" });
}

/** What will actually play next, shuffle included, so a list never shows the stored order by mistake. */
export function musicUpcoming(queue: MusicTrack[], index: number, count: number, includeRepeats = true): MusicTrack[] {
  return queueOrder.upcoming(queue, index, includeRepeats ? transport : { ...transport, repeat: "off" }, count);
}

export const getMusicTransport = (): MusicTransport => transport;

export function useMusicTransport(): MusicTransport {
  return useSyncExternalStore(
    subscribeTransport,
    () => transport,
    () => transport,
  );
}

export const musicPriorityNext = () => priorityNext;

export function setMusicPriorityNext(track: MusicTrack | null): void {
  priorityNext = track;
}

/**
 * Owned here rather than injected into the player, so listening order cannot be lost when one
 * module is replaced without the other.
 */
export function musicAdvance(
  queue: MusicTrack[],
  index: number,
  auto: boolean,
): MusicTrack | null {
  const next = queueOrder.next(queue, index, transport, auto, priorityNext);
  if (!(auto && transport.repeat === "one")) priorityNext = null;
  return next;
}

export function musicPrevious(queue: MusicTrack[], index: number): MusicTrack | null {
  return queueOrder.previous(queue, index, transport.shuffle);
}

/**
 * The tracks worth resolving early. Preloading the stored neighbours warmed the wrong songs
 * whenever shuffle or Play next changed the order, so every advance paid for a cold lookup.
 */
export function musicWarmTargets(
  queue: MusicTrack[],
  index: number,
  count: number,
): MusicTrack[] {
  const ahead = musicUpcoming(queue, index, count);
  const out = priorityNext ? [priorityNext, ...ahead] : ahead;
  const behind = queueOrder.peekPrevious(queue, index, transport.shuffle);
  if (behind) out.push(behind);
  return out;
}

export function resetMusicOrder(): void {
  queueOrder.reset();
  priorityNext = null;
}
