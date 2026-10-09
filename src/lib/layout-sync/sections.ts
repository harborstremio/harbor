// Concrete modules, never the @/lib/profile-sync barrel. The barrel re-exports
// ProfileSyncRunner, which imports this layer's register module, so going through it
// would close a cycle whose only protection is evaluation order.
import { registerSection } from "@/lib/profile-sync/sections";
import { mergeWatchedBy, normalizeWatchedBy } from "@/lib/profile-sync/watched-by-merge";
import type { ProfileSectionKey, SectionAdapter } from "@/lib/profile-sync/types";
import { readWatchedByMap, replaceWatchedByMap } from "@/lib/watched-by";
import type { Settings } from "@/lib/settings";
import { layoutWired, readSettingsFor, writeSettingsFor } from "./store";

/**
 * Which Settings field each synced section carries. Only fields that live INSIDE the
 * settings blob are here. The install-global stores (pinned catalogs, page collection
 * rows, manga hidden rows, detail layout, per-page row configs) have no profile scope
 * at all on disk yet, so adapting them would sync one device's layout onto every
 * profile of every other device. They stay unregistered until they are scoped, and an
 * unregistered section is never transmitted and never applied.
 */
const SETTINGS_SECTIONS: Partial<Record<ProfileSectionKey, keyof Settings>> = {
  home: "homeRows",
  anime: "animeRows",
  nav: "navCustomization",
  services: "streaming",
};

/**
 * Returning null rather than a default means "this device has nothing to say", which the
 * engine treats as structurally empty and holds instead of pushing. That matters: an
 * adapter that answered with DEFAULT_SETTINGS.homeRows while the store was still loading
 * would look like a deliberate reset and overwrite the account.
 */
function settingsSection(field: keyof Settings): SectionAdapter {
  return {
    read: (profileId) => {
      if (!layoutWired()) return null;
      return readSettingsFor(profileId)?.[field] ?? null;
    },
    write: (profileId, value) => {
      if (!layoutWired()) return false;
      if (value == null || typeof value !== "object" || Array.isArray(value)) return false;
      return writeSettingsFor(profileId, { [field]: value } as Partial<Settings>);
    },
  };
}

/**
 * The one section that merges per key instead of replacing whole. Two devices writing
 * different mediaIds never collide, and two writing the same one genuinely do have a
 * later watcher.
 */
const watchedBySection: SectionAdapter = {
  read: () => readWatchedByMap(),
  write: (_profileId, value) => {
    replaceWatchedByMap(normalizeWatchedBy(value));
    return true;
  },
  merge: (local, incoming) => mergeWatchedBy(local, incoming),
};

export function registerLayoutSections(): void {
  for (const [section, field] of Object.entries(SETTINGS_SECTIONS)) {
    if (!field) continue;
    registerSection(section as ProfileSectionKey, settingsSection(field));
  }
  registerSection("watchedby", watchedBySection);
}

/** The settings fields a change to which must mark a section dirty. */
export const SYNCED_SETTINGS_FIELDS = Object.entries(SETTINGS_SECTIONS).map(
  ([section, field]) => [section as ProfileSectionKey, field as keyof Settings] as const,
);
