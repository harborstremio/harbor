import { useEffect, useRef } from "react";
import { useJlSession } from "@/lib/jl/account/client";
import { useJlKeySync } from "@/lib/jl/account/keys-sync";
import { autoLinkJlProfile, jlProfileContext, useJlLink, useJlSync } from "@/lib/jl/account/sync";
import { isPlaceholderName, useProfiles } from "@/lib/profiles";
import { configureJlProfileMetadata } from "@/lib/jl/account/profile-metadata";

/**
 * Keeps the signed-in JL Media Vision account and this device in step from anywhere in the app:
 * keys and IPTV logins for the account, favorites for the linked profile. An app profile that
 * isn't linked yet can bootstrap an empty account; existing profiles are selected by ID.
 */
export function JlAccountSync() {
  const profiles = useProfiles();
  const latest = useRef(profiles);
  latest.current = profiles;
  useEffect(() => {
    configureJlProfileMetadata({
      read: (id) => latest.current.profiles.find((profile) => profile.id === id) ?? null,
      write: (id, patch) => latest.current.updateProfile(id, patch),
    });
    return () => configureJlProfileMetadata(null);
  }, []);
  useJlSync();
  useJlKeySync();
  useJlAutoLink();
  return null;
}

function useJlAutoLink(): void {
  const session = useJlSession();
  const link = useJlLink();
  const { activeProfile } = useProfiles();
  const name =
    activeProfile && !isPlaceholderName(activeProfile.name) ? activeProfile.name.trim() : "";
  const avatar = activeProfile?.avatar ?? null;
  const userId = session?.userId ?? "";
  const linked = !!link;
  const localId = activeProfile?.id ?? "";

  useEffect(() => {
    if (!userId || linked || !name) return;
    const controller = new AbortController();
    const retry = () => {
      try {
        const context = jlProfileContext();
        if (context.account.userId !== userId || context.localId !== localId) return;
        void autoLinkJlProfile(name, avatar, { ...context, signal: controller.signal }).catch(
          () => {
            /* offline or stale selection: retry on reconnect/focus while this context is active */
          },
        );
      } catch {
        /* Signed out before the effect cleaned up. */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    retry();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, localId, linked, name, avatar]);
}
