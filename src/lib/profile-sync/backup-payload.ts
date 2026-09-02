import { readIdMap } from "./id-map";
import { allParked } from "./parked";
import { boundAccount, lastPullAt, readRevs } from "./revs";
import { queueEntries } from "./queue";
import { readLocalRoster } from "./roster-store";
import { registeredAccountSections, registeredProfileSections, sectionAdapter } from "./sections";

export type SyncBackup = {
  account: string;
  lastPullAt: number;
  revs: Record<string, number>;
  idMap: Record<string, string>;
  queued: string[];
  parked: Array<{ key: string; value: unknown; parkedAt: number }>;
  sections: Record<string, unknown>;
};

/**
 * A10. The server side of this store must not become the only copy of a household's
 * customisation, which is the standing wound on the :8799 community sync service. This
 * is the client half of that promise and it does not depend on the server operator.
 *
 * buildBackup() in lib/backup.ts is NOT a template for the wire payload: isPortable()
 * copies debrid keys and cleartext IPTV passwords, which is correct for a same machine
 * backup and catastrophic cross device. This runs in the other direction, so it is safe.
 */
export function buildSyncBackup(): SyncBackup {
  const sections: Record<string, unknown> = {};
  for (const section of registeredAccountSections()) {
    const adapter = sectionAdapter(section);
    if (!adapter) continue;
    try {
      sections[`account:${section}`] = adapter.read("");
    } catch {
      /* a section that cannot be read is left out rather than exported as null */
    }
  }
  for (const profile of readLocalRoster()) {
    for (const section of registeredProfileSections()) {
      const adapter = sectionAdapter(section);
      if (!adapter) continue;
      try {
        sections[`${profile.id}:${section}`] = adapter.read(profile.id);
      } catch {
        /* same */
      }
    }
  }
  return {
    account: boundAccount(),
    lastPullAt: lastPullAt(),
    revs: readRevs(),
    idMap: readIdMap(),
    queued: queueEntries().map((e) => e.key),
    parked: allParked().map((p) => ({ key: p.key, value: p.value, parkedAt: p.parkedAt })),
    sections,
  };
}
