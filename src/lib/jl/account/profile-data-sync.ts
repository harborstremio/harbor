import { jlRest, type JlAccountContext } from "./client";
import { sameValue, syncProfileDocument } from "./document-sync";
import { applyProfileData, readProfileData, validateProfileData } from "./profile-data";
import { readSettingsFor, writeSettingsFor } from "@/lib/layout-sync/store";
import type { Settings } from "@/lib/settings";
import { createProfileDocumentRemote } from "./profile-data-remote";
import { readJlProfileMetadata, writeJlProfileMetadata, type JlProfileMetadata } from "./profile-metadata";

/** Uses the existing media.profiles.settings column. Conditional PATCH makes each revision atomic. */
export async function syncJlProfileData(scope: { account: JlAccountContext; localId: string; profileId: string; assertCurrent: () => void }): Promise<number> {
  const key = `jl.account.data.base.v1.${scope.account.userId}.${scope.localId}.${scope.profileId}`;
  const remote = createProfileDocumentRemote((path, init) => {
    scope.assertCurrent();
    return jlRest(path, init, scope.account);
  }, scope.profileId, scope.account.userId);
  const settings = () => {
    const value = readSettingsFor(scope.localId);
    if (!value) throw new Error("JL settings are not ready");
    return value as unknown as Record<string, unknown>;
  };
  await syncProfileDocument({
    assertCurrent: scope.assertCurrent,
    readLocal: () => readProfileData(localStorage, scope.localId, settings(), readJlProfileMetadata(scope.localId)),
    readBase: () => {
      const raw = localStorage.getItem(key);
      return raw ? validateProfileData(JSON.parse(raw)) : null;
    },
    checkpoint: (values) => localStorage.setItem(key, JSON.stringify(values)),
    conflicts: (conflicts) => {
      const conflictKey = key + ".conflicts";
      const existing = JSON.parse(localStorage.getItem(conflictKey) ?? "[]") as unknown[];
      localStorage.setItem(conflictKey, JSON.stringify([...existing, ...conflicts].slice(-100)));
    },
    apply: (values, expected) => {
      const metadata = readJlProfileMetadata(scope.localId);
      const patch = applyProfileData(localStorage, scope.localId, values, expected, settings(), metadata);
      if (!writeSettingsFor(scope.localId, patch as Partial<Settings>)) throw new Error("JL settings could not be applied");
      const metaPatch: Partial<JlProfileMetadata> = {};
      for (const field of ["name", "color"] as const) {
        const value = values[`profile:${field}`];
        if (typeof value === "string" && sameValue(metadata[field], expected[`profile:${field}`]) && value !== metadata[field]) metaPatch[field] = value;
      }
      if (Object.keys(metaPatch).length) writeJlProfileMetadata(scope.localId, metaPatch);
      window.dispatchEvent(new CustomEvent("jl:profile-data-applied", { detail: { profileId: scope.localId } }));
    },
    pull: remote.pull,
    compareAndSwap: remote.compareAndSwap,
  });
  const conflicts = JSON.parse(localStorage.getItem(key + ".conflicts") ?? "[]") as unknown;
  return Array.isArray(conflicts) ? conflicts.length : 0;
}
