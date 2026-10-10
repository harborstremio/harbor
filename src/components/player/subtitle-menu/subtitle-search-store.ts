import { useSyncExternalStore } from "react";
import type { StreamHints } from "@/lib/subtitles/search";
import type { GeneratedSubtitleGroup } from "@/lib/subtitles/types";

export type SubtitleSearchHandle = {
  status: "idle" | "searching";
  lastAdded: number | null;
  hints: StreamHints | null;
  /** Generated translation offers (e.g. "Make Hindi") discovered by the search. */
  generated: GeneratedSubtitleGroup[];
  refresh: () => void;
  dismiss: () => void;
};

let current: SubtitleSearchHandle | null = null;
const listeners = new Set<() => void>();

export function publishSubtitleSearch(handle: SubtitleSearchHandle | null): void {
  if (current === handle) return;
  current = handle;
  listeners.forEach((l) => l());
}

export function useSubtitleSearch(): SubtitleSearchHandle | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
