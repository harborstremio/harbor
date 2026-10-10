import { activeProfileId } from "../active-profile-id";
import { hydrateListeningAffinity, readListeningAffinity } from "./listening-affinity";
import { cachedLocalJson, readLocalJson, writeLocalJson } from "./local-store";
import { musicTrackIdentity } from "./track-identity";
import type { MusicTrack } from "./types";

type PreviewHistory = Record<string, number>;
const store = (profile: string) => `snippets-${profile.replace(/[^a-z0-9._-]/gi, "_")}`;

export async function hydrateSnippetHistory(profile = activeProfileId()): Promise<void> {
  await Promise.all([hydrateListeningAffinity(profile), readLocalJson(store(profile))]);
}

export function snippetHeardKeys(profile = activeProfileId()): Set<string> {
  return new Set([
    ...Object.keys(readListeningAffinity(profile)),
    ...Object.keys(cachedLocalJson<PreviewHistory>(store(profile)) ?? {}),
  ]);
}

/** Seen/skipped cards retire from future previews without counting as full-song plays or taste. */
export function recordSnippetsSeen(tracks: readonly MusicTrack[], profile = activeProfileId()): void {
  const previous = cachedLocalJson<PreviewHistory>(store(profile)) ?? {};
  const keys = tracks.map(musicTrackIdentity).filter(key => !Object.hasOwn(previous, key));
  if (!keys.length) return;
  const rows = { ...previous, ...Object.fromEntries(keys.map(key => [key, Date.now()])) };
  writeLocalJson(store(profile), Object.fromEntries(Object.entries(rows).sort((a, b) => b[1] - a[1]).slice(0, 5000)));
}
