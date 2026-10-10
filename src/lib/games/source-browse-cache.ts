import { SOURCE_MAX_ENTRIES } from './sources';

const MAX_BYTES = 4 * 1024 * 1024, MAX_QUERIES = 32, MAX_AGE = 120_000;

/** Only row numbers survive between requests; game records stay on disk. */
export function createSourceBrowseCache(allowReorderedRows = false, maxQueries = MAX_QUERIES) {
  let profile = '', generation = 0, bytes = 0;
  const queries = new Map<string, { rows: Uint32Array; at: number }>();
  const remove = (key: string) => {
    const item = queries.get(key);
    if (item) { bytes -= item.rows.byteLength; queries.delete(key); }
  };
  return {
    select(next: string) {
      if (next !== profile) { profile = next; generation++; queries.clear(); bytes = 0; }
      return generation;
    },
    get(token: number, key: string, now = Date.now()) {
      if (token !== generation) return;
      const item = queries.get(key);
      if (!item) return;
      if (!Number.isFinite(now) || now < item.at || now - item.at >= MAX_AGE) { remove(key); return; }
      queries.delete(key); queries.set(key, item);
      return item.rows;
    },
    put(token: number, key: string, rows: Uint32Array, count: number, now = Date.now()) {
      // Late work from a previous profile must not repopulate the active cache.
      if (token !== generation || !(rows instanceof Uint32Array) || !Number.isSafeInteger(count) || count < 0 || count > SOURCE_MAX_ENTRIES || rows.length > count || rows.byteLength > MAX_BYTES || !Number.isFinite(now)) return;
      for (let i = 0; i < rows.length; i++) if (rows[i] >= count || !allowReorderedRows && i > 0 && rows[i] <= rows[i - 1]) return;
      if (allowReorderedRows && new Set(rows).size !== rows.length) return;
      remove(key); queries.set(key, { rows, at: now }); bytes += rows.byteLength;
      while (queries.size > maxQueries || bytes > MAX_BYTES) remove(queries.keys().next().value!);
    },
    remove(token: number, key: string) { if (token === generation) remove(key); },
  };
}
