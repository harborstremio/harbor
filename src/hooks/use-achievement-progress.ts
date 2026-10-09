import { useEffect, useState } from "react";
import type { SteamAccount } from "./use-steam-account";
import { steamAccountError, type SteamAchievements } from "@/lib/games/steam-account";

type Progress = { identity: string; personal: SteamAchievements | null; reading: boolean; reason: string; notOwned: boolean };

/** Read-only progress shared by the detail preview and public achievement list. */
export function useAchievementProgress(appId: number, profile: string, account?: SteamAccount, active = true, attempt = 0) {
  const linkedId = account?.status.connected ? account.status.snapshot?.steamId : undefined;
  const readLinked = account?.achievements;
  const identity = JSON.stringify([profile, appId, linkedId ?? null]);
  const [progress, setProgress] = useState<Progress | null>(null);
  useEffect(() => {
    if (!active) return;
    let current = true;
    setProgress({ identity, personal: null, reading: true, reason: "", notOwned: false });
    void (async () => {
      let personal: SteamAchievements | null = null, reason = "", notOwned = false;
      // Never initialize the native Steam client while browsing: connecting with
      // a game's app ID can update Steam presence, playtime and Recent Games.
      if (current && !personal && linkedId && readLinked) {
        // The linked-account web request does not create a game session.
        notOwned = false; reason = "";
        try {
          const linked = await readLinked(appId);
          if (linked.appId === appId && linked.steamId === linkedId) personal = linked;
        } catch (error) {
          notOwned = error === "steam_account_not_owned";
          reason = steamAccountError(error);
        }
      }
      if (current) setProgress({ identity, personal, reading: false, reason: personal ? "" : reason, notOwned });
    })();
    return () => { current = false; };
  }, [appId, profile, identity, linkedId, readLinked, active, attempt]);
  // Never show the previous game's/account's earned state during an identity change.
  return progress?.identity === identity ? progress : { personal: null, reading: active, reason: "", notOwned: false };
}
