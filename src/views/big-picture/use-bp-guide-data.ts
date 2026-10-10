import { useMemo } from "react";
import { epgProgramsForChannel } from "@/lib/iptv/epg-resolver";
import type { EpgIndex, EpgProgram, IptvChannel } from "@/lib/iptv/types";
import { SLOT_MS } from "./bp-guide-geometry";
import type { BpGuideCell } from "./bp-guide-lane";

export type BpGuideRow = { channel: IptvChannel };

const CACHE_MAX = 600;
const MIN_GAP_MS = 1000;

// A lane is contiguous and gapless across the whole window, so no row is ever
// empty, Up and Down can never land on nothing, and "what is airing at T" is
// one lookup that always returns exactly one cell.
// Empty stretches are split on slot boundaries rather than left as one giant
// cell. A single cell spanning the window means Right on a no-EPG row extends
// the window by three hours per press up to 26 hours while the cursor never
// moves. Sliced, such a row pans time exactly like an EPG row.
function closeGap(out: BpGuideCell[], from: number, to: number): void {
  if (to <= from) return;
  if (to - from < MIN_GAP_MS && out.length > 0) {
    out[out.length - 1].endMs = to;
    return;
  }
  let cur = from;
  while (cur < to) {
    const next = Math.min(to, Math.floor(cur / SLOT_MS) * SLOT_MS + SLOT_MS);
    out.push({ startMs: cur, endMs: next, program: null });
    cur = next;
  }
}

function buildLane(
  programs: readonly EpgProgram[],
  windowStart: number,
  windowEnd: number,
): BpGuideCell[] {
  const inWindow = programs
    .filter((p) => p.endMs > windowStart && p.startMs < windowEnd)
    .sort((a, b) => a.startMs - b.startMs);

  const out: BpGuideCell[] = [];
  let cursor = windowStart;
  for (const program of inWindow) {
    const endMs = Math.min(program.endMs, windowEnd);
    if (endMs <= cursor) continue;
    const startMs = Math.max(program.startMs, cursor);
    closeGap(out, cursor, startMs);
    out.push({ startMs, endMs, program });
    cursor = endMs;
  }
  closeGap(out, cursor, windowEnd);
  return out;
}

export function useBpGuideData(args: {
  channels: IptvChannel[];
  epg: EpgIndex | null;
  tvgCounts: ReadonlyMap<string, number>;
  nowMs: number;
}): {
  rows: BpGuideRow[];
  laneFor: (channel: IptvChannel, windowStart: number, windowEnd: number) => BpGuideCell[];
} {
  const { channels, epg, tvgCounts } = args;

  const rows = useMemo(() => channels.map((channel) => ({ channel })), [channels]);

  // Every mounted row, the ruler and each nav step ask for the same lane, so the
  // resolver runs once per channel and window instead of once per read.
  const laneFor = useMemo(() => {
    const cache = new Map<string, BpGuideCell[]>();
    return (channel: IptvChannel, windowStart: number, windowEnd: number): BpGuideCell[] => {
      const key = `${channel.id}:${windowStart}:${windowEnd}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const programs = epgProgramsForChannel(channel, epg, tvgCounts) ?? [];
      const lane = buildLane(programs, windowStart, windowEnd);
      if (cache.size >= CACHE_MAX) cache.clear();
      cache.set(key, lane);
      return lane;
    };
  }, [epg, tvgCounts]);

  return { rows, laneFor };
}
