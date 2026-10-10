import { processSource } from './source-processing';
import { storedCatalog } from './source-catalog-query';
import { mergeRecentSourcePages, type RecentSourceQuery } from './source-recent-browse';
import { sourceRecentPreview } from './source-recent-preview';
import type { RecentSourceRelease } from './source-recent-selection';
import type { GameSource, SourceRecentPreview, SourceRelease } from './sources';
import type { ValidatedSource } from './source-store-format';

export type RecentPreviewPage = { source: GameSource; entries: SourceRecentPreview[]; total: number };

/** Rank across sources before reading file mirrors. A failed source is removed and healthy rows backfill it. */
export async function hydrateRecentPages(pages: RecentPreviewPage[], filters: RecentSourceQuery, limit: number, signal: AbortSignal,
  failed: (source: GameSource, error: unknown) => void) {
  let active = pages;
  const held = new Map<GameSource, Map<number, SourceRelease>>();
  for (;;) {
    signal.throwIfAborted();
    const selected = mergeRecentSourcePages(active, filters, limit), groups = new Map<GameSource, SourceRecentPreview[]>();
    // Empty selections still check stored versions rather than presenting obsolete cached absence.
    for (const page of active) groups.set(page.source, []);
    for (const item of selected.entries) groups.get(item.source)!.push(item.release);
    const rejected = new Set<GameSource>();
    for (const [source, previews] of groups) {
      signal.throwIfAborted();
      const cached = held.get(source) ?? new Map<number, SourceRelease>();
      const missing = previews.filter(item => !cached.has(item.row));
      if (previews.length && !missing.length) continue;
      const rows = missing.map(item => item.row).sort((a, b) => a - b);
      try {
        const ref = source.catalog;
        const entries = ref ? (await processSource({ kind: 'catalogRows', profile: ref.profile, catalog: storedCatalog(source), rows, ends: ref.storedEnds }, signal) as ValidatedSource).source.entries
          : rows.map(row => source.entries[row]);
        signal.throwIfAborted();
        if (entries.length !== rows.length) throw Error('source_storage');
        const expected = new Map(missing.map(item => [item.row, item]));
        entries.forEach((entry, index) => {
          const row = rows[index];
          if (!entry || JSON.stringify(sourceRecentPreview(entry, row)) !== JSON.stringify(expected.get(row))) throw Error('source_storage');
          cached.set(row, entry);
        });
        held.set(source, cached);
      } catch (error) {
        signal.throwIfAborted(); held.delete(source); rejected.add(source); failed(source, error);
      }
    }
    if (rejected.size) { active = active.filter(page => !rejected.has(page.source)); continue; }
    signal.throwIfAborted();
    const entries: RecentSourceRelease[] = selected.entries.map(item => ({ ...item, release: held.get(item.source)!.get(item.release.row)! }));
    return { entries, hasMore: selected.hasMore };
  }
}
