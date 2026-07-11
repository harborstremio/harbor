import { useSyncExternalStore } from "react";

import { affinityIsEmpty, score, topEntries } from "./affinity";
import { profileFromDetail, profileFromMeta } from "./profile";
import { clearStore, getStore, subscribe, trackEvent } from "./store";
import type { Affinity, DiscoverEvent, DiscoverStore } from "./types";

export function useDiscover(): {
  events: DiscoverEvent[];
  affinity: Affinity;
  isCold: boolean;
} {
  const store = useSyncExternalStore<DiscoverStore>(subscribe, getStore, getStore);
  return {
    events: store.events,
    affinity: store.affinity,
    isCold: affinityIsEmpty(store.affinity),
  };
}

export { trackEvent, clearStore, score, topEntries, profileFromDetail, profileFromMeta };
export type { Affinity, DiscoverEvent, EventKind, ProfileSnapshot } from "./types";
