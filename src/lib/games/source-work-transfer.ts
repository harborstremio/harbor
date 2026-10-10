import { parseSourceText, SOURCE_MAX_ENTRIES, type GameSource, type SourceManifest, type SourceRelease } from './sources';
import { sourceEntryLayout, type SourceEntryLayout } from './source-store-format';
import { buildSourceIndex, type SourceIndex } from './source-index';
import { collectRecent, RECENT_SOURCE_LIMIT, type RecentSourceRelease } from './source-recent-selection';
import type { ParsedSourceSummary } from './source-parsed-summary';
import { sourceRecentPreview } from './source-recent-preview';

export const SOURCE_TRANSFER_ENTRIES = 256;
export type SourceWorkTransfer = { kind: 'sourceWorkTransfer'; task: 'parse' | 'layout' | 'index'; text?: string; port: MessagePort };
export type SourceWorkReply = { kind: 'input' } | { kind: 'entries'; entries: SourceRelease[] } | { kind: 'complete'; manifest?: Omit<SourceManifest, 'entries'>; layout?: SourceEntryLayout; index?: SourceIndex; summary?: ParsedSourceSummary } | { kind: 'error'; error: string };

function parsedSummary(manifest: SourceManifest): ParsedSourceSummary {
  const now = Date.now(), recent: RecentSourceRelease[] = [];
  // Publication ranking depends only on the entries. Real source identity is bound after commit.
  const source: GameSource = { ...manifest, id: 'parsed', url: 'https://catalog.invalid/', enabled: true, checkedAt: now };
  for (const _ of collectRecent([source], now, RECENT_SOURCE_LIMIT, recent)) { /* worker-side scan */ }
  let recentUntil = Infinity;
  const recentRows = new Map(recent.map(item => [item.release.id, 0]));
  for (const [row, entry] of manifest.entries.entries()) {
    if (recentRows.has(entry.id)) recentRows.set(entry.id, row);
    const at = Date.parse(entry.date ?? '');
    if (entry.kind === 'game' && at > now) recentUntil = Math.min(recentUntil, at);
  }
  return { layout: sourceEntryLayout(manifest.entries), recent: recent.map(item => sourceRecentPreview(item.release, recentRows.get(item.release.id)!)), recentAt: now, recentUntil };
}

/** Acknowledged batches bound main-thread cloning; only the worker holds parsing intermediates. */
export function receiveSourceWork({ task, text, port }: SourceWorkTransfer) {
  let parts: SourceRelease[][] = [], entries: SourceRelease[] = [], manifest: SourceManifest | undefined, cursor = 0, count = 0;
  const close = () => { parts = []; entries = []; manifest = undefined; port.onmessage = null; port.onmessageerror = null; port.close(); };
  const send = (reply: SourceWorkReply, transfer: Transferable[] = []) => port.postMessage(reply, transfer);
  const fail = (error: unknown) => { try { send({ kind: 'error', error: error instanceof Error ? error.message : 'source_processing' }); } finally { close(); } };
  const complete = () => {
    const index = task === 'layout' ? undefined : buildSourceIndex(entries);
    const { entries: _, ...header } = manifest ?? { entries: [] };
    send({ kind: 'complete', manifest: manifest ? header as Omit<SourceManifest, 'entries'> : undefined, layout: task === 'layout' ? sourceEntryLayout(entries) : undefined, index, summary: manifest ? parsedSummary(manifest) : undefined }, index ? [index.keys.buffer as ArrayBuffer, index.rows.buffer as ArrayBuffer] : []);
    close();
  };
  const output = () => {
    if (cursor >= entries.length) { complete(); return; }
    const start = cursor; cursor += SOURCE_TRANSFER_ENTRIES;
    send({ kind: 'entries', entries: entries.slice(start, cursor) });
  };
  port.onmessageerror = () => fail(Error('source_processing'));
  port.onmessage = ({ data }: MessageEvent<{ kind: 'input'; entries: SourceRelease[] } | { kind: 'finish' | 'output' }>) => {
    try {
      if (task === 'parse' && data.kind === 'output') output();
      else if (task !== 'parse' && data.kind === 'input') {
        if (!Array.isArray(data.entries) || data.entries.length > SOURCE_TRANSFER_ENTRIES || (count += data.entries.length) > SOURCE_MAX_ENTRIES) throw Error('source_processing');
        parts.push(data.entries); send({ kind: 'input' });
      } else if (task !== 'parse' && data.kind === 'finish') { entries = parts.flat(); parts = []; complete(); }
      else throw Error('source_processing');
    } catch (error) { fail(error); }
  };
  try {
    if (task === 'parse') { manifest = parseSourceText(text ?? ''); entries = manifest.entries; output(); }
    else send({ kind: 'input' });
  } catch (error) { fail(error); }
}
