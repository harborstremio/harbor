import type { RegistryEntry, RegistryEntryFile } from "./types";

const NONE: Record<string, RegistryEntry> = {};

let loaded: Record<string, RegistryEntry> | null = null;
let inflight: Promise<Record<string, RegistryEntry>> | null = null;

export function loadRegistryEntries(): Promise<Record<string, RegistryEntry>> {
  if (loaded) return Promise.resolve(loaded);
  if (inflight) return inflight;
  inflight = import("@/data/film-registry/entries.json?raw")
    .then((mod) => {
      const file = JSON.parse(mod.default) as RegistryEntryFile;
      loaded = file?.entries ?? NONE;
      return loaded;
    })
    .catch(() => NONE)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function registryEntriesNow(): Record<string, RegistryEntry> | null {
  return loaded;
}
