import type { PlayerSnapshot } from "./bridge";

const END_RATIO = 0.85;

export function isNaturalEnd(snap: PlayerSnapshot, positionSec: number): boolean {
  if (snap.status !== "ended") return false;
  if (!Number.isFinite(snap.durationSec) || snap.durationSec <= 0) return true;
  return positionSec / snap.durationSec >= END_RATIO;
}

export function isTruncatedEnd(snap: PlayerSnapshot, positionSec: number): boolean {
  return snap.status === "ended" && !isNaturalEnd(snap, positionSec);
}
