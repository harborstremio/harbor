import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSourceIndex, sourceIndexCandidates } from '../src/lib/games/source-index.ts';
import { createSummaryCache, restoreSummaryCache, SOURCE_SUMMARY_MAX_BYTES } from '../src/lib/games/source-summary-format.ts';
import { sourceEntryLayout, sourceStoreHeaders, type StoredCatalog, type ValidatedSource } from '../src/lib/games/source-store-format.ts';
import { validateSourceStore } from '../src/lib/games/source-store-validation.ts';
import type { GameSource } from '../src/lib/games/sources.ts';
import { sourceRecentPreview } from '../src/lib/games/source-recent-preview.ts';

function fixture(count = 3) {
  const source: GameSource = validateSourceStore([{ id: 'proof', name: 'Proof', url: 'https://example.org/feed.json', enabled: true, format: 'community', skipped: 0, checkedAt: 1, entries: Array.from({ length: count }, (_, i) => ({ id: String(i), title: `Project ${i} 界`, kind: 'game', files: [{ name: 'Archive.zip', url: `https://example.org/${i}.zip`, kind: 'archive' }] })) }])[0];
  const layout = sourceEntryLayout(source.entries);
  const catalog: StoredCatalog = { source: sourceStoreHeaders([source])[0], version: 'a3017ae2-6fbf-4aa8-809b-00403ecdbf45', parts: layout.ends.length };
  for (const entry of source.entries) entry.date = new Date(500).toISOString();
  const updatedLayout = sourceEntryLayout(source.entries);
  const value: ValidatedSource = { source: { ...source, entries: [] }, layout: updatedLayout, storedEnds: updatedLayout.ends, recent: source.entries.slice(0, 36).map(sourceRecentPreview), recentAt: 1000, recentUntil: 3000 };
  return { source, catalog, value, index: buildSourceIndex(source.entries) };
}

test('persisted summaries preserve compact candidate indexes, Unicode records and immutable input buffers', async () => {
  const { source, catalog, value, index } = fixture();
  const original = structuredClone(index), saved = await createSummaryCache('profile', catalog, value, index);
  const restored = await restoreSummaryCache(structuredClone(saved.item), 'profile', catalog, saved.bytes, 2000);
  assert.ok(restored); assert.deepEqual(restored.value, value); assert.deepEqual(restored.index, index); assert.deepEqual(index, original);
  for (const entry of source.entries) assert.deepEqual(sourceIndexCandidates(restored.index, { name: entry.title }), sourceIndexCandidates(original, { name: entry.title }));
  assert.ok(saved.bytes < SOURCE_SUMMARY_MAX_BYTES); assert.equal(restored.value.source.entries.length, 0);
});

test('summaries reject different profiles, versions, URLs, schemas and expired or rewound recent windows', async () => {
  const { catalog, value, index } = fixture(), saved = await createSummaryCache('profile', catalog, value, index);
  for (const [profile, cat, now] of [
    ['other', catalog, 2000], ['profile', { ...catalog, version: crypto.randomUUID() }, 2000],
    ['profile', { ...catalog, source: { ...catalog.source, url: 'https://other.example/feed' } }, 2000],
    ['profile', catalog, 999], ['profile', catalog, 3000], ['profile', catalog, NaN],
  ] as const) assert.equal(await restoreSummaryCache(saved.item, profile, cat, saved.bytes, now), undefined);
  // Schema 1 predates tracker-title normalization. Its valid old index can miss present releases.
  assert.equal(await restoreSummaryCache({ ...saved.item, schema: 1 }, 'profile', catalog, saved.bytes, 2000), undefined);
  // Schema 2 can include WebView-accepted malformed HTTP hostnames.
  assert.equal(await restoreSummaryCache({ ...saved.item, schema: 2 }, 'profile', catalog, saved.bytes, 2000), undefined);
  // Schema 3 can be read by binaries that do not support packed primary chunks.
  assert.equal(await restoreSummaryCache({ ...saved.item, schema: 3 }, 'profile', catalog, saved.bytes, 2000), undefined);
  // Schema 4 retained full releases; schema 5 requires immutable physical row references.
  assert.equal(await restoreSummaryCache({ ...saved.item, schema: 4 }, 'profile', catalog, saved.bytes, 2000), undefined);
  assert.equal(await restoreSummaryCache(saved.item, 'profile', catalog, saved.bytes + 1, 2000), undefined);
});

test('corrupt indexes, metadata, recent records and checksums cannot become accepted snapshots', async () => {
  const { catalog, value, index } = fixture(), saved = await createSummaryCache('profile', catalog, value, index);
  const mutations = [
    (v: typeof saved.item) => { v.index.keys[0] ^= 1; },
    (v: typeof saved.item) => { v.index.keys[0] = 0xffffffff; },
    (v: typeof saved.item) => { v.index.rows[0] = 99; },
    (v: typeof saved.item) => { v.index.rows.fill(0); },
    (v: typeof saved.item) => { v.recent[0].title = 'Different'; },
    (v: typeof saved.item) => { v.layout.bytes++; },
    (v: typeof saved.item) => { v.storedEnds[0]++; },
    (v: typeof saved.item) => { v.sha256 = '0'.repeat(64); },
  ];
  for (const change of mutations) { const item = structuredClone(saved.item); change(item); assert.equal(await restoreSummaryCache(item, 'profile', catalog, saved.bytes, 2000), undefined); }
});

test('empty and unbounded-time catalogs restore; large file mirrors no longer overflow derived summaries', async () => {
  const empty = fixture(0); empty.value.recentUntil = Infinity;
  const saved = await createSummaryCache('profile', empty.catalog, empty.value, empty.index);
  assert.ok(await restoreSummaryCache(saved.item, 'profile', empty.catalog, saved.bytes, Date.now()));
  const large = fixture(36);
  for (const release of large.source.entries) release.files = Array.from({ length: 64 }, (_, i) => ({ name: 'Archive', url: `https://example.org/${i}/${'a'.repeat(2000)}`, kind: 'page' as const }));
  large.value.layout = sourceEntryLayout(large.source.entries); large.value.storedEnds = large.value.layout.ends;
  assert.equal(validateSourceStore([large.source])[0].entries.length, 36);
  const packed = await createSummaryCache('profile', large.catalog, large.value, large.index);
  assert.ok(packed.bytes < 10000);
  assert.ok(await restoreSummaryCache(packed.item, 'profile', large.catalog, packed.bytes, 2000));
  assert.ok(large.value.layout.bytes > SOURCE_SUMMARY_MAX_BYTES);
  assert.ok(packed.item.recent.every(item => !('files' in item)));
  assert.equal(large.index.rows.length, 72);
});
