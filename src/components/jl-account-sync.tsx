import { useEffect } from "react";
import { useJlSession } from "@/lib/jl/account/client";
import { useJlKeySync } from "@/lib/jl/account/keys-sync";
import { createJlProfile, linkJlProfile, listJlProfiles, useJlLink, useJlSync } from "@/lib/jl/account/sync";
import { isPlaceholderName, useProfiles } from "@/lib/profiles";

/**
 * Keeps the signed-in JL Media Vision account and this device in step from anywhere in the app:
 * keys and IPTV logins for the account, favorites for the linked profile. An app profile that
 * isn't linked yet joins the account profile with the same name, or creates it.
 */
export function JlAccountSync() {
  useJlSync();
  useJlKeySync();
  useJlAutoLink();
  return null;
}

function useJlAutoLink(): void {
  const session = useJlSession();
  const link = useJlLink();
  const { activeProfile } = useProfiles();
  const name = activeProfile && !isPlaceholderName(activeProfile.name) ? activeProfile.name.trim() : "";
  const avatar = activeProfile?.avatar ?? null;
  const userId = session?.userId ?? "";
  const linked = !!link;

  useEffect(() => {
    if (!userId || linked || !name) return;
    let cancelled = false;
    void (async () => {
      try {
        const profiles = await listJlProfiles();
        if (cancelled) return;
        const match = profiles.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
        linkJlProfile(match ?? (await createJlProfile(name, avatar)));
      } catch {
        /* offline: the next sign-in or profile change tries again */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, linked, name, avatar]);
}
