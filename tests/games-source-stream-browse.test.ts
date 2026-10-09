import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogBrowseCollector } from '../src/lib/games/source-catalog-browse.ts';
import { buildSourceTitleIndex, searchSourceTitleIndex } from '../src/lib/games/source-title-index.ts';
import { sourceEntryLayout } from '../src/lib/games/source-store-format.ts';
import { validateSourceStore } from '../src/lib/games/source-store-validation.ts';
import type { GameSource, SourceRelease } from '../src/lib/games/sources.ts';

const entry = (n: number): SourceRelease => ({ id: `release-${n}`, title: `Project ${n} ${n % 3 ? '世界' : 'Simulator'}`, kind: 'game', files: [{ name: 'Archive.zip', kind: 'direct', url: `https://files.example/${n}.zip` }] });
const source: GameSource = { id: 'source', name: 'Catalog', url: 'https://source.example/catalog.json', format: 'community', checkedAt: 12, enabled: true, skipped: 0, entries: [] };

test('chunked browse matches full normalization, ordering, rows, title search and selected layout', () => {
  const raw = Array.from({ length: 503 }, (_, n) => entry(n));
  const full = validateSourceStore([{ ...source, entries: raw }])[0];
  for (const [query, limit] of [[' SIMULATOR ', 7], ['世界', 30], ['', 0], ['', 503], ['absent', 50]] as const) {
    const collector = catalogBrowseCollector(source, query, limit);
    collector.add(raw.slice(0, 211)); collector.add(raw.slice(211, 399)); collector.add(raw.slice(399));
    const result = collector.finish(), needle = query.trim().toLocaleLowerCase();
    const matches = full.entries.filter(e => e.title.toLocaleLowerCase().includes(needle));
    assert.deepEqual(result.source, { ...full, entries: matches.slice(0, limit) });
    assert.equal(result.total, matches.length);
    assert.deepEqual(result.layout, sourceEntryLayout(matches.slice(0, limit)));
    assert.deepEqual(result.storedEnds, [211, 399, 503]);
    assert.deepEqual(result.browseTitles, buildSourceTitleIndex(full.entries));
    assert.deepEqual(result.browseRows, searchSourceTitleIndex(result.browseTitles!, query));
  }
});

test('later invalid and duplicate records reject rather than certify partial search results', () => {
  for (const invalid of [{ ...entry(4), title: '' }, { ...entry(4), files: [] }, { ...entry(4), steamId: -1 }, { ...entry(4), id: ' release-1 ' }]) {
    const collector = catalogBrowseCollector(source, 'Project', 1);
    collector.add([entry(1), entry(2)]);
    assert.throws(() => collector.add([entry(3), invalid]));
  }
  assert.throws(() => catalogBrowseCollector(source, '', 30).add([entry(1), entry(1)]));
});

test('empty catalogs and zero-limit count queries retain truthful rows without selected releases', () => {
  const empty = catalogBrowseCollector(source, '', 30).finish();
  assert.equal(empty.total, 0); assert.deepEqual(empty.storedEnds, []); assert.deepEqual(empty.source.entries, []);
  const counter = catalogBrowseCollector(source, '', 0); counter.add([entry(0), entry(1)]);
  const result = counter.finish(); assert.equal(result.total, 2); assert.deepEqual(result.source.entries, []); assert.deepEqual([...result.browseRows!], [0, 1]);
});

test('query, header and stored chunk boundaries are checked before a successful result', () => {
  for (const limit of [-1, 1.2, 150001, Infinity]) assert.throws(() => catalogBrowseCollector(source, '', limit));
  assert.throws(() => catalogBrowseCollector(source, 'x'.repeat(501), 30));
  assert.throws(() => catalogBrowseCollector({ ...source, id: '../bad' }, '', 30));
  assert.throws(() => catalogBrowseCollector(source, '', 30).add([]));
  const oversized = Array.from({ length: 18000 }, (_, n) => ({ ...entry(n), title: 'x'.repeat(480) }));
  assert.throws(() => catalogBrowseCollector(source, '', 30).add(oversized), /source_limit/);
});

test('a title index over budget falls back without losing sparse matches across chunks', () => {
  const collector = catalogBrowseCollector(source, 'needle', 1);
  for (let chunk = 0; chunk < 12; chunk++) {
    collector.add(Array.from({ length: 3000 }, (_, n) => ({ ...entry(chunk * 3000 + n), title: `${chunk === 11 && n === 2999 ? 'needle' : 'other'} ${'界'.repeat(240)}` })));
  }
  const result = collector.finish(); assert.equal(result.browseTitles, undefined); assert.equal(result.total, 1);
  assert.equal(result.source.entries[0].id, 'release-35999'); assert.deepEqual([...result.browseRows!], [35999]);
});
