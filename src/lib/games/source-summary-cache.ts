import type { StoredCatalog, ValidatedSource } from './source-store-format';
import { storedSourceProfile } from './source-store-format';
import { sourceDatabase } from './source-store-db';
import type { SourceIndex } from './source-index';
import { createSummaryCache, restoreSummaryCache, summaryCacheKey, SOURCE_SUMMARY_MAX_BYTES } from './source-summary-format';

export const SOURCE_SUMMARY_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_RECORDS = 512;
type CacheHeader = { key: string; profile: string; id: string; version: string; bytes: number; createdAt: number };
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('harbor-game-source-indexes', 1);
    let settled = false;
    const timeout = setTimeout(() => { settled = true; reject(Error('source_cache')); }, 1500);
    request.onupgradeneeded = () => { for (const store of ['headers', 'summaries']) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store); };
    request.onsuccess = () => {
      clearTimeout(timeout); if (settled) { request.result.close(); return; } settled = true;
      const db = request.result;
      if (!db.objectStoreNames.contains('headers') || !db.objectStoreNames.contains('summaries')) { db.close(); reject(Error('source_cache')); return; }
      db.onversionchange = () => { db.close(); connection = undefined; }; resolve(db);
    };
    request.onerror = request.onblocked = () => { clearTimeout(timeout); settled = true; reject(Error('source_cache')); };
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}
function validHeader(value: unknown): value is CacheHeader {
  const h = value as CacheHeader | null;
  return !!h && typeof h.key === 'string' && h.key.length <= 1024 && typeof h.profile === 'string' && h.profile.length <= 256 && typeof h.id === 'string' && h.id.length <= 80 && typeof h.version === 'string' && /^[a-f0-9-]{36}$/.test(h.version) && h.key === JSON.stringify([h.profile, h.id, h.version]) && Number.isSafeInteger(h.bytes) && h.bytes > 0 && h.bytes <= SOURCE_SUMMARY_MAX_BYTES && Number.isFinite(h.createdAt);
}
export async function readSummaryCache(profile: string, catalog: StoredCatalog, now = Date.now()) {
  try {
    const db = await database(), key = summaryCacheKey(profile, catalog);
    const held = await new Promise<{ value: unknown; bytes: number } | undefined>((resolve, reject) => {
      const tx = db.transaction(['headers', 'summaries'], 'readonly'), request = tx.objectStore('headers').get(key);
      let result: { value: unknown; bytes: number } | undefined;
      request.onsuccess = () => {
        const header = request.result;
        if (!validHeader(header) || header.key !== key) return;
        const data = tx.objectStore('summaries').get(key); data.onsuccess = () => { result = { value: data.result, bytes: header.bytes }; };
      };
      tx.oncomplete = () => resolve(result); tx.onabort = tx.onerror = () => reject(Error('source_cache'));
    });
    return held && await restoreSummaryCache(held.value, profile, catalog, held.bytes, now);
  } catch { return; }
}
async function currentVersion(profile: string, catalog: StoredCatalog) {
  const db = await sourceDatabase();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction('profiles', 'readonly'), request = tx.objectStore('profiles').get(profile); let current = false;
    request.onsuccess = () => { try { current = storedSourceProfile(request.result).catalogs.some(item => item.source.id === catalog.source.id && item.source.url === catalog.source.url && item.version === catalog.version && item.parts === catalog.parts); } catch { /* Legacy/deleted records are not cached. */ } };
    tx.oncomplete = () => resolve(current); tx.onabort = tx.onerror = () => reject(Error('source_cache'));
  });
}

/** A separate bounded, disposable cache never determines whether catalog writes succeed. */
export async function writeSummaryCache(profile: string, catalog: StoredCatalog, value: ValidatedSource, index: SourceIndex): Promise<boolean> {
  try {
    const prepared = await createSummaryCache(profile, catalog, value, index);
    if (!await currentVersion(profile, catalog)) return false;
    const db = await database(), key = summaryCacheKey(profile, catalog);
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(['headers', 'summaries'], 'readwrite'), headers = tx.objectStore('headers'), summaries = tx.objectStore('summaries');
      const request = headers.getAll(undefined, MAX_RECORDS + 1);
      request.onsuccess = () => {
        const count = summaries.count();
        count.onsuccess = () => {
          try {
            const raw = request.result;
            let kept: CacheHeader[] = [];
            if (raw.length > MAX_RECORDS || count.result !== raw.length || !raw.every(validHeader)) { headers.clear(); summaries.clear(); }
            else {
              kept = raw.filter(header => {
                if (header.profile !== profile || header.id !== catalog.source.id) return true;
                headers.delete(header.key); summaries.delete(header.key); return false;
              }).sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key));
            }
            let bytes = kept.reduce((sum, header) => sum + header.bytes, 0);
            while (kept.length >= MAX_RECORDS || bytes + prepared.bytes > SOURCE_SUMMARY_CACHE_BYTES) {
              const old = kept.shift(); if (!old) break; bytes -= old.bytes; headers.delete(old.key); summaries.delete(old.key);
            }
            summaries.put(prepared.item, key); headers.put({ key, profile, id: catalog.source.id, version: catalog.version, bytes: prepared.bytes, createdAt: Date.now() } satisfies CacheHeader, key);
          } catch { tx.abort(); }
        };
      };
      tx.oncomplete = () => resolve(true); tx.onabort = tx.onerror = () => reject(Error('source_cache'));
    });
  } catch { return false; }
}
export async function removeSummaryCaches(profile: string, catalogs: { source: { id: string }; version: string }[]) {
  if (!catalogs.length) return;
  try {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['headers', 'summaries'], 'readwrite');
      for (const catalog of catalogs) { const key = JSON.stringify([profile, catalog.source.id, catalog.version]); tx.objectStore('headers').delete(key); tx.objectStore('summaries').delete(key); }
      tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(Error('source_cache'));
    });
  } catch { /* Cache eviction cannot undo a successful source change. */ }
}
