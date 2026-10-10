import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogSummaryCollector } from '../src/lib/games/source-catalog-summary.ts';
import { buildSourceIndex, sourceIndexCandidates } from '../src/lib/games/source-index.ts';
import { sourceEntryLayout, SOURCE_CHUNK_BYTES } from '../src/lib/games/source-store-format.ts';
import { recentSourceReleases } from '../src/lib/games/source-recent-selection.ts';
import { validateSourceStore } from '../src/lib/games/source-store-validation.ts';
import { sourceRecentPreview } from '../src/lib/games/source-recent-preview.ts';
import { SOURCE_MAX_ENTRIES, sourceMatch, type GameSource, type SourceRelease } from '../src/lib/games/sources.ts';

const now = Date.parse('2026-10-03T12:00:00Z');
const source: GameSource = { id: 'summary', name: 'Summary', url: 'https://catalog.example/source.json', format: 'harbor', entries: [], enabled: false, checkedAt: 1, skipped: 0 };
const entry = (i: number, extra: Partial<SourceRelease> = {}): SourceRelease => ({ id: `row-${i}`, title: `Project ${i}`, kind: 'game', date: new Date(now - (i % 45) * 1000).toISOString(), files: [{ name: 'Game.zip', url: `https://files.example/${i}.zip`, kind: 'direct' }], ...extra });

test('chunked summaries preserve exact layout, candidate index, recent ordering and future expiry', () => {
  const entries = Array.from({ length: 700 }, (_, i) => entry(i));
  entries[80] = entry(80, { title: 'Sengoku Rance Free Download [Build-123]' });
  entries[300] = entry(300, { title: 'Sengoku Rance', steamId: 42 });
  entries[401] = entry(401, { title: 'Renamed release', igdbId: 52, steamId: 42 });
  entries[500] = entry(500, { title: entries[10].title, date: entries[10].date });
  entries[600] = entry(600, { title: entries[10].title, date: new Date(now).toISOString() });
  entries[650] = entry(650, { date: new Date(now + 1000).toISOString() });
  entries[651] = entry(651, { date: new Date(now + 500).toISOString(), kind: 'patch' });
  entries[699] = entry(699, { title: 'Pokémon 日本™ v1.2', platform: 'linux' });
  const normalized = validateSourceStore([{ ...source, entries }])[0];
  const collector = catalogSummaryCollector(source, now);
  for (let start = 0; start < entries.length; start += 83) collector.add(entries.slice(start, start + 83));
  const { value, index } = collector.finish();
  assert.deepEqual(value.source, { ...normalized, entries: [] });
  assert.deepEqual(value.layout, sourceEntryLayout(normalized.entries));
  assert.equal(value.layout.bytes, Buffer.byteLength(JSON.stringify(normalized.entries)));
  assert.deepEqual(value.storedEnds, [83, 166, 249, 332, 415, 498, 581, 664, 700]);
  assert.deepEqual(index, buildSourceIndex(normalized.entries));
  assert.deepEqual(value.recent, recentSourceReleases([{ ...normalized, enabled: true }], now).map(item => sourceRecentPreview(item.release, normalized.entries.indexOf(item.release))));
  assert.equal(value.recentAt, now); assert.equal(value.recentUntil, now + 1000);
  for (const game of [{ name: 'Sengoku Rance' }, { name: 'Other', steamId: 42 }, { name: 'Other', igdbId: 52 }, { name: 'Pokémon' }]) {
    const found = sourceIndexCandidates(index, game).map(row => normalized.entries[row]).filter(item => sourceMatch(item, game));
    assert.deepEqual(found, normalized.entries.filter(item => sourceMatch(item, game)));
  }
});

test('layout crosses incoming chunk boundaries and measures normalized Unicode independently', () => {
  const entries = Array.from({ length: 14000 }, (_, i) => entry(i, { title: `  ${i} 日本${'界'.repeat(240)}  ` }));
  const normalized = validateSourceStore([{ ...source, entries }])[0].entries;
  const collector = catalogSummaryCollector(source, now);
  for (let start = 0; start < entries.length; start += 1300) collector.add(entries.slice(start, start + 1300));
  const { value } = collector.finish();
  assert.ok(value.layout.ends.length > 1);
  assert.deepEqual(value.layout, sourceEntryLayout(normalized));
  assert.equal(value.layout.bytes, Buffer.byteLength(JSON.stringify(normalized)));
  let start = 0;
  for (const end of value.layout.ends) {
    assert.ok(Buffer.byteLength(JSON.stringify(normalized.slice(start, end))) <= SOURCE_CHUNK_BYTES);
    if (end < normalized.length) assert.ok(Buffer.byteLength(JSON.stringify(normalized.slice(start, end + 1))) > SOURCE_CHUNK_BYTES);
    start = end;
  }
  assert.notDeepEqual(value.layout.ends, value.storedEnds);
});

test('invalid records and duplicate IDs in different chunks cannot produce a partial success', () => {
  for (const bad of [entry(1, { files: [] }), entry(1, { steamId: -1 }), entry(1, { title: '' })]) {
    assert.throws(() => catalogSummaryCollector(source, now).add([bad]));
  }
  const duplicate = catalogSummaryCollector(source, now);
  duplicate.add([entry(1)]);
  assert.throws(() => duplicate.add([entry(2), entry(1)]), /source_storage/);
  assert.throws(() => catalogSummaryCollector(source, now).add([entry(1), entry(1)]), /source_storage/);
  assert.throws(() => catalogSummaryCollector(source, now).add([]), /source_storage/);
  assert.throws(() => catalogSummaryCollector(source, now).add(new Array(SOURCE_MAX_ENTRIES + 1)), /source_storage/);
  assert.throws(() => catalogSummaryCollector(source, NaN), /source_storage/);
});

test('empty catalogs and undated/non-game entries retain truthful recent metadata', () => {
  const empty = catalogSummaryCollector(source, now).finish();
  assert.deepEqual(empty.value.layout, { bytes: 2, ends: [] });
  assert.deepEqual(empty.value.storedEnds, []);
  assert.deepEqual(empty.index, buildSourceIndex([]));
  assert.deepEqual(empty.value.recent, []);
  assert.equal(empty.value.recentUntil, Infinity);
  const collector = catalogSummaryCollector(source, now);
  collector.add([entry(0, { date: undefined }), entry(1, { kind: 'mod' }), entry(2, { date: '1970-01-01' })]);
  assert.deepEqual(collector.finish().value.recent, []);
});
