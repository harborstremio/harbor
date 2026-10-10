import { SOURCE_MAX_ENTRIES, type SourceRelease } from "./sources";
import { storedSourceProfile, type StoredCatalog } from "./source-store-format";
import { decodeSourceChunk, encodeSourceChunk, sourceChunkCount } from './source-chunk';

// Each JS context owns its connection. Workers can read without cloning raw
// catalogs through the renderer; all writes still use the existing transaction.
let connection: Promise<IDBDatabase> | undefined;
export function sourceDatabase() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("harbor-game-sources", 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("profiles")) request.result.createObjectStore("profiles");
      if (!request.result.objectStoreNames.contains("catalogs")) request.result.createObjectStore("catalogs");
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = undefined; }; resolve(request.result); };
    request.onerror = request.onblocked = () => reject(Error("source_storage"));
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}

/** Small immutable-version check for cached matches; never clones release chunks. */
export async function readCatalogVersions(profile: string): Promise<StoredCatalog[]> {
  const db = await sourceDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('profiles', 'readonly'), request = tx.objectStore('profiles').get(profile);
    let catalogs: StoredCatalog[] = [];
    request.onsuccess = () => {
      try { catalogs = request.result === undefined ? [] : storedSourceProfile(request.result).catalogs; }
      catch { tx.abort(); }
    };
    tx.oncomplete = () => resolve(catalogs);
    tx.onabort = () => reject(Error('source_storage'));
  });
}

/** Called in the catalog worker; one immutable version is read in one transaction. */
async function readStoredChunks(profile: string, catalog: StoredCatalog, selected?: number[]): Promise<unknown[]> {
  const db = await sourceDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(selected ? ["profiles", "catalogs"] : ["catalogs"], "readonly"), store = tx.objectStore("catalogs"), parts: unknown[] = [];
    let count = 0;
    const next = () => {
      if (parts.length === (selected?.length ?? catalog.parts)) return;
      const request = store.get([profile, catalog.source.id, catalog.version, selected?.[parts.length] ?? parts.length]);
      request.onsuccess = () => {
        try {
          if ((count += sourceChunkCount(request.result)) > SOURCE_MAX_ENTRIES) throw Error('source_storage');
          parts.push(request.result); next();
        } catch { tx.abort(); }
      };
    };
    if (selected) {
      const current = tx.objectStore('profiles').get(profile);
      current.onsuccess = () => {
        try {
          if (!storedSourceProfile(current.result).catalogs.some(item => item.source.id === catalog.source.id && item.source.url === catalog.source.url && item.version === catalog.version && item.parts === catalog.parts)) throw Error('source_changed');
          next();
        } catch { tx.abort(); }
      };
    } else next();
    tx.oncomplete = () => resolve(parts);
    tx.onerror = tx.onabort = () => reject(Error("source_storage"));
  });
}

export async function readCatalogChunks(profile: string, catalog: StoredCatalog, selected?: number[]): Promise<SourceRelease[][]> {
  return (await readStoredChunks(profile, catalog, selected)).map(value => decodeSourceChunk(value));
}

/** Worker-only ordered reads. Keep at most two decoded chunks while matching or
 * merging duplicate releases; every read and the final result recheck ownership. */
export async function* iterateCatalogRows(profile: string, catalog: StoredCatalog, rows: number[], ends: number[]) {
  if (ends.length !== catalog.parts || ends.some((end, i) => !Number.isSafeInteger(end) || end <= (ends[i - 1] ?? 0) || end > SOURCE_MAX_ENTRIES)
    || rows.length > SOURCE_MAX_ENTRIES || new Set(rows).size !== rows.length || rows.some(row => !Number.isSafeInteger(row) || row < 0 || row >= (ends.at(-1) ?? 0))) throw Error('source_storage');
  const held = new Map<number, SourceRelease[]>();
  for (const row of rows) {
    const part = ends.findIndex(end => row < end);
    let entries = held.get(part);
    if (!entries) {
      if (held.size === 2) held.delete(held.keys().next().value!);
      const [value] = await readStoredChunks(profile, catalog, [part]);
      if (sourceChunkCount(value) !== ends[part] - (ends[part - 1] ?? 0)) throw Error('source_storage');
      entries = decodeSourceChunk(value);
    }
    held.delete(part); held.set(part, entries);
    yield { row, entry: entries[row - (ends[part - 1] ?? 0)] };
  }
  await readStoredChunks(profile, catalog, []);
}

