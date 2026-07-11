import { useSyncExternalStore } from "react";

import type { SkipSegment } from "./types";

let segments: SkipSegment[] = [];
const listeners = new Set<() => void>();

export function setSkipSegmentsView(next: SkipSegment[]): void {
  segments = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSkipSegmentsView(): SkipSegment[] {
  return useSyncExternalStore(
    subscribe,
    () => segments,
    () => segments,
  );
}
