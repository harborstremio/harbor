import { useState } from "react";
import { BP_DETAIL_TRACK_GAP } from "./detail/bp-detail-chrome";
import { BP_EPISODE_CARD_W } from "./bp-episode-still";

export const BP_EPISODE_WINDOW = 60;
export const BP_EPISODE_GROW_STEP = 60;
export const BP_EPISODE_GROW_EDGE = 8;

const BLOCK = 60;
const KEEP_BACK = 60;

export type BpEpisodeWindow = {
  base: number;
  end: number;
  grow: (to: number) => void;
  anchor: (index: number) => void;
};

export function useBpEpisodeWindow(
  total: number,
  reach: number,
  resetKey: string,
): BpEpisodeWindow {
  const [end, setEnd] = useState(BP_EPISODE_WINDOW);
  const [at, setAt] = useState(0);
  const [key, setKey] = useState(resetKey);

  const stale = key !== resetKey;
  if (stale) {
    setKey(resetKey);
    setEnd(BP_EPISODE_WINDOW);
    setAt(0);
  }
  const from = stale ? BP_EPISODE_WINDOW : end;
  const at0 = stale ? 0 : at;

  const live = Math.min(total, Math.max(from, reach));
  const back = Math.min(at0, live - 1) - KEEP_BACK;
  const base = back < BLOCK ? 0 : Math.floor(back / BLOCK) * BLOCK;

  return {
    base,
    end: live,
    grow: (to) => setEnd((e) => Math.min(total, Math.max(e, to))),
    anchor: (index) => setAt((a) => (a === index ? a : index)),
  };
}

export function bpTrackHoldsRing(el: HTMLElement): boolean {
  return el.contains(document.activeElement) || el.querySelector("[data-bp-focus='true']") !== null;
}

export function BpEpisodeSpacer({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{
        width: `calc(${count} * (${BP_EPISODE_CARD_W} + ${BP_DETAIL_TRACK_GAP}) - ${BP_DETAIL_TRACK_GAP})`,
      }}
    />
  );
}
