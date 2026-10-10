import { validRecentSourceQuery, type RecentSourceQuery } from "./source-recent-browse";
import { SOURCE_MAX_ENTRIES, type GameSource, type SourceRelease } from "./sources";
import { sourceEntryLayout, sourceStoreHeaders, storedSourceProfile, type StoredCatalog, type ValidatedSource } from "./source-store-format";
import { readCatalogChunks, readCatalogRows, visitCatalogChunks } from "./source-store-db";
import { validateSourceStore } from "./source-store-validation";
import { readSummaryCache, writeSummaryCache } from './source-summary-cache';
import { buildSourceIndex, type SourceIndex } from './source-index';
import { catalogBrowseCollector } from './source-catalog-browse';
import { catalogSummaryCollector } from './source-catalog-summary';
import { sourceRecentPreview } from './source-recent-preview';

const TRANSFER_ENTRIES = 256;

export type CatalogTransfer = { kind: "catalogTransfer"; source: Omit<GameSource, "entries">; port: MessagePort };
export type StoredCatalogTransfer = { kind: "storedCatalogTransfer"; profile: string; catalog: StoredCatalog; port: MessagePort; mode?: "summary"; now?: number; rows?: number[]; ends?: number[]; preview?: boolean; browse?: { query: string; limit: number; recent?: RecentSourceQuery } };
type CatalogInput = { kind: "input"; entries: SourceRelease[] } | { kind: "validate" } | { kind: "output" };
export type CatalogReply = { kind: "input" } | { kind: "entries"; entries: SourceRelease[] } | { kind: "complete"; value: ValidatedSource; index: SourceIndex } | { kind: "error"; error: string };

export function catalogInput(value: unknown, chunks?: SourceRelease[][]) {
  const source = value as GameSource | undefined;
  if (!source || !Array.isArray(source.entries) || source.entries.length > SOURCE_MAX_ENTRIES) throw Error("source_storage");
  const header = sourceStoreHeaders([source])[0];
  if (chunks && (!chunks.every(Array.isArray) || chunks.reduce((count, chunk) => count + chunk.length, 0) !== source.entries.length)) throw Error("source_storage");
  let cursor = 0;
  return {
    source: header,
    next: () => {
      // Disk chunks and legacy records share the same bounded transfer size.
      if (cursor >= source.entries.length) return;
      const from = cursor; cursor += TRANSFER_ENTRIES;
      return source.entries.slice(from, cursor);
    },
  };
}

