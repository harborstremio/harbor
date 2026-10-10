import { SOURCE_MAX_ENTRIES, type GameSource, type SourceRelease } from './sources';
import { sourceEntryLayoutBuilder, type ValidatedSource } from './source-store-format';
import { validateSourceStore } from './source-store-validation';
import { sourceIndexBuilder } from './source-index';
import { collectRecent, RECENT_SOURCE_LIMIT, type RecentSourceRelease } from './source-recent-selection';
import { sourceRecentPreview } from './source-recent-preview';

/** A cold summary holds one validated chunk, IDs, numeric keys and 36 recent releases. */
export function catalogSummaryCollector(source: Omit<GameSource, 'entries'>, now: number) {
  if (!Number.isFinite(now)) throw Error('source_storage');
  const header = validateSourceStore([{ ...source, entries: [] }])[0];
  const ids = new Map<string, number>(), layout = sourceEntryLayoutBuilder(), index = sourceIndexBuilder();
  const storedEnds: number[] = [], recent: RecentSourceRelease[] = [];
  let count = 0, recentUntil = Infinity;
  return {
    add(raw: SourceRelease[]) {
      if (!Array.isArray(raw) || !raw.length || count + raw.length > SOURCE_MAX_ENTRIES) throw Error('source_storage');
      const entries = validateSourceStore([{ ...header, entries: raw }])[0].entries;
      for (const [row, entry] of entries.entries()) {
        if (ids.has(entry.id)) throw Error('source_storage');
        ids.set(entry.id, count + row);
        const at = Date.parse(entry.date ?? '');
        if (entry.kind === 'game' && at > now) recentUntil = Math.min(recentUntil, at);
      }
      layout.add(entries); index.add(entries);
      for (const _ of collectRecent([{ ...header, enabled: true, entries }], now, RECENT_SOURCE_LIMIT, recent)) { /* worker-side scan */ }
      // Recent selections must not keep their containing chunk alive through source.entries.
      for (const item of recent) item.source = header;
      count += entries.length; storedEnds.push(count);
    },
    finish() {
      const value: ValidatedSource = { source: header, layout: layout.finish(), storedEnds,
        recent: recent.map(item => sourceRecentPreview(item.release, ids.get(item.release.id)!)), recentAt: now, recentUntil };
      return { value, index: index.finish() };
    },
  };
}
