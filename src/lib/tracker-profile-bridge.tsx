import { useEffect, useRef } from "react";
import { useProfiles } from "./profiles";
import { resetForProfile as resetTrakt } from "./trakt/session";
import { resetForProfile as resetSimkl } from "./simkl/session";
import { resetForProfile as resetAnilist } from "./anilist/session";
import { resetForProfile as resetMal } from "./mal/session";
import { resetForProfile as resetPmdb } from "./publicmetadb/session";
import { invalidatePmdbWatchedCache } from "./publicmetadb/history";
import { clearPmdbWatchlistCache } from "./publicmetadb/watchlist";
import { resetForProfile as resetSimklCache } from "./simkl/activities/store";
import { resetForProfile as resetAnilistSync } from "./anilist/sync";
import { resetForProfile as resetAnilistLists } from "./anilist/lists";
import { resetForProfile as resetMalSync } from "./mal/sync";

export function TrackerProfileBridge() {
  const { activeProfile } = useProfiles();
  const id = activeProfile?.id;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    resetSimklCache();
    resetAnilistSync();
    resetAnilistLists();
    resetMalSync();
    resetTrakt();
    resetSimkl();
    resetAnilist();
    resetMal();
    resetPmdb();
    invalidatePmdbWatchedCache();
    clearPmdbWatchlistCache();
  }, [id]);
  return null;
}
