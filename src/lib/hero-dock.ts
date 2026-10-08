import { useSyncExternalStore } from "react";
import type { Frame, PlayerSrc } from "./view";

/**
 * The sticky hero player. While a video is docked it keeps playing in a fixed hero box at the top
 * of the hub pages, so the viewer can browse rows underneath. Docked playback is not a frame on
 * the nav stack, which is what lets it survive switching between hubs.
 */

export type HeroDock = {
  src: PlayerSrc;
};

/** Root pages that show the docked video in their hero spot. */
const HUB_KINDS = new Set<Frame["kind"]>(["home", "live", "sports", "movies", "shows", "anime", "kids", "discover", "vod"]);

export const isHubKind = (kind: Frame["kind"] | string | undefined): boolean =>
  !!kind && HUB_KINDS.has(kind as Frame["kind"]);

let dock: HeroDock | null = null;
// The full player was opened from the hero, so leaving it goes back to the hero.
let expandedFromDock = false;
// Off where the video can't be drawn into a sub-rectangle (embedded mpv on Linux).
let supported = true;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function getHeroDock(): HeroDock | null {
  return dock;
}

export function isHeroDocked(): boolean {
  return dock !== null;
}

export function setHeroDock(next: HeroDock | null): void {
  if (dock === next) return;
  dock = next;
  if (next) expandedFromDock = false;
  emit();
}

export function markExpandedFromDock(value: boolean): void {
  expandedFromDock = value;
}

export function wasExpandedFromDock(): boolean {
  return expandedFromDock;
}

export function setHeroDockSupported(value: boolean): void {
  supported = value;
}

export function heroDockSupported(): boolean {
  return supported;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useHeroDock(): HeroDock | null {
  return useSyncExternalStore(subscribe, getHeroDock, () => null);
}
