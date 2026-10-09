import { SOURCE_MAX_ENTRIES, type SourceRelease } from './sources';

export const SOURCE_TITLE_INDEX_BYTES = 16 * 1024 * 1024;
export type SourceTitleIndex = { text: string; ends: Uint32Array };

export function validSourceTitleIndex(value: unknown): value is SourceTitleIndex {
  const index = value as SourceTitleIndex | undefined;
  if (!index || typeof index.text !== 'string' || !(index.ends instanceof Uint32Array) || index.ends.length > SOURCE_MAX_ENTRIES || index.text.length * 2 + index.ends.byteLength > SOURCE_TITLE_INDEX_BYTES || (index.ends.at(-1) ?? 0) !== index.text.length) return false;
  for (let i = 0; i < index.ends.length; i++) if (index.ends[i] <= (index.ends[i - 1] ?? 0)) return false;
  return true;
}

/** The active catalog keeps only normalized titles, never files or release objects. */
export function buildSourceTitleIndex(entries: SourceRelease[]): SourceTitleIndex | undefined {
  if (entries.length > SOURCE_MAX_ENTRIES) return;
  const builder = sourceTitleIndexBuilder();
  for (const entry of entries) builder.add(entry.title);
  return builder.finish();
}

/** Chunked scans retain title text only; exceeding the budget drops it all. */
export function sourceTitleIndexBuilder() {
  let titles: string[] = [], ends: number[] = [], length = 0, count = 0, overflow = false;
  return {
    add(value: string) {
      if (overflow) return;
      const title = value.toLocaleLowerCase(); length += title.length; count++;
      if (!title.length || count > SOURCE_MAX_ENTRIES || length * 2 + count * 4 > SOURCE_TITLE_INDEX_BYTES) {
        overflow = true; titles = []; ends = []; return;
      }
      titles.push(title); ends.push(length);
    },
    finish(): SourceTitleIndex | undefined { return overflow ? undefined : { text: titles.join(''), ends: Uint32Array.from(ends) }; },
  };
}

export function searchSourceTitleIndex(index: SourceTitleIndex, query: string): Uint32Array {
  if (!validSourceTitleIndex(index) || typeof query !== 'string' || query.length > 500) throw Error('source_storage');
  const needle = query.trim().toLocaleLowerCase(), rows: number[] = [];
  let start = 0;
  for (let row = 0; row < index.ends.length; row++) {
    const end = index.ends[row];
    if (index.text.slice(start, end).includes(needle)) rows.push(row);
    start = end;
  }
  return Uint32Array.from(rows);
}

/** One catalog, fixed two-minute lifetime, with late-result protection. */
export function createSourceTitleCache() {
  let key = '', generation = 0, saved: { index: SourceTitleIndex; at: number } | undefined;
  return {
    select(next: string) { if (key !== next) { key = next; generation++; saved = undefined; } return generation; },
    get(token: number, now = Date.now()) {
      if (token !== generation) return;
      if (saved && (!Number.isFinite(now) || now < saved.at || now - saved.at >= 120_000)) saved = undefined;
      return saved?.index;
    },
    put(token: number, index: SourceTitleIndex, count: number, now = Date.now()) {
      if (token === generation && Number.isFinite(now) && validSourceTitleIndex(index) && index.ends.length === count) saved = { index, at: now };
    },
    remove(token: number) { if (token === generation) saved = undefined; },
  };
}
