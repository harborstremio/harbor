import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageChannel } from 'node:worker_threads';
import { receiveSourceWork, SOURCE_TRANSFER_ENTRIES, type SourceWorkReply } from '../src/lib/games/source-work-transfer.ts';
import { sourceEntryLayout } from '../src/lib/games/source-store-format.ts';
import { sourceIndexCandidates } from '../src/lib/games/source-index.ts';
import { parseSourceText, type SourceRelease } from '../src/lib/games/sources.ts';
import { catalogSummaryCollector } from '../src/lib/games/source-catalog-summary.ts';

const text = JSON.stringify({ name: 'Catalog', downloads: Array.from({ length: 617 }, (_, i) => ({ title: i === 616 ? 'Final Game v1.0' : `Project ${i}`, uris: [`https://files.example/${i}.zip`] })) });
function transfer(task: 'parse' | 'layout' | 'index', input: SourceRelease[] = [], body = text) {
  const { port1, port2 } = new MessageChannel(); const entries: SourceRelease[] = []; let cursor = 0, largest = 0;
  return new Promise<{ reply: Extract<SourceWorkReply, { kind: 'complete' }>; entries: SourceRelease[]; largest: number }>((resolve, reject) => {
    const timer = setTimeout(() => { port1.close(); port2.close(); reject(Error('Timed out')); }, 5000);
    port1.on('message', (reply: SourceWorkReply) => {
      if (reply.kind === 'input') { const part = input.slice(cursor, cursor += SOURCE_TRANSFER_ENTRIES); port1.postMessage(part.length ? { kind: 'input', entries: part } : { kind: 'finish' }); }
      else if (reply.kind === 'entries') { entries.push(...reply.entries); largest = Math.max(largest, reply.entries.length); port1.postMessage({ kind: 'output' }); }
      else { clearTimeout(timer); port1.close(); port2.close(); if (reply.kind === 'error') reject(Error(reply.error)); else resolve({ reply, entries, largest }); }
    });
    receiveSourceWork({ kind: 'sourceWorkTransfer', task, text: body, port: port2 as unknown as MessagePort });
  });
}
test('parse transfers exact releases in acknowledged batches and warms an index including the last row', async () => {
  const parsed = parseSourceText(text), result = await transfer('parse');
  assert.deepEqual(result.entries, parsed.entries); assert.equal(result.largest, 256);
  assert.equal(result.reply.manifest?.name, parsed.name);
  assert.deepEqual(sourceIndexCandidates(result.reply.index!, { name: 'Final Game' }), [616]);
});
test('layout and indexing consume all input batches without returning a duplicate release catalog', async () => {
  const entries = parseSourceText(text).entries;
  const measured = await transfer('layout', entries), indexed = await transfer('index', entries);
  assert.deepEqual(measured.reply.layout, sourceEntryLayout(entries)); assert.deepEqual(measured.entries, []);
  assert.equal(measured.reply.index, undefined); assert.deepEqual(indexed.entries, []);
  assert.deepEqual(sourceIndexCandidates(indexed.reply.index!, { name: 'Final Game' }), [616]);
});

test('prepared parse summaries equal independent stored-catalog validation, including future dates and editions', async () => {
  const now = Date.now(), date = (offset: number) => new Date(now + offset).toISOString();
  const records = Array.from({ length: 400 }, (_, i) => ({ title: `日本 Game ${i} v1.0`, uploadDate: date(-i * 1000 - 1000), uris: [`https://files.example/${i}.zip`] }));
  records.push({ title: 'Future Game', uploadDate: date(86400000), uris: ['https://files.example/future.zip'] });
  const community = JSON.stringify({ name: 'Prepared', downloads: records });
  const harbor = JSON.stringify({ schema: 'harbor.games.sources.v1', name: 'Prepared', items: records.map((r, i) => ({ id: `entry-${i}`, title: r.title, date: r.uploadDate, game: { platform: i % 2 ? 'Windows' : 'Linux', steamId: i + 1 }, kind: i % 7 ? 'game' : 'patch', files: r.uris.map(url => ({ url, kind: 'direct' })) })) });
  for (const body of [community, harbor, JSON.stringify({ name: 'Empty', downloads: [] })]) {
    const result = await transfer('parse', [], body), summary = result.reply.summary!;
    const source = { ...parseSourceText(body), id: 'original', url: 'https://source.example/catalog.json', enabled: false, checkedAt: now };
    const independent = catalogSummaryCollector(source, summary.recentAt);
    let start = 0;
    for (const end of summary.layout.ends) { independent.add(source.entries.slice(start, end)); start = end; }
    const expected = independent.finish();
    assert.deepEqual(summary.layout, expected.value.layout);
    assert.deepEqual(summary.recent, expected.value.recent);
    assert.equal(summary.recentUntil, expected.value.recentUntil);
    assert.deepEqual(result.reply.index, expected.index);
    assert.equal(summary.recent.length, Math.min(36, source.entries.length));
  }
});
