import { SOURCE_MAX_ENTRIES, SOURCE_CATALOG_MAX_BYTES, type GameSource, type SourceRelease } from './sources';
import { SOURCE_CHUNK_BYTES, sourceEntryLayout, type ValidatedSource } from './source-store-format';
import { validateSourceStore } from './source-store-validation';
import { sourceTitleIndexBuilder } from './source-title-index';
import { recentSourceRowCollector, type RecentSourceQuery } from './source-recent-browse';

/** Keeps only requested releases, row numbers, IDs and bounded normalized titles.
 * Validation still covers every entry, including duplicate IDs across chunks. */
export function catalogBrowseCollector(source: Omit<GameSource, 'entries'>, query: string, limit: number, recent?: RecentSourceQuery) {
  if (typeof query !== 'string' || query.length > 500 || !Number.isSafeInteger(limit) || limit < 0 || limit > SOURCE_MAX_ENTRIES) throw Error('source_storage');
  const header = validateSourceStore([{ ...source, entries: [] }])[0], needle = query.trim().toLocaleLowerCase();
  const selected: SourceRelease[] = [], rows: number[] = [], storedEnds: number[] = [], ids = new Set<string>(), titles = sourceTitleIndexBuilder();
  let count = 0, bytes = 2;
  const recents = recent ? recentSourceRowCollector(recent) : undefined;
  return {
    add(raw: SourceRelease[]) {
      if (!Array.isArray(raw) || !raw.length || count + raw.length > SOURCE_MAX_ENTRIES) throw Error('source_storage');
      const entries = validateSourceStore([{ ...header, entries: raw }])[0].entries;
      const layout = sourceEntryLayout(entries);
      if (layout.bytes > SOURCE_CHUNK_BYTES) throw Error('source_limit');
      bytes += layout.bytes - 2 + (count ? 1 : 0);
      if (bytes > SOURCE_CATALOG_MAX_BYTES) throw Error('source_limit');
      for (const entry of entries) {
        if (ids.has(entry.id)) throw Error('source_storage');
        ids.add(entry.id);
        if (recents) recents.add(entry, count);
        else titles.add(entry.title);
        if (!recents && entry.title.toLocaleLowerCase().includes(needle)) {
          rows.push(count);
          if (selected.length < limit) selected.push(entry);
        }
        count++;
      }
      storedEnds.push(count);
    },
    finish(): ValidatedSource {
      if (recents) {
        const browseRows = recents.finish();
        return {source:{...header,entries:[]},layout:sourceEntryLayout([]),storedEnds,total:browseRows.length,browseRows};
      }
      return { source: { ...header, entries: selected }, layout: sourceEntryLayout(selected), storedEnds, total: rows.length, browseRows: Uint32Array.from(rows), browseTitles: titles.finish() };
    },
  };
}
