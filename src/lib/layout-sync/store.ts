import { loadEffective, persistEffective } from "@/lib/settings/profile-store";
import type { Settings } from "@/lib/settings";

/**
 * Injected by SettingsProvider, for the same reason the roster store is injected by
 * ProfilesProvider: the provider holds settings in React state and rewrites its own blob
 * on every change, so an external localStorage write to the ACTIVE profile is silently
 * clobbered on the next render. A write for any other profile is safe to do on disk,
 * because no live state is holding it.
 */
export type LayoutStore = {
  activeProfileId: () => string;
  isLinked: (profileId: string) => boolean;
  readActive: () => Settings;
  writeActive: (patch: Partial<Settings>) => void;
};

let store: LayoutStore | null = null;

export function configureLayoutStore(next: LayoutStore | null): void {
  store = next;
}

export function layoutWired(): boolean {
  return store != null;
}

export function readSettingsFor(profileId: string): Settings | null {
  if (!store) return null;
  if (profileId === store.activeProfileId()) return store.readActive();
  try {
    return loadEffective(profileId, store.isLinked(profileId));
  } catch {
    return null;
  }
}

/**
 * A LINKED profile resolves to harbor.settings.shared, so its layout genuinely belongs
 * to every other linked profile too. That is not a bug to route around here: it is what
 * settingsLinked means, and two linked profiles converging on one layout is correct.
 * Per-profile layouts only diverge once a profile is unlinked.
 */
export function writeSettingsFor(profileId: string, patch: Partial<Settings>): boolean {
  if (!store) return false;
  if (profileId === store.activeProfileId()) {
    store.writeActive(patch);
    return true;
  }
  try {
    const linked = store.isLinked(profileId);
    persistEffective({ ...loadEffective(profileId, linked), ...patch }, profileId, linked);
    return true;
  } catch {
    return false;
  }
}
