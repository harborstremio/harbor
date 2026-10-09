import type { RecentSourceQuery } from "./source-recent-browse";
import type { GameSource, SourceManifest, SourceRelease } from "./sources";
import type { SourceEntryLayout, StoredCatalog, ValidatedSource } from "./source-store-format";
import { catalogInput, type CatalogReply, type CatalogTransfer, type StoredCatalogTransfer } from "./source-catalog-transfer";
import { rememberSourceIndex, type SourceIndex } from './source-index';
import { SOURCE_TRANSFER_ENTRIES, type SourceWorkReply, type SourceWorkTransfer } from './source-work-transfer';
import type { SourceTitleIndex } from './source-title-index';
import { createSourceWorkQueue } from './source-work-queue';
import { freezeParsedEntries, rememberParsedSummary } from './source-parsed-summary';
import type { matchingReleases } from './sources';
import type { StoredMatchPreview } from './source-match-preview';

export type SourceJob = { kind: "parse"; text: string } | { kind: "validate"; value: unknown } | { kind: "measure"; sources: GameSource[] } | { kind: "layout" | "index"; entries: SourceRelease[] } | { kind: "validateCatalog"; value: unknown; chunks?: SourceRelease[][] } | { kind: "readCatalog" | "catalogSummary"; profile: string; catalog: StoredCatalog; now?: number; priority?: 'foreground' } | { kind: 'packCatalog'; profile: string; catalog: StoredCatalog } | { kind: "catalogRows"; profile: string; catalog: StoredCatalog; rows: number[]; ends: number[]; preview?: boolean } | { kind: "catalogBrowse"; profile: string; catalog: StoredCatalog; query: string; limit: number; recent?: RecentSourceQuery } | { kind: 'catalogSearch'; index: SourceTitleIndex; query: string } | { kind: 'primeSummary'; profile: string; catalog: StoredCatalog; value: ValidatedSource; index: SourceIndex };
export type SourceMatchJob = { kind: 'matchPreviews'; profile: string; catalog: StoredCatalog; rows: number[]; ends: number[]; game: Parameters<typeof matchingReleases>[1] }
  | { kind: 'matchFiles'; profile: string; catalog: StoredCatalog; previews: StoredMatchPreview[]; ends: number[] };
export type SourceJobResult = SourceManifest | GameSource[] | SourceEntryLayout | SourceIndex | ValidatedSource | Uint32Array | StoredMatchPreview[] | SourceRelease[] | undefined;

