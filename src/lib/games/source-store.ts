import { SOURCE_MAX_SUBSCRIPTIONS, sourceError, type GameSource, type SourceRelease, type SourceCatalogIssue } from "./sources";
import { processSource } from "./source-processing";
import { SOURCE_CHUNK_BYTES, sourceProfileBytes, sourceStoreHeaders, storedSourceProfile, type SourceEntryLayout, type StoredCatalog, type StoredSourceProfile, type ValidatedSource } from "./source-store-format";
import { removeSummaryCaches } from './source-summary-cache';
import { sourceDatabase as database } from "./source-store-db";
import { createSourceCatalogReads } from './source-catalog-reads';
import { parsedSourceSummary } from './source-parsed-summary';
import { sourceIndex } from './source-index';
import { sourceStorageError } from './source-storage-error';
export { validateSourceStore } from "./source-store-validation";

// Entry arrays are immutable catalog snapshots; toggles and status updates retain them.
const layouts = new WeakMap<SourceRelease[], { layout: SourceEntryLayout; version: string }>();
const unavailable = new WeakMap<SourceRelease[], { issue: SourceCatalogIssue; id: string; url: string }>();
const reads = new Map<string, Promise<GameSource[]>>();
const subscribers = new Set<(profile: string) => void>();
export function subscribeSourceStore(listener: (profile: string) => void) { subscribers.add(listener); return () => { subscribers.delete(listener); }; }
const catalogReads = createSourceCatalogReads((profile, signal) => readStoredSources(profile, true, true, signal));
const summaries = new Map<string, ValidatedSource>();
let summaryProfile = '';
function keepSummary(profile: string, key: string, value: ValidatedSource) {
  if (summaryProfile !== profile) { summaries.clear(); summaryProfile = profile; }
  summaries.delete(key); summaries.set(key, value);
  while (summaries.size > 128) summaries.delete(summaries.keys().next().value!);
  // Limit summary reuse by catalog size. Candidate indexes have their own byte
  // budget, independent of these summaries or snapshots held by mounted views.
  let bytes = 0;
  for (const item of [...summaries.entries()].reverse()) {
    bytes += (item[1].layout.ends.at(-1) ?? 0) * 16;
    if (bytes > 32 * 1024 * 1024) summaries.delete(item[0]);
  }
}
type RawCatalog = { value: unknown } | { catalog: StoredCatalog };
/** Lightweight subscription recheck without cloning or validating every catalog entry. */
export async function readSourceSubscriptions(profile: string): Promise<Omit<GameSource, "entries">[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readonly"), request = tx.objectStore("profiles").get(profile);
    let result: Omit<GameSource, "entries">[] = [];
    request.onsuccess = () => {
      try {
        const value = request.result;
        result = value === undefined ? [] : Array.isArray(value) ? sourceStoreHeaders(value) : storedSourceProfile(value).catalogs.map(catalog => catalog.source);
      } catch { tx.abort(); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = tx.onabort = () => reject(Error("source_storage"));
  });
}
async function readProfileRecord(profile: string): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("profiles", "readonly");
    const request = tx.objectStore("profiles").get(profile);
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(Error("source_storage"));
  });
}

function profileRevision(value: unknown) {
  return JSON.stringify(value === undefined ? null : Array.isArray(value) ? sourceStoreHeaders(value) : storedSourceProfile(value));
}

/** Validate one catalog before reading the next, so a reload never clones the entire store twice. */
async function* readCatalogs(snapshot: unknown): AsyncGenerator<RawCatalog> {
  if (snapshot === undefined) return;
  if (Array.isArray(snapshot)) { sourceStoreHeaders(snapshot); for (const value of snapshot) yield { value }; return; }
  for (const catalog of storedSourceProfile(snapshot).catalogs) yield { catalog };
}

