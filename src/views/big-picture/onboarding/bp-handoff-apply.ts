import { useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { fetchMe } from "@/lib/account/identity";
import { useSettings } from "@/lib/settings";
import { applyAuthResult, currentAuthor, logoutAuthor } from "@/lib/theme-auth";
import type { HandoffPayload } from "@/lib/tv-handoff/handoff-protocol";

/**
 * Turns a delivery from the phone into live state on this TV. The transport
 * hands these up already bound to a claimed client, so the only job here is to
 * put each value where the rest of Harbor reads it. Throwing refuses the step,
 * which the phone sees as `applyFailed` and can retry.
 */
export function useHandoffApply(): (payload: HandoffPayload) => Promise<void> {
  const { update } = useSettings();
  const { signInWithKey } = useAuth();

  return useCallback(
    async (payload: HandoffPayload) => {
      if (payload.step === "tmdb") {
        update({ tmdbKey: payload.key.trim() });
        return;
      }
      if (payload.step === "stremio") {
        await signInWithKey(payload.authKey);
        return;
      }
      // The public account API can only apply a token onto an existing session,
      // so a provisional record carries the token in and fetchMe replaces it.
      applyAuthResult({
        token: payload.session,
        refresh: payload.refresh ?? null,
        user: { id: "", username: payload.handle, handle: payload.handle },
      });
      await fetchMe().catch(() => {});
      // fetchMe swallows its own failure, so the id is the only evidence it
      // worked. Keeping a session with no user id would leave the TV reporting
      // a linked account against a record nothing downstream can use, and
      // repairCopiedSessions skips exactly that shape.
      if (!currentAuthor()?.id) {
        await logoutAuthor().catch(() => {});
        throw new Error("harbor session did not hydrate");
      }
    },
    [update, signInWithKey],
  );
}
