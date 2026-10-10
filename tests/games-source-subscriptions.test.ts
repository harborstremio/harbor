import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceGameSource } from '../src/lib/games/source-subscriptions.ts';
import { parseSourceManifest, type GameSource } from '../src/lib/games/sources.ts';

const manifest = (name: string) => parseSourceManifest({ schema: 'harbor.games.sources.v1', name, items: [{ id: 'release', title: name, files: [{ url: 'https://files.example/game.zip' }] }] });
const saved = (id: string): GameSource => ({ ...manifest('Old '+id), id, url: `https://${id}.example/catalog.json`, checkedAt: 10, enabled: true });

test('replacement retains subscription identity, ordering and latest enabled choice without carrying obsolete adapter/error metadata', () => {
  const original = { ...saved('one'), format: 'website' as const, website: { kind: 'wordpress' as const, site: 'https://one.example/', api: 'https://one.example/wp-json/' }, error: 'games.sources.source_network' };
  const other = saved('two'), nextManifest = manifest('New catalog');
  const changed = replaceGameSource([{ ...original, enabled: false }, other], original, 'https://new.example/catalog.json#ignored', nextManifest, 20);
  assert.deepEqual(changed[0], { ...nextManifest, id: original.id, url: 'https://new.example/catalog.json', enabled: false, checkedAt: 20 });
  assert.equal(changed[1], other); assert.equal(original.entries[0].title, 'Old one'); assert.ok(original.website);
});

test('same-address repair and JSON-to-website changes retain validated replacement metadata', () => {
  const original = saved('one'), website = { kind: 'wordpress' as const, site: 'https://one.example/', api: 'https://one.example/wp-json/' };
  const replacement = { ...manifest('Published website'), format: 'website' as const, website };
  const result = replaceGameSource([original], original, original.url, replacement, 20)[0];
  assert.equal(result.website, website); assert.equal(result.url, original.url); assert.equal(result.entries, replacement.entries);
});

test('removed, refreshed or replaced subscriptions cannot be resurrected or overwritten by an older review', () => {
  const original = saved('one'), replacement = manifest('New');
  for (const list of [[], [{ ...original, checkedAt: 11 }], [{ ...original, url: 'https://new.example/catalog.json' }], [{ ...original, entries: [...original.entries] }]]) {
    assert.throws(() => replaceGameSource(list, original, original.url, replacement), /source_changed/);
  }
});

test('replacement rechecks duplicate URLs and rejects unusable addresses before changing subscriptions', () => {
  const original = saved('one'), other = saved('two'), replacement = manifest('New');
  assert.throws(() => replaceGameSource([original, other], original, other.url+'#fragment', replacement), /source_duplicate/);
  for(const url of ['javascript:alert(1)', 'file:///game.json', 'https://name:secret@example.org/catalog.json']) assert.throws(() => replaceGameSource([original], original, url, replacement), /source_url/);
  assert.equal(original.entries[0].title, 'Old one');
});
