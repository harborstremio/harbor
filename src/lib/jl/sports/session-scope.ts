import { useSyncExternalStore } from "react";
import { activeProfileId } from "@/lib/active-profile-id";
import { useJlSession } from "@/lib/jl/account/client";
import { sportsSessionKey } from "./presentation";

function subscribeProfile(change: () => void): () => void {
  window.addEventListener("harbor:active-profile-changed", change);
  return () => window.removeEventListener("harbor:active-profile-changed", change);
}

/** Sports viewing history and ephemeral alerts follow the active JL account and profile. */
export function useSportsSessionScope(): string {
  const session = useJlSession();
  const profile = useSyncExternalStore(subscribeProfile, activeProfileId, () => "main");
  return sportsSessionKey(session?.userId, profile);
}