// A single queue bounds peak parsing memory when several sources refresh together.
const workQueue = createSourceWorkQueue();
let idleWorker: Worker | undefined, idleTimeout: ReturnType<typeof setTimeout> | undefined;
function releaseWorker(worker: Worker) {
  worker.onmessage = worker.onerror = null;
  idleWorker = worker;
  idleTimeout = setTimeout(() => {
    if (idleWorker === worker) { idleWorker = undefined; worker.terminate(); }
  }, 5_000);
}
export function processSource(job: SourceJob | SourceMatchJob, signal?: AbortSignal): Promise<SourceJobResult> {
  const interactive = job.kind === 'matchPreviews' || job.kind === 'matchFiles' || job.kind === 'catalogRows' || job.kind === 'catalogBrowse' || job.kind === 'catalogSearch' || job.kind === 'index' || job.kind === 'catalogSummary' && job.priority === 'foreground';
  return workQueue.run(() => new Promise<SourceJobResult>((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    let worker: Worker;
    try {
      clearTimeout(idleTimeout);
      worker = idleWorker ?? new Worker(new URL("./source-worker.ts", import.meta.url), { type: "module" });
      idleWorker = undefined;
    }
    catch { reject(Error("source_processing")); return; }
    let settled = false, closeTransfer = () => {};
    const finish = (error?: unknown, result?: SourceJobResult) => {
      if (settled) return;
      settled = true; clearTimeout(timeout); signal?.removeEventListener("abort", abort);
      worker.removeEventListener("messageerror", messageError);
      closeTransfer();
      if (error !== undefined) { worker.terminate(); reject(error); }
      else { releaseWorker(worker); resolve(result); }
    };
    const abort = () => finish(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    const messageError = () => finish(Error("source_processing"));
    const timeout = setTimeout(() => finish(Error("source_processing")), 60_000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: SourceJobResult; error?: string }>) => finish(event.data.error ? Error(event.data.error) : undefined, event.data.result);
    worker.onerror = event => { event.preventDefault(); finish(Error("source_processing")); };
    worker.addEventListener("messageerror", messageError);
    try {
      if (job.kind === 'parse' || job.kind === 'layout' || job.kind === 'index') {
        const channel = new MessageChannel(), parts: SourceRelease[][] = []; let cursor = 0;
        closeTransfer = () => { channel.port1.onmessage = null; channel.port1.removeEventListener('messageerror', messageError); channel.port1.close(); };
        channel.port1.addEventListener('messageerror', messageError);
        channel.port1.onmessage = ({ data }: MessageEvent<SourceWorkReply>) => {
          if (settled) return;
          try {
            if (data.kind === 'input' && job.kind !== 'parse') {
              const start = cursor; cursor += SOURCE_TRANSFER_ENTRIES;
              channel.port1.postMessage(start < job.entries.length ? { kind: 'input', entries: job.entries.slice(start, cursor) } : { kind: 'finish' });
            } else if (data.kind === 'entries' && job.kind === 'parse') { freezeParsedEntries(data.entries); parts.push(data.entries); channel.port1.postMessage({ kind: 'output' }); }
            else if (data.kind === 'complete') {
              if (job.kind === 'parse' && data.manifest && data.index && data.summary) {
                const entries = parts.flat(); Object.freeze(entries); rememberParsedSummary(entries, data.summary); rememberSourceIndex(entries, data.index); finish(undefined, { ...data.manifest, entries });
              } else if (job.kind === 'layout' && data.layout) finish(undefined, data.layout);
              else if (job.kind === 'index' && data.index) { rememberSourceIndex(job.entries, data.index); finish(undefined, data.index); }
              else finish(Error('source_processing'));
            } else finish(Error(data.kind === 'error' ? data.error : 'source_processing'));
          } catch { finish(Error('source_processing')); }
        };
        worker.postMessage({ kind: 'sourceWorkTransfer', task: job.kind, text: job.kind === 'parse' ? job.text : undefined, port: channel.port2 } satisfies SourceWorkTransfer, [channel.port2]);
      } else if (job.kind === "validateCatalog" || job.kind === "readCatalog" || job.kind === "catalogSummary" || job.kind === "catalogRows" || job.kind === "catalogBrowse") {
        const input = job.kind === "validateCatalog" ? catalogInput(job.value, job.chunks) : undefined, channel = new MessageChannel(), parts: SourceRelease[][] = [];
        closeTransfer = () => { channel.port1.onmessage = null; channel.port1.removeEventListener("messageerror", messageError); channel.port1.close(); };
        channel.port1.addEventListener("messageerror", messageError);
        channel.port1.onmessage = ({ data }: MessageEvent<CatalogReply>) => {
          if (settled) return;
          try {
            if (data.kind === "input") {
              if (!input) throw Error("source_processing");
              const entries = input.next();
              channel.port1.postMessage(entries ? { kind: "input", entries } : { kind: "validate" });
            } else if (data.kind === "entries") {
              parts.push(data.entries); channel.port1.postMessage({ kind: "output" });
            } else if (data.kind === "complete") {
              const entries = parts.flat();
              if (entries.length !== (job.kind === "catalogSummary" ? 0 : data.value.layout.ends.at(-1) ?? 0)) throw Error("source_processing");
              if (job.kind !== 'catalogRows' && job.kind !== 'catalogBrowse') rememberSourceIndex(entries, data.index);
              finish(undefined, { ...data.value, source: { ...data.value.source, entries } });
            } else finish(Error(data.error));
          } catch { finish(Error("source_processing")); }
        };
        worker.postMessage(job.kind === "validateCatalog"
          ? { kind: "catalogTransfer", source: input!.source, port: channel.port2 } satisfies CatalogTransfer
          : { kind: "storedCatalogTransfer", profile: job.profile, catalog: job.catalog, port: channel.port2,
            mode: job.kind === 'catalogSummary' ? 'summary' : undefined, now: 'now' in job ? job.now : undefined,
            rows: job.kind === 'catalogRows' ? job.rows : undefined, ends: job.kind === 'catalogRows' ? job.ends : undefined,
            preview: job.kind === 'catalogRows' ? job.preview : undefined,
            browse: job.kind === 'catalogBrowse' ? { query: job.query, limit: job.limit, recent: job.recent } : undefined } satisfies StoredCatalogTransfer, [channel.port2]);
      } else worker.postMessage(job);
    } catch { finish(Error("source_processing")); }
  }), interactive, signal);
}

export async function parseSourceAsync(text: string, signal: AbortSignal) {
  return await processSource({ kind: "parse", text }, signal) as SourceManifest;
}
