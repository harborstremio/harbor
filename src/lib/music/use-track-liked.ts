import { useSyncExternalStore } from "react";
import { likedIdsFor } from "./liked";
import { getMusicState, subscribeMusic } from "./player";
import type { MusicTrack } from "./types";

let cachedFrom: readonly string[] | null = null;
let cachedSet = new Set<string>();

function likedSet(ids: readonly string[]): Set<string> {
  if (ids !== cachedFrom) {
    cachedFrom = ids;
    cachedSet = new Set(ids);
  }
  return cachedSet;
}

export function useMusicTrackLiked(track: MusicTrack | null | undefined): boolean {
  return useSyncExternalStore(
    subscribeMusic,
    () => {
      const ids = getMusicState().likedIds;
      if (!track || ids.length === 0) return false;
      const set = likedSet(ids);
      return likedIdsFor(track).some((id) => set.has(id));
    },
    () => false,
  );
}