/** Worker-only optimization after the primary atomic save. Each replacement is
 * version checked and atomic; cancellation/quota failure leaves readable arrays
 * or a mixed representation with exactly the same logical records. */
export async function packCatalogChunks(profile: string, catalog: StoredCatalog): Promise<void> {
  const db = await sourceDatabase();
  for (let part = 0; part < catalog.parts; part++) {
    const [value] = await readStoredChunks(profile, catalog, [part]);
    if (!Array.isArray(value)) continue;
    const packed = encodeSourceChunk(value);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['profiles', 'catalogs'], 'readwrite'), store = tx.objectStore('catalogs');
      const current = tx.objectStore('profiles').get(profile), key = [profile, catalog.source.id, catalog.version, part];
      current.onsuccess = () => {
        try {
          if (!storedSourceProfile(current.result).catalogs.some(item => item.source.id === catalog.source.id && item.source.url === catalog.source.url && item.version === catalog.version && item.parts === catalog.parts)) throw Error('source_changed');
          const request = store.get(key);
          request.onsuccess = () => {
            try {
              if (sourceChunkCount(request.result) !== packed.count) throw Error('source_storage');
              // Payload versions are immutable. Another optimizer may already
              // have replaced this exact chunk while encoding was in progress.
              if (Array.isArray(request.result)) store.put(packed, key);
            } catch { tx.abort(); }
          };
        } catch { tx.abort(); }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(Error('source_storage'));
    });
  }
}

/** Read selected pages from the same version-checked transaction as legacy chunks. */
export async function readCatalogRows(profile: string, catalog: StoredCatalog, rows: number[], ends: number[]): Promise<SourceRelease[]> {
  if (ends.length !== catalog.parts || ends.some((end, i) => !Number.isSafeInteger(end) || end <= (ends[i - 1] ?? 0) || end > SOURCE_MAX_ENTRIES) || rows.length > SOURCE_MAX_ENTRIES || rows.some((row, i) => !Number.isSafeInteger(row) || row < 0 || row >= (ends.at(-1) ?? 0) || i > 0 && row <= rows[i - 1])) throw Error('source_storage');
  const selected = new Map<number, number[]>(); let part = 0;
  for (const row of rows) {
    while (row >= ends[part]) part++;
    let local = selected.get(part); if (!local) { local = []; selected.set(part, local); }
    local.push(row - (ends[part - 1] ?? 0));
  }
  const parts = [...selected.keys()], chunks = await readStoredChunks(profile, catalog, parts), result: SourceRelease[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const part = parts[i];
    if (sourceChunkCount(chunks[i]) !== ends[part] - (ends[part - 1] ?? 0)) throw Error('source_storage');
    for (const entry of decodeSourceChunk(chunks[i], selected.get(part))) result.push(entry);
  }
  return result;
}

/** Validate/process each chunk synchronously, without retaining a whole catalog.
 * The profile check and all chunks share one readonly transaction, so a refresh
 * cannot splice records from different versions into the scan. */
export async function visitCatalogChunks(profile: string, catalog: StoredCatalog, visit: (entries: SourceRelease[]) => void): Promise<void> {
  const db = await sourceDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['profiles', 'catalogs'], 'readonly'), store = tx.objectStore('catalogs');
    let part = 0, count = 0, failure: unknown;
    const abort = (error: unknown) => { failure = error; tx.abort(); };
    const next = () => {
      if (part === catalog.parts) return;
      const request = store.get([profile, catalog.source.id, catalog.version, part++]);
      request.onsuccess = () => {
        try {
          const entries = decodeSourceChunk(request.result);
          if (!entries.length || (count += entries.length) > SOURCE_MAX_ENTRIES) throw Error('source_storage');
          visit(entries);
          next();
        } catch (error) { abort(error); }
      };
    };
    const current = tx.objectStore('profiles').get(profile);
    current.onsuccess = () => {
      try {
        if (!storedSourceProfile(current.result).catalogs.some(item => item.source.id === catalog.source.id && item.source.url === catalog.source.url && item.version === catalog.version && item.parts === catalog.parts)) throw Error('source_storage');
        next();
      } catch (error) { abort(error); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(failure ?? Error('source_storage'));
  });
}
