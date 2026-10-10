import { useEffect, useRef, useState } from "react";
import { fetchProfileAlias, nameEquals, pushNameToProfileAlias } from "@/lib/account/name-sync";
import { createNameSyncSession } from "@/lib/account/name-sync-session";
import { bindNameSyncState } from "@/lib/account/name-sync-state";
import { useProfiles } from "@/lib/profiles";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { useTogether } from "@/lib/together/provider";

export function HarborNameSync() {
  const [author, setAuthor] = useState(currentAuthor);
  const { displayName, setDisplayName } = useTogether();
  const { activeProfile, updateProfile } = useProfiles();
  const latest = useRef({ displayName, activeProfile, setDisplayName, updateProfile });
  latest.current = { displayName, activeProfile, setDisplayName, updateProfile };
  const sessionRef = useRef<ReturnType<typeof createNameSyncSession> | null>(null);

  useEffect(() => subscribeAuthor(() => setAuthor(currentAuthor())), []);

  useEffect(() => {
    if (!author?.handle) return;
    const accountId = author.id;
    const handle = author.handle;
    const session = createNameSyncSession({
      name: latest.current.displayName,
      load: () => fetchProfileAlias(handle, accountId),
      save: (name) => pushNameToProfileAlias(name, accountId),
      apply: (alias) => {
        const current = latest.current;
        if (!nameEquals(alias, current.displayName)) current.setDisplayName(alias);
        if (
          current.activeProfile &&
          !current.activeProfile.kid &&
          !nameEquals(alias, current.activeProfile.name)
        ) {
          current.updateProfile(current.activeProfile.id, { name: alias });
        }
      },
      status: (phase) => binding.publish(phase),
    });
    const binding = bindNameSyncState(accountId, () => {
      void session.retry();
    });
    sessionRef.current = session;
    void session.start();
    return () => {
      session.dispose();
      binding.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [author?.id, author?.handle]);

  useEffect(() => {
    sessionRef.current?.update(displayName);
  }, [displayName]);

  return null;
}
