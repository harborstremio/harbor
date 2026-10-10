import { sourceDownloadTitle } from "./source-download-context";
import { sourcePlatformId } from "./source-platform";
import type { GameSource, SourceRelease, SourceRecentPreview } from "./sources";

export type RecentSourceRelease = { key: string; source: GameSource; release: SourceRelease; addedAt: number };
export const RECENT_SOURCE_LIMIT = 36;
const titleKey = (value: string) => value.normalize("NFKC").toLocaleLowerCase("en").replace(/[™®©]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function recentSourceKey(release: Omit<SourceRecentPreview, 'row'>) {
  // Keep platform editions distinct, including native desktop packages.
  const platform = sourcePlatformId(release.platform) ?? titleKey(release.platform ?? "");
  const game = release.igdbId ? "igdb:" + release.igdbId : release.steamId ? "steam:" + release.steamId : "title:" + titleKey(sourceDownloadTitle(release.title));
  return game + ":" + platform;
}

/** Source publication/upload dates only. Checking/importing a catalog is not a new release. */
export function recentSourceReleases(sources: readonly GameSource[], now = Date.now(), limit = RECENT_SOURCE_LIMIT): RecentSourceRelease[] {
  const recent: RecentSourceRelease[] = [];
  const cap = Math.max(0, Math.min(RECENT_SOURCE_LIMIT, Math.floor(limit)));
  if (!cap) return recent;
  for (const _ of collectRecent(sources, now, cap, recent)) { /* synchronous callers */ }
  return recent;
}

export function* collectRecent(sources: readonly GameSource[], now: number, cap: number, recent: RecentSourceRelease[]) {
  let checked = 0;
  for (const source of sources) {
    if (!source.enabled) continue;
    for (const release of source.entries) {
      if (++checked % 256 === 0) yield;
      const addedAt = Date.parse(release.date ?? "");
      if (release.kind !== "game" || !release.files.length || !Number.isFinite(addedAt) || addedAt > now || addedAt <= 0) continue;
      if (recent.length === cap && addedAt < recent[recent.length - 1].addedAt) continue;
      const key = recentSourceKey(release), existing = recent.findIndex(item => item.key === key);
      if (existing >= 0) {
        if (recent[existing].addedAt >= addedAt) continue;
        recent.splice(existing, 1);
      }
      const item = { key, source, release, addedAt };
      const index = recent.findIndex(other => other.addedAt < addedAt || other.addedAt === addedAt && other.key.localeCompare(key, "en") > 0);
      recent.splice(index < 0 ? recent.length : index, 0, item);
      if (recent.length > cap) recent.pop();
    }
  }
}