async function readStoredSources(profile: string, retry = true, lightweight = false, signal?: AbortSignal): Promise<GameSource[]> {
  signal?.throwIfAborted();
  const snapshot = await readProfileRecord(profile);
  signal?.throwIfAborted();
  const revision = profileRevision(snapshot);
  const sources: GameSource[] = [], measured: SourceEntryLayout[] = [];
  try {
    for await (const record of readCatalogs(snapshot)) {
      try {
        signal?.throwIfAborted();
        const compact = lightweight && 'catalog' in record && !record.catalog.source.website;
        const key = 'catalog' in record ? JSON.stringify([profile, record.catalog.source.id, record.catalog.version]) : '';
        const prepared = compact && summaries.get(key) || await processSource("catalog" in record
          ? { kind: compact ? "catalogSummary" : "readCatalog", profile, catalog: record.catalog }
          : { kind: "validateCatalog", value: record.value }, signal) as ValidatedSource;
        signal?.throwIfAborted();
        const { layout, storedEnds } = prepared;
        let source = prepared.source;
        if (compact && 'catalog' in record) {
          const same = storedEnds?.length === layout.ends.length && storedEnds.every((end, i) => end === layout.ends[i]);
          if (!same) {
            // A normalization/layout change requires full records for the next atomic rewrite.
            source = (await processSource({ kind: 'readCatalog', profile, catalog: record.catalog }, signal) as ValidatedSource).source;
            signal?.throwIfAborted();
          } else {
            keepSummary(profile, key, prepared);
            source = { ...record.catalog.source, entries: prepared.source.entries, catalog: { profile, version: record.catalog.version, parts: record.catalog.parts, layout, storedEnds: storedEnds!, recent: prepared.recent ?? [], recentAt: prepared.recentAt!, recentUntil: prepared.recentUntil! } };
          }
        }
        sources.push(source); measured.push(layout);
        const sameLayout = storedEnds?.length === layout.ends.length && storedEnds.every((end, index) => end === layout.ends[index]);
        // Validation or future chunk rules can change boundaries; rewrite those records
        // atomically on the next edit instead of pointing new metadata at old chunks.
        layouts.set(source.entries, { layout, version: sameLayout && "catalog" in record ? record.catalog.version : crypto.randomUUID() });
        if ("value" in record) record.value = undefined;
      } catch (error) {
        signal?.throwIfAborted();
        // A partial UI snapshot must retain a guarded reference, never a new empty
        // catalog that a later settings edit could persist over the unreadable data.
        if (!lightweight || !('catalog' in record)) throw error;
        const catalog = record.catalog;
        const issue = Object.freeze({ profile, version: catalog.version, parts: catalog.parts, error: sourceError(error) });
        const source: GameSource = { ...catalog.source, entries: [], catalogIssue: issue };
        unavailable.set(source.entries, { issue, id: source.id, url: source.url });
        sources.push(source); measured.push({ bytes: 2, ends: [] });
      }
    }
    sourceProfileBytes(sourceStoreHeaders(sources), measured);
    // Writes atomically replace versioned chunks. Retry a concurrent edit instead of
    // publishing a mixture of revisions or reporting a deleted old chunk as corruption.
    if (profileRevision(await readProfileRecord(profile)) !== revision) throw Error('source_changed');
    signal?.throwIfAborted();
    return sources;
  } catch {
    signal?.throwIfAborted();
    if (retry && profileRevision(await readProfileRecord(profile)) !== revision) return readStoredSources(profile, false, lightweight, signal);
    signal?.throwIfAborted();
    throw Error("source_storage");
  }
}

export function readSourceStore(profile: string): Promise<GameSource[]> {
  const pending = reads.get(profile);
  if (pending) return pending;
  // Concurrent mounts share validation, but settled snapshots are never cached here.
  const request = readStoredSources(profile);
  reads.set(profile, request);
  const clear = () => { if (reads.get(profile) === request) reads.delete(profile); };
  void request.then(clear, clear);
  return request;
}

/** UI snapshots retain only metadata, compact indexes and bounded recent releases. */
export function readSourceCatalogs(profile: string, signal?: AbortSignal): Promise<GameSource[]> {
  return catalogReads.read(profile, signal);
}