/** Acknowledgements keep only one input or output chunk in transit at a time. */
export function receiveCatalogTransfer(request: CatalogTransfer | StoredCatalogTransfer) {
  const { port } = request;
  const source = request.kind === "catalogTransfer" ? request.source : request.catalog.source;
  let parts: SourceRelease[][] = [], count = 0, output: ValidatedSource | undefined, cursor = 0;
  const close = () => { parts = []; output = undefined; port.onmessage = null; port.removeEventListener("messageerror", messageError); port.close(); };
  const send = (reply: CatalogReply) => port.postMessage(reply);
  const fail = (error: unknown) => {
    try { send({ kind: "error", error: error instanceof Error ? error.message : "source_processing" }); }
    finally { close(); }
  };
  const messageError = () => fail(Error("source_processing"));
  const complete = (value: ValidatedSource, index: SourceIndex) => {
    port.postMessage({ kind: 'complete', value, index } satisfies CatalogReply, [index.keys.buffer as ArrayBuffer, index.rows.buffer as ArrayBuffer]);
    close();
  };
  const next = () => {
    if (!output) throw Error("source_processing");
    if (cursor < output.source.entries.length) {
      const start = cursor; cursor += TRANSFER_ENTRIES;
      send({ kind: "entries", entries: output.source.entries.slice(start, cursor) });
    } else {
      const index = buildSourceIndex(output.source.entries);
      const buffers = [index.keys.buffer as ArrayBuffer, index.rows.buffer as ArrayBuffer];
      if (output.browseRows) buffers.push(output.browseRows.buffer as ArrayBuffer);
      if (output.browseTitles) buffers.push(output.browseTitles.ends.buffer as ArrayBuffer);
      port.postMessage({ kind: "complete", value: { ...output, source: { ...output.source, entries: [] } }, index } satisfies CatalogReply, buffers);
      close();
    }
  };
  const validate = (chunks: SourceRelease[][], stored: boolean) => {
    let end = 0;
    const storedEnds = stored ? chunks.map(part => end += part.length) : undefined;
    const validated = validateSourceStore([{ ...source, entries: chunks.flat() }])[0];
    parts = [];
    output = { source: validated, layout: sourceEntryLayout(validated.entries), storedEnds };
    next();
  };
  port.onmessage = ({ data }: MessageEvent<CatalogInput>) => {
    try {
      if (data.kind === "input" && !output && request.kind === "catalogTransfer") {
        if (!Array.isArray(data.entries) || (count += data.entries.length) > SOURCE_MAX_ENTRIES) throw Error("source_storage");
        parts.push(data.entries); send({ kind: "input" });
      } else if (data.kind === "validate" && !output && request.kind === "catalogTransfer") {
        validate(parts, false);
      } else if (data.kind === "output") next();
      else throw Error("source_processing");
    } catch (error) { fail(error); }
  };
  port.addEventListener("messageerror", messageError);
  if (request.kind === "catalogTransfer") send({ kind: "input" });
  else {
    // Apply the same schema checks before opening any versioned record.
    try {
      const catalog = storedSourceProfile({ version: 2, catalogs: [request.catalog] }).catalogs[0];
      if (request.browse && (typeof request.browse.query !== 'string' || request.browse.query.length > 500 || !Number.isSafeInteger(request.browse.limit) || request.browse.limit < 0 || request.browse.limit > SOURCE_MAX_ENTRIES)) throw Error('source_storage');
      if (request.browse?.recent && !validRecentSourceQuery(request.browse.recent)) throw Error('source_storage');
      if (request.mode === 'summary') {
        const now = request.now ?? Date.now();
        void readSummaryCache(request.profile, catalog, now).then(cached => {
          if (cached) { complete(cached.value, cached.index); return; }
          const collector = catalogSummaryCollector(catalog.source, now);
          return visitCatalogChunks(request.profile, catalog, entries => collector.add(entries)).then(async () => {
            const { value, index } = collector.finish();
            // Cache writes must clone/commit buffers before ownership transfers.
            await writeSummaryCache(request.profile, catalog, value, index);
            complete(value, index);
          });
        }).catch(fail);
      } else if (request.browse) {
        const collector = catalogBrowseCollector(catalog.source, request.browse.query, request.browse.limit, request.browse.recent);
        void visitCatalogChunks(request.profile, catalog, entries => collector.add(entries)).then(() => { output = collector.finish(); next(); }).catch(fail);
      } else if (request.rows) {
        const ends = request.ends;
        if (!ends || ends.length !== catalog.parts || ends.some((end, i) => !Number.isSafeInteger(end) || end <= (ends[i - 1] ?? 0) || end > SOURCE_MAX_ENTRIES) || request.rows.length > SOURCE_MAX_ENTRIES || request.rows.some(row => !Number.isSafeInteger(row) || row < 0 || row >= (ends.at(-1) ?? 0))) throw Error('source_storage');
        const rows = [...new Set(request.rows)].sort((a, b) => a - b);
        void readCatalogRows(request.profile, catalog, rows, ends).then(entries => {
          if (!request.preview) { validate([entries], false); return; }
          const validated = validateSourceStore([{ ...source, entries }])[0];
          if (validated.entries.length !== rows.length) throw Error('source_storage');
          const recent = validated.entries.map((entry, index) => sourceRecentPreview(entry, rows[index]));
          complete({ source: { ...validated, entries: [] }, layout: sourceEntryLayout([]), recent }, buildSourceIndex([]));
        }).catch(fail);
      } else void readCatalogChunks(request.profile, catalog).then(chunks => validate(chunks, true)).catch(fail);
    } catch (error) { fail(error); }
  }
}
