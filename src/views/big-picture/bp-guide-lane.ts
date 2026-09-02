import type { EpgProgram } from "@/lib/iptv/types";

export type BpGuideCell = { startMs: number; endMs: number; program: EpgProgram | null };

// Lanes are contiguous and gapless, so the last cell starting at or before ms is
// always the one containing it. Nav depends on this never returning -1.
export function cellIndexAt(lane: BpGuideCell[], ms: number): number {
  if (lane.length === 0) return 0;
  let lo = 0;
  let hi = lane.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lane[mid].startMs <= ms) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function laneHasProgram(cells: BpGuideCell[]): boolean {
  return cells.some((cell) => cell.program !== null);
}