export async function writeSourceStore(profile: string, sources: GameSource[], lightweight = false, readSignal?: AbortSignal) {
  if (sources.length > SOURCE_MAX_SUBSCRIPTIONS) throw Error('source_limit');
  const headers = sourceStoreHeaders(sources), plans: { layout?: SourceEntryLayout; version: string; parts: number; stored?: boolean }[] = [];
  for (const source of sources) {
    const failed = unavailable.get(source.entries), issue = source.catalogIssue;
    if (issue || failed) {
      if (!issue || !failed || failed.issue !== issue || issue.profile !== profile || failed.id !== source.id || failed.url !== source.url || source.entries.length || source.catalog) throw Error('source_storage');
      plans.push({ version: issue.version, parts: issue.parts, stored: true }); continue;
    }
    const ref = source.catalog;
    if (ref) {
      const known = layouts.get(source.entries);
      if (!known || known.layout !== ref.layout || known.version !== ref.version || ref.profile !== profile || source.entries.length || ref.parts !== ref.storedEnds.length || ref.layout.ends.length !== ref.parts || ref.layout.ends.some((end, i) => end !== ref.storedEnds[i])) throw Error('source_storage');
      plans.push({ layout: ref.layout, version: ref.version, parts: ref.parts, stored: true }); continue;
    }
    let plan = layouts.get(source.entries);
    if (!plan) {
      plan = { layout: parsedSourceSummary(source.entries)?.layout ?? await processSource({ kind: "layout", entries: source.entries }) as SourceEntryLayout, version: crypto.randomUUID() };
      layouts.set(source.entries, plan);
    }
    plans.push({ ...plan, parts: plan.layout.ends.length });
  }
  let uncertainSize = false;
  try { sourceProfileBytes(headers, plans.map(plan => plan.layout ?? { bytes: Math.max(2, plan.parts * SOURCE_CHUNK_BYTES), ends: [] })); }
  catch (error) { if (plans.every(plan => plan.layout)) throw error; uncertainSize = true; }
  const stored: StoredSourceProfile = { version: 2, catalogs: headers.map((source, index) => ({ source, version: plans[index].version, parts: plans[index].parts })) };
  let obsolete: StoredCatalog[] = [];
  const written = new Set<number>();
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    let failure = 'source_storage';
    const tx = db.transaction(["profiles", "catalogs"], "readwrite"), profiles = tx.objectStore("profiles"), chunks = tx.objectStore("catalogs");
    const previous = profiles.get(profile);
    previous.onsuccess = () => {
      try {
        const old = previous.result === undefined || Array.isArray(previous.result) ? [] : storedSourceProfile(previous.result).catalogs;
        // When unreadable data prevents a precise size check, only retain/remove
        // existing payload versions. New payloads require a safe upper bound.
        if (uncertainSize && stored.catalogs.some(catalog => !old.some(item => item.source.id === catalog.source.id && item.source.url === catalog.source.url && item.version === catalog.version && item.parts === catalog.parts))) {
          failure = 'source_incomplete'; throw Error(failure);
        }
        obsolete = old.filter(item => !stored.catalogs.some(next => next.source.id === item.source.id && next.version === item.version));
        const operations: (() => IDBRequest)[] = [];
        stored.catalogs.forEach((catalog, index) => {
          const retained = old.some(item => item.source.id === catalog.source.id && item.source.url === catalog.source.url && item.version === catalog.version && item.parts === catalog.parts);
          if (plans[index].stored && !retained) throw Error('source_changed');
          if (retained) return;
          written.add(index);
          let start = 0;
          plans[index].layout!.ends.forEach((end, part) => {
            const from = start; start = end;
            operations.push(() => chunks.put(sources[index].entries.slice(from, end), [profile, catalog.source.id, catalog.version, part]));
          });
        });
        for (const catalog of old) {
          if (stored.catalogs.some(item => item.source.id === catalog.source.id && item.version === catalog.version)) continue;
          for (let part = 0; part < catalog.parts; part++) operations.push(() => chunks.delete([profile, catalog.source.id, catalog.version, part]));
        }
        operations.push(() => profiles.put(stored, profile));
        // Each completion queues the next bounded record in the same transaction.
        // This yields between clones while keeping catalogs and metadata atomic.
        let index = 0;
        const next = () => {
          if (index === operations.length) return;
          try { operations[index++]().onsuccess = next; } catch (error) { failure = sourceStorageError(error).message; tx.abort(); }
        };
        next();
      } catch { tx.abort(); }
    };
    tx.oncomplete = () => resolve();
    // Request errors bubble before the transaction finishes aborting. Wait for
    // rollback and its final error before reporting that the old catalogs survived.
    tx.onabort = () => reject(failure === 'source_storage' ? sourceStorageError(tx.error) : Error(failure));
  });
  await removeSummaryCaches(profile, obsolete);
  // Keep JSON encoding and its temporary allocations off the renderer. The
  // primary save above is already durable; interrupted optimization never
  // changes records or makes an accepted catalog save fail.
  for (const index of written) {
    if (readSignal?.aborted) break;
    try { await processSource({ kind: 'packCatalog', profile, catalog: stored.catalogs[index] }, readSignal); }
    catch { /* Legacy arrays and partially packed catalogs remain readable. */ }
  }
  // A fresh parser snapshot is immutable and already measured/indexed in the worker.
  // Seed only the disposable summary; arbitrary records retain the full read/validation path.
  for (let index = 0; index < sources.length; index++) {
    const source = sources[index], prepared = parsedSourceSummary(source.entries), candidateIndex = sourceIndex(source.entries);
    const now = Date.now();
    if (!written.has(index) || !prepared || !candidateIndex || source.website || readSignal?.aborted || now < prepared.recentAt || now >= prepared.recentUntil) continue;
    const value: ValidatedSource = { source: { ...headers[index], entries: [] }, ...prepared, storedEnds: prepared.layout.ends };
    try { await processSource({ kind: 'primeSummary', profile, catalog: stored.catalogs[index], value, index: candidateIndex }, readSignal); }
    catch { /* A failed optional cache seed cannot undo a committed catalog. */ }
  }
  // A read that started before this commit may still be validating its old snapshot.
  reads.delete(profile); catalogReads.forget(profile);
  const validKeys = new Set(stored.catalogs.map(catalog => JSON.stringify([profile, catalog.source.id, catalog.version])));
  if (summaryProfile === profile) for (const key of summaries.keys()) if (!validKeys.has(key)) summaries.delete(key);
  for (const listener of subscribers) listener(profile);
  // The write above is atomic and already committed. Only its optional UI reread
  // is canceled when that consumer leaves; no committed data is rolled back.
  return lightweight ? readSourceCatalogs(profile, readSignal) : sources;
}
