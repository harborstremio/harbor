import { registerRosterSection } from "@/lib/profile-sync/roster-section";
import { registerLayoutSections } from "./sections";

// Imported for side effect by ProfileSyncRunner. A section whose adapter never
// registers is never transmitted and never applied, so forgetting this import is a
// silent no-sync rather than an error.
//
// Guarded because module side effects run once per module instance and Vite's HMR
// hands out a fresh instance on every edit.
let done = false;

export function registerAllSyncSections(): void {
  if (done) return;
  done = true;
  registerRosterSection();
  registerLayoutSections();
}

registerAllSyncSections();
