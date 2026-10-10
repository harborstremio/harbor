import { useSyncExternalStore } from "react";
import {
  jlAccountContext,
  jlRest,
  jlStorage,
  jlStorageUrl,
  subscribeJlSession,
} from "@/lib/jl/account/client";
import { createCustomArtStore, resolveArt, type ArtKind } from "./custom-art";

/**
 * Owner-curated sports art: the first choice for a team's, athlete's or college's art, ahead of
 * TheSportsDB and the designed backdrop. Keys follow JL Media Vision's web app
 * ("team:<league>:<espnId>", ...). The art is the signed-in JL account's own (custom-art.ts);
 * signed out, every lookup answers null and the views fall through to the other sources.
 */

export const artKey = {
  team: (league: string, espnId: string) => `team:${league.toLowerCase()}:${espnId}`,
  athlete: (league: string, espnId: string) => `athlete:${league.toLowerCase()}:${espnId}`,
  student: (site: string, sport: string, id: string) => `student:${site}:${sport}:${id}`,
  college: (id: string) => `college:${id}`,
};

export const customArt = createCustomArtStore({
  context: jlAccountContext,
  rest: jlRest,
  storage: jlStorage,
  storageUrl: jlStorageUrl,
  subscribe: subscribeJlSession,
});

/**
 * The curated image URL for an art key and slot, or null when none is set. A missing story,
 * card or wallpaper borrows the hero; a missing wordmark stays null (the name is set instead).
 */
export function curatedArt(key: string, kind: ArtKind = "hero"): string | null {
  return resolveArt(customArt.url, key, kind)?.url ?? null;
}

/** Like curatedArt, and whether the picture was borrowed from the hero (crop to its subject). */
export function curatedArtSlot(
  key: string,
  kind: ArtKind,
): { url: string; borrowed: boolean } | null {
  return resolveArt(customArt.url, key, kind);
}

/** Re-renders the caller when the owner's art loads or changes. */
export function useCuratedArtVersion(): number {
  return useSyncExternalStore(customArt.subscribe, customArt.version, customArt.version);
}
