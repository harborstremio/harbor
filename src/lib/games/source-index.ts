import { sourceDownloadTitle, sourceTitleKey } from './source-title';
import type { SourceOrigin } from './source-origin';
import type { SourceRelease } from './sources';
import { createSourceIndexCache } from './source-index-cache';

export type SourceIndex = { keys: Uint32Array; rows: Uint32Array };
const indexes = createSourceIndexCache();
export const sourceIndex = (entries: SourceRelease[]) => indexes.get(entries);
export function rememberSourceIndex(entries: SourceRelease[], index: SourceIndex) { indexes.remember(entries, index); }
function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

/** Compact candidate index only. Every candidate still goes through the full identity/platform matcher. */
function entryKeys(entries: SourceRelease[]): Uint32Array {
  const keys = new Uint32Array(entries.length * 2);
  for (let row = 0; row < entries.length; row++) {
    const entry = entries[row];
    if (entry.steamId || entry.igdbId) {
      const steam = entry.steamId ? hash('s:' + entry.steamId) : undefined;
      const igdb = entry.igdbId ? hash('i:' + entry.igdbId) : undefined;
      keys[row * 2] = steam ?? igdb!; keys[row * 2 + 1] = igdb ?? steam!;
    } else {
      const title = hash('t:' + sourceTitleKey(entry.title)), base = sourceDownloadTitle(entry.title);
      keys[row * 2] = title;
      keys[row * 2 + 1] = base === entry.title ? title : hash('t:' + sourceTitleKey(base));
    }
  }
  return keys;
}
function sortedIndex(keys: Uint32Array): SourceIndex {
  const order = Uint32Array.from(keys, (_, index) => index).sort((a, b) => keys[a] - keys[b] || a - b);
  return { keys: Uint32Array.from(order, position => keys[position]), rows: Uint32Array.from(order, position => position >>> 1) };
}

export function buildSourceIndex(entries: SourceRelease[]): SourceIndex { return sortedIndex(entryKeys(entries)); }

/** Chunked catalog validation retains numeric keys, never complete release records. */
export function sourceIndexBuilder() {
  let chunks: Uint32Array[] = [], length = 0;
  return {
    add(entries: SourceRelease[]) { const keys = entryKeys(entries); chunks.push(keys); length += keys.length; },
    finish(): SourceIndex {
      const keys = new Uint32Array(length); let offset = 0;
      for (const chunk of chunks) { keys.set(chunk, offset); offset += chunk.length; }
      chunks = []; length = 0;
      return sortedIndex(keys);
    },
  };
}

export function sourceIndexCandidates(index: SourceIndex, game: { name: string; steamId?: number; igdbId?: number; sourceOrigin?: SourceOrigin }) {
  const keys = [hash('t:' + sourceTitleKey(game.name))];
  if (game.steamId) keys.push(hash('s:' + game.steamId));
  if (game.igdbId) keys.push(hash('i:' + game.igdbId));
  if (game.sourceOrigin) {
    keys.push(hash('t:' + sourceTitleKey(game.sourceOrigin.title)));
    if (game.sourceOrigin.steamId) keys.push(hash('s:' + game.sourceOrigin.steamId));
    if (game.sourceOrigin.igdbId) keys.push(hash('i:' + game.sourceOrigin.igdbId));
  }
  const rows = new Set<number>();
  for (const key of keys) {
    let low = 0, high = index.keys.length;
    while (low < high) { const mid = (low + high) >>> 1; if (index.keys[mid] < key) low = mid + 1; else high = mid; }
    for (; low < index.keys.length && index.keys[low] === key; low++) rows.add(index.rows[low]);
  }
  return [...rows].sort((a, b) => a - b);
}
