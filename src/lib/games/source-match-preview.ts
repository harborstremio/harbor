import { sourceReleaseGroupKey, type SourceMatchPreview } from './source-groups';
import type { SourceRelease } from './sources';

export type StoredMatchPreview = Omit<SourceMatchPreview, 'source'>;

/** Only scalar display/matching fields cross the worker boundary while collapsed. */
export function sourceMatchMetadata(release: SourceRelease): SourceMatchPreview['release'] {
  return { id: release.id, title: release.title, sourcePage: release.sourcePage, steamId: release.steamId, igdbId: release.igdbId,
    platform: release.platform, version: release.version, date: release.date, size: release.size, kind: release.kind };
}

export async function sourceMatchSignature(release: SourceRelease): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceReleaseGroupKey(release)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
