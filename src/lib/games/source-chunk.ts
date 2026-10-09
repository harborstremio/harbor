import { SOURCE_MAX_ENTRIES, type SourceRelease } from './sources';
import { SOURCE_CHUNK_BYTES } from './source-store-format';
import { sourceByteSize } from './source-byte-size';

const PAGE_ENTRIES = 256;
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
type PackedChunk = { encoding: 'utf8-json-pages'; version: 1; count: number; ends: Uint32Array; data: Uint8Array };

/** Keep the existing logical chunk boundaries; only its physical encoding changes. */
export function encodeSourceChunk(entries: SourceRelease[]): PackedChunk {
  if (!entries.length || entries.length > SOURCE_MAX_ENTRIES) throw Error('source_storage');
  const pageCount = Math.ceil(entries.length / PAGE_ENTRIES), ends = new Uint32Array(pageCount), pages: Uint8Array[] = [];
  // Concatenating page arrays adds one byte per boundary versus one JSON array.
  const limit = SOURCE_CHUNK_BYTES + pageCount - 1;
  let bytes = 0;
  for (let page = 0; page < pageCount; page++) {
    const text = JSON.stringify(entries.slice(page * PAGE_ENTRIES, (page + 1) * PAGE_ENTRIES));
    if (sourceByteSize(text, limit - bytes) > limit - bytes) throw Error('source_limit');
    const data = encoder.encode(text); bytes += data.byteLength; ends[page] = bytes; pages.push(data);
  }
  const data = new Uint8Array(bytes); let offset = 0;
  for (const page of pages) { data.set(page, offset); offset += page.byteLength; }
  return { encoding: 'utf8-json-pages', version: 1, count: entries.length, ends, data };
}

function packedChunk(value: unknown): PackedChunk {
  const item = value as PackedChunk | null;
  if (!item || item.encoding !== 'utf8-json-pages' || item.version !== 1 || !Number.isSafeInteger(item.count) || item.count < 1 || item.count > SOURCE_MAX_ENTRIES || !(item.ends instanceof Uint32Array) || !(item.data instanceof Uint8Array)) throw Error('source_storage');
  if (item.ends.length !== Math.ceil(item.count / PAGE_ENTRIES) || item.ends.byteOffset || item.data.byteOffset || item.ends.buffer.byteLength !== item.ends.byteLength || item.data.buffer.byteLength !== item.data.byteLength || item.data.byteLength > SOURCE_CHUNK_BYTES + item.ends.length - 1 || item.ends.at(-1) !== item.data.byteLength) throw Error('source_storage');
  for (let page = 0; page < item.ends.length; page++) if (item.ends[page] <= (item.ends[page - 1] ?? 0)) throw Error('source_storage');
  return item;
}

export function sourceChunkCount(value: unknown): number {
  if (Array.isArray(value)) {
    if (value.length > SOURCE_MAX_ENTRIES) throw Error('source_storage');
    return value.length;
  }
  return packedChunk(value).count;
}

/** Legacy arrays remain readable. Packed records decode only requested pages;
 * callers still validate the returned releases against their source contract. */
export function decodeSourceChunk(value: unknown, rows?: readonly number[]): SourceRelease[] {
  const count = sourceChunkCount(value);
  if (rows && rows.some((row, i) => !Number.isSafeInteger(row) || row < 0 || row >= count || i > 0 && row <= rows[i - 1])) throw Error('source_storage');
  if (Array.isArray(value)) return rows ? rows.map(row => value[row]) : value;
  const item = value as PackedChunk, result: SourceRelease[] = [];
  const pages = rows ? [...new Set(rows.map(row => Math.floor(row / PAGE_ENTRIES)))] : Array.from({ length: item.ends.length }, (_, page) => page);
  let selected = 0;
  try {
    for (const page of pages) {
      const entries: unknown = JSON.parse(decoder.decode(item.data.subarray(item.ends[page - 1] ?? 0, item.ends[page])));
      if (!Array.isArray(entries) || entries.length !== Math.min(PAGE_ENTRIES, count - page * PAGE_ENTRIES)) throw Error('source_storage');
      if (rows) {
        while (selected < rows.length && Math.floor(rows[selected] / PAGE_ENTRIES) === page) result.push(entries[rows[selected++] % PAGE_ENTRIES]);
      } else for (const entry of entries) result.push(entry);
    }
  } catch { throw Error('source_storage'); }
  return result;
}
