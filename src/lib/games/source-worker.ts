import { parseSourceText } from "./sources";
import { checkSourceStoreSize, validateSourceStore } from "./source-store-validation";
import { sourceEntryLayout } from "./source-store-format";
import type { SourceJob, SourceMatchJob, SourceJobResult } from "./source-processing";
import { readMatchPreviews, readMatchFiles } from './source-match-reader';
import { receiveCatalogTransfer, type CatalogTransfer, type StoredCatalogTransfer } from "./source-catalog-transfer";
import { receiveSourceWork, type SourceWorkTransfer } from './source-work-transfer';
import { buildSourceIndex } from './source-index';
import { searchSourceTitleIndex } from './source-title-index';
import { writeSummaryCache } from './source-summary-cache';
import { packCatalogChunks } from './source-store-db';

const port = globalThis as unknown as { onmessage: (event: MessageEvent<SourceJob | SourceMatchJob | CatalogTransfer | StoredCatalogTransfer | SourceWorkTransfer>) => void; postMessage: (value: { result?: SourceJobResult; error?: string }, transfer?: Transferable[]) => void };
port.onmessage = ({ data }) => {
  try {
    if (data.kind === "catalogTransfer" || data.kind === "storedCatalogTransfer") { receiveCatalogTransfer(data); return; }
    if (data.kind === 'sourceWorkTransfer') { receiveSourceWork(data); return; }
    if (data.kind === 'matchPreviews' || data.kind === 'matchFiles') {
      const result = data.kind === 'matchPreviews'
        ? readMatchPreviews(data.profile, data.catalog, data.rows, data.ends, data.game)
        : readMatchFiles(data.profile, data.catalog, data.previews, data.ends);
      void result.then(value => port.postMessage({ result: value }), () => port.postMessage({ error: 'source_storage' }));
      return;
    }
    if (data.kind === 'packCatalog') {
      void packCatalogChunks(data.profile, data.catalog).then(
        () => port.postMessage({ result: undefined }),
        () => port.postMessage({ error: 'source_storage' }),
      );
      return;
    }
    if (data.kind === 'primeSummary') {
      // Optional derived data is written only after the primary catalog transaction succeeds.
      void writeSummaryCache(data.profile, data.catalog, data.value, data.index)
        .then(() => port.postMessage({ result: undefined }), () => port.postMessage({ result: undefined }));
      return;
    }
    if (data.kind === 'catalogSearch') {
      const result = searchSourceTitleIndex(data.index, data.query);
      port.postMessage({ result }, [result.buffer as ArrayBuffer]); return;
    }
    let result: SourceJobResult;
    if (data.kind === "parse") result = parseSourceText(data.text);
    else if (data.kind === "validate") result = validateSourceStore(data.value);
    else if (data.kind === "layout") result = sourceEntryLayout(data.entries);
    else if (data.kind === 'index') result = buildSourceIndex(data.entries);
    else if (data.kind === "validateCatalog") {
      const source = validateSourceStore([data.value])[0];
      result = { source, layout: sourceEntryLayout(source.entries) };
    }
    else if (data.kind === 'measure') checkSourceStoreSize(data.sources);
    port.postMessage({ result });
  } catch (error) { port.postMessage({ error: error instanceof Error ? error.message : "source_processing" }); }
};
