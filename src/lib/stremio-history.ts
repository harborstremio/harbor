import { readActiveStremioAuthKey } from "@/lib/auth";
import { isMembershipProfileCurrent, type MembershipProfile } from "@/lib/membership-operations";
import {
  ANIME_CLOUD_ID,
  invalidateLibraryCache,
  libraryGetOneStrict,
  libraryPut,
} from "@/lib/stremio";
import { withItemLock } from "@/lib/stremio-item-lock";

type HistoryAccount = { authKey: string; profile: MembershipProfile };

export function isStremioHistoryAccountCurrent({ authKey, profile }: HistoryAccount): boolean {
  return !!authKey && isMembershipProfileCurrent(profile) && readActiveStremioAuthKey() === authKey;
}

export const HISTORY_PREVIOUS_ACCOUNT_MESSAGE =
  "Stremio cleared this title's history for the previous account. The active profile or account changed; the current view was kept.";

/** Stremio stores history on the title, so this clears its playback and watched state together. */
export async function clearStremioTitleHistory(request: {
  id: string;
  authKey: string;
  profile: MembershipProfile;
}): Promise<void> {
  const { id, authKey, profile } = request;
  if (!id.trim() || ANIME_CLOUD_ID.test(id)) {
    throw new Error("Clearing Stremio history is not supported for this title ID.");
  }
  const validateAccount = () => {
    if (!isStremioHistoryAccountCurrent({ authKey, profile })) {
      throw new Error("The active profile or Stremio account changed. Reopen the menu.");
    }
  };
  await withItemLock(id, async () => {
    validateAccount();
    const item = await libraryGetOneStrict(authKey, id);
    validateAccount();
    if (!item) throw new Error("This title is no longer in Stremio history.");
    if (!item.state) throw new Error("This title has no Stremio watch history to clear.");
    const state = {
      ...item.state,
      timeOffset: 0,
      timeWatched: 0,
      overallTimeWatched: 0,
      flaggedWatched: 0,
      timesWatched: 0,
      watched: "",
    };
    delete state.lastWatched;
    delete state.video_id;
    delete state.season;
    delete state.episode;
    // Keep removed/temp exactly as read: those fields control watchlist membership.
    await libraryPut(authKey, {
      ...item,
      state,
      manualWatched: false,
      _mtime: new Date().toISOString(),
    });
    invalidateLibraryCache();
    if (!isStremioHistoryAccountCurrent({ authKey, profile })) {
      throw new Error(HISTORY_PREVIOUS_ACCOUNT_MESSAGE);
    }
  });
}
