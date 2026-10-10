import { downloadGame, type DownloadGame } from './transfers';

export type DownloadContextKind = 'http' | 'torrent';
type ContextStorage = Pick<Storage, 'getItem' | 'setItem'>;
type ContextEntry = { profile: string; kind: DownloadContextKind; id: string; game: DownloadGame };
type ContextRecord = { profile: string; id: string; game?: DownloadGame };
type BatchContextRequest = { filename: string; game?: DownloadGame };
type BatchContextRecord = ContextRecord & { destination: string };
export const DOWNLOAD_CONTEXT_KEY = 'harbor.games.download-context.v1';
const MAX_PROFILE_ENTRIES = 400, MAX_ENTRIES = 800, MAX_SERIALIZED = 2_500_000;
const identity = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && new TextEncoder().encode(value).length <= 256 && !/[\x00-\x1f\x7f]/.test(value);
const validKind = (value: unknown): value is DownloadContextKind => value === 'http' || value === 'torrent';
const key = (profile: string, kind: DownloadContextKind, id: string) => JSON.stringify([profile, kind, id]);

/** Display-only compatibility for engines which do not yet retain optional game context. */
export function createDownloadContextStore(storage: ContextStorage | null = null) {
  const entries = new Map<string, ContextEntry>();
  const unsaved = new Map<string, ContextEntry | null>();
  let lastStored: string | null | undefined;
  const trim = () => {
    const counts = new Map<string, number>();
    for (const entry of entries.values()) counts.set(entry.profile, (counts.get(entry.profile) ?? 0) + 1);
    for (const [entryKey, entry] of entries) {
      if ((counts.get(entry.profile) ?? 0) > MAX_PROFILE_ENTRIES) {
        entries.delete(entryKey); counts.set(entry.profile, counts.get(entry.profile)! - 1);
      }
    }
    while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
  };
  const restore = (raw: string | null) => {
    lastStored = raw;
    entries.clear();
    try {
      if (!raw || raw.length > MAX_SERIALIZED) return;
      const parsed = JSON.parse(raw) as { version?: unknown; entries?: unknown };
      if (parsed?.version !== 1 || !Array.isArray(parsed.entries) || parsed.entries.length > MAX_ENTRIES) return;
      for (const item of parsed.entries) {
        if (!item || typeof item !== 'object' || !identity(item.profile) || !validKind(item.kind) || !identity(item.id)) continue;
        const game = downloadGame(item.game); if (!game) continue;
        const entryKey = key(item.profile, item.kind, item.id);
        entries.delete(entryKey); entries.set(entryKey, { profile: item.profile, kind: item.kind, id: item.id, game });
      }
      trim();
    } catch { /* Invalid display cache must never prevent access to downloads. */ }
    finally {
      // Preserve accepted downloads when a full/disabled store could not save their context.
      for (const [entryKey, entry] of unsaved) { if (entry) entries.set(entryKey, entry); else entries.delete(entryKey); }
      trim();
    }
  };
  try { restore(storage?.getItem(DOWNLOAD_CONTEXT_KEY) ?? null); } catch { /* Storage may be disabled. */ }
  const refresh = () => {
    if (!storage) return;
    try { const raw = storage.getItem(DOWNLOAD_CONTEXT_KEY); if (raw !== lastStored) restore(raw); }
    catch { /* A normal list refresh must work with unavailable storage too. */ }
  };
  const persist = () => {
    let serialized = JSON.stringify({ version: 1, entries: [...entries.values()] });
    while (serialized.length > MAX_SERIALIZED && entries.size) {
      entries.delete(entries.keys().next().value!);
      serialized = JSON.stringify({ version: 1, entries: [...entries.values()] });
    }
    try { if (storage) { storage.setItem(DOWNLOAD_CONTEXT_KEY, serialized); lastStored = serialized; unsaved.clear(); } } catch { /* Keep exact associations in memory if the quota is full. */ }
    while (unsaved.size > MAX_ENTRIES) unsaved.delete(unsaved.keys().next().value!);
  };
  const put = (profile: string, kind: DownloadContextKind, id: string, value?: DownloadGame) => {
    const game = downloadGame(value);
    if (!identity(profile) || !validKind(kind) || !identity(id) || !game) return false;
    const entryKey = key(profile, kind, id);
    const entry = { profile, kind, id, game };
    entries.delete(entryKey); entries.set(entryKey, entry); unsaved.set(entryKey, entry);
    return true;
  };
  const remember = (profile: string, kind: DownloadContextKind, id: string, value?: DownloadGame) => { if (put(profile, kind, id, value)) { trim(); persist(); } };
  const merge = <T extends ContextRecord>(kind: DownloadContextKind, record: T): T & { game?: DownloadGame } => {
    const native = downloadGame(record.game);
    const cached = identity(record.profile) && validKind(kind) && identity(record.id) ? entries.get(key(record.profile, kind, record.id))?.game : undefined;
    const game = native ? downloadGame({...native,contentKind:native.contentKind??(cached?.id===native.id?cached.contentKind:undefined)}) : downloadGame(cached);
    return game || record.game ? { ...record, game } : record;
  };
  const forget = (profile: string, kind: DownloadContextKind, id: string) => {
    const entryKey = key(profile, kind, id);
    if (entries.delete(entryKey)) { unsaved.set(entryKey, null); persist(); }
  };
  const rememberBatch = (profile: string, requests: readonly BatchContextRequest[], records: readonly BatchContextRecord[]) => {
    // Only use this on the returned records of an accepted batch, never an existing download list.
    const byName = new Map<string, BatchContextRequest>(), duplicateNames = new Set<string>();
    for (const request of requests) {
      const folded = request.filename.toLowerCase();
      if (!request.filename || /[\\/]/.test(request.filename) || byName.has(folded)) duplicateNames.add(folded);
      byName.set(folded, request);
    }
    const names = new Map<string, number>(), ids = new Map<string, number>();
    let changed = false;
    for (const record of records) {
      if (record.profile !== profile) continue;
      const name = record.destination.split(/[\\/]/).at(-1) ?? '';
      names.set(name.toLowerCase(), (names.get(name.toLowerCase()) ?? 0) + 1);
      ids.set(record.id, (ids.get(record.id) ?? 0) + 1);
    }
    for (const record of records) {
      if (record.profile !== profile) continue;
      const name = record.destination.split(/[\\/]/).at(-1) ?? '', folded = name.toLowerCase(), request = byName.get(folded);
      if (request?.filename === name && !duplicateNames.has(folded) && names.get(folded) === 1 && ids.get(record.id) === 1) changed = put(profile, 'http', record.id, request.game) || changed;
    }
    if (changed) { trim(); persist(); }
  };
  return { remember, merge, forget, rememberBatch, restore, refresh };
}

function browserStorage(): ContextStorage | null { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } }
const context = createDownloadContextStore(browserStorage());
if (typeof window !== 'undefined') window.addEventListener('storage', event => { if (event.key === DOWNLOAD_CONTEXT_KEY || event.key === null) context.restore(event.newValue); });
export const rememberDownloadContext = context.remember;
export const mergeDownloadContext = context.merge;
export const forgetDownloadContext = context.forget;
export const rememberBatchDownloadContexts = context.rememberBatch;
export const refreshDownloadContexts = context.refresh;
