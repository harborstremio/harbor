import { sourceAlertMatch, type SourceAlertWatch } from "./source-alerts";
import type { GameSource, SourceManifest, SourceRelease } from "./sources";

export const SOURCE_ALERT_INTERVAL = 30 * 60_000;
type WebsiteResult = { entries: SourceRelease[]; next: number | null };
export type SourceAlertFeed = {
  catalog: (source: GameSource, signal: AbortSignal) => Promise<SourceManifest>;
  website: (source: GameSource, name: string, page: number, signal: AbortSignal) => Promise<WebsiteResult>;
  stored?: (source: GameSource, game: SourceAlertWatch["game"], signal: AbortSignal) => Promise<SourceRelease[]>;
  yield: () => Promise<void>;
};

/** One catalog read serves every watch. Yield bounded batches; never scan or fetch per card. */
export async function checkSourceAlerts(watches: SourceAlertWatch[], sources: GameSource[], feed: SourceAlertFeed, signal: AbortSignal, found: (watch: SourceAlertWatch, source: GameSource, release: SourceRelease) => Promise<void>, cursors = new Map<string, number>(), now = Date.now()) {
  const pending = new Map(watches.filter(watch => watch.foundAt === undefined).map(watch => [watch.id, watch]));
  let failed = false;
  for (const source of sources.filter(source => source.enabled)) {
    signal.throwIfAborted();
    if (!pending.size) break;
    try {
      if (source.catalogIssue) throw Error('source_storage');
      if (source.website) {
        for (const watch of [...pending.values()]) {
          const key = JSON.stringify([source.id, source.url, watch.id]);
          // Always revisit the newest page, then continue a large search on later checks.
          let page: number | null = 1;
          for (let budget = 0; page !== null && budget < 4; budget++) {
            const result = await feed.website(source, watch.game.name, page, signal);
            signal.throwIfAborted();
            const release = result.entries.find(item => sourceAlertMatch(item, watch.game));
            if (release) { await found(watch, source, release); pending.delete(watch.id); cursors.delete(key); break; }
            page = page === 1 && result.next !== null ? Math.max(result.next, cursors.get(key) ?? 2) : result.next;
            if (page === null) cursors.delete(key); else cursors.set(key, page);
            await feed.yield(); signal.throwIfAborted();
          }
        }
      } else {
        const fresh = !source.error && source.checkedAt <= now && now - source.checkedAt < SOURCE_ALERT_INTERVAL;
        if (fresh && source.catalog) {
          if (!feed.stored) throw Error('source_storage');
          for (const watch of [...pending.values()]) {
            const releases = await feed.stored(source, watch.game, signal); signal.throwIfAborted();
            const release = releases.find(item => sourceAlertMatch(item, watch.game));
            if (release) { await found(watch, source, release); pending.delete(watch.id); }
          }
          continue;
        }
        const catalog = fresh ? source : await feed.catalog(source, signal);
        signal.throwIfAborted();
        const batch = Math.max(1, Math.min(200, Math.floor(500 / pending.size)));
        for (let start = 0; start < catalog.entries.length && pending.size; start += batch) {
          for (const release of catalog.entries.slice(start, start + batch)) for (const watch of pending.values()) {
            if (sourceAlertMatch(release, watch.game)) { await found(watch, source, release); pending.delete(watch.id); }
          }
          await feed.yield(); signal.throwIfAborted();
        }
      }
    } catch (error) { if (signal.aborted) throw error; failed = true; }
  }
  return { pending: [...pending.keys()], failed };
}
