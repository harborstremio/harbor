import assert from 'node:assert/strict';
import test from 'node:test';
import { groupSourceMatches, type SourceMatch, type SourceMatchPreview } from '../src/lib/games/source-groups.ts';
import { sourceMatchMetadata, sourceMatchSignature } from '../src/lib/games/source-match-preview.ts';

const source: SourceMatch['source'] = { id: 'one', name: 'Publisher', url: 'https://source.example/feed', format: 'community', enabled: true, checkedAt: 1, skipped: 0, entries: [] };
const base: SourceMatch['release'] = { id: 'newest', title: 'Project v1.0', kind: 'game', files: [{ name: 'Torrent', kind: 'magnet', url: `magnet:?xt=urn:btih:${'1'.repeat(40)}&tr=https%3A%2F%2Fone.example` }] };
async function preview(release: SourceMatch['release'], row: number): Promise<SourceMatchPreview> {
  return { source, match: 'title', release: sourceMatchMetadata(release), deferred: { rows: [row], signature: await sourceMatchSignature(release) } };
}

test('summaries keep no file arrays and own no source back-reference', () => {
  const release = sourceMatchMetadata(base);
  assert.equal('files' in release, false);
  assert.equal('source' in release, false);
  assert.equal(release.title, base.title);
  assert.notEqual(release, base);
});

test('deferred grouping preserves newest metadata and tracker-variant merge order without changing input', async () => {
  const first = await preview(base, 9), older = await preview({ ...base, id: 'older', files: [{ ...base.files[0], url: base.files[0].url.replace('one.example', 'two.example') }] }, 2);
  const grouped = groupSourceMatches([first, older])[0].matches;
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].release.id, 'newest');
  assert.deepEqual((grouped[0] as SourceMatchPreview).deferred.rows, [9, 2]);
  assert.deepEqual(first.deferred.rows, [9]);
  assert.deepEqual(older.deferred.rows, [2]);
});

test('strong grouping signatures distinguish exact file keys, sizes, checksums and editions', async () => {
  const page = { ...base, files: [{ name: 'Archive', kind: 'page' as const, url: 'https://host.example/file#secret-a' }] };
  const variants = [page, { ...page, platform: 'linux' }, { ...page, version: '2' }, { ...page, kind: 'patch' as const }, { ...page, size: '2 GB' },
    { ...page, files: [{ ...page.files[0], url: 'https://host.example/file#secret-b' }] },
    { ...page, files: [{ ...page.files[0], sizeBytes: 20 }] }, { ...page, files: [{ ...page.files[0], sha256: 'a'.repeat(64) }] }];
  const signatures = await Promise.all(variants.map(sourceMatchSignature));
  assert.equal(new Set(signatures).size, variants.length);
  for (const signature of signatures) assert.match(signature, /^[a-f0-9]{64}$/);
});

test('deferred and full grouping agree on duplicate counts and publisher separation', async () => {
  const entries = [base, { ...base, id: 'same' }, { ...base, id: 'linux', platform: 'linux' }];
  const full = entries.map(release => ({ source, release, match: 'title' as const }));
  full.push({ ...full[0], source: { ...source, id: 'two' } });
  const deferred = await Promise.all(full.map(async (item, row) => ({ ...await preview(item.release, row), source: item.source })));
  const describe = (groups: ReturnType<typeof groupSourceMatches>) => groups.map(g => [g.source.id, g.matches.map(m => m.release.id)]);
  assert.deepEqual(describe(groupSourceMatches(deferred)), describe(groupSourceMatches(full)));
});

test('large duplicate sets retain every physical row with linear accumulation', async () => {
  const item = await preview(base, 0), matches = Array.from({ length: 150_000 }, (_, row) => ({ ...item, deferred: { ...item.deferred, rows: [row] } }));
  const grouped = groupSourceMatches(matches);
  assert.equal(grouped[0].matches.length, 1);
  const rows = (grouped[0].matches[0] as SourceMatchPreview).deferred.rows;
  assert.equal(rows.length, 150_000); assert.equal(rows[149_999], 149_999);
  assert.deepEqual(item.deferred.rows, [0]);
});
