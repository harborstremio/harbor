import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSourceManifest, SOURCE_SCHEMA, SOURCE_MAX_ENTRIES } from '../src/lib/games/sources.ts';
import { validateSourceStore } from '../src/lib/games/source-store-validation.ts';

const file = { name: 'Game.zip', url: 'https://files.example/game.zip#key', kind: 'direct' };
const entry = { id: 'one', title: 'Pokémon™', kind: 'game', files: [file] };
const header = { id: 'catalog', url: 'https://catalog.example/feed', name: 'Catalog', checkedAt: 1, enabled: true, format: 'community', skipped: 3 };
const load = (entries: unknown[]) => validateSourceStore([{ ...header, entries }])[0];

test('stored identity and size stay authoritative over nested manifest or community fields', () => {
  const result = load([{ ...entry, steamId: 7, igdbId: 8, platform: 'linux', size: '12 MB',
    game: { steamId: 99, platform: 'windows' }, fileSize: 'wrong', uploadDate: '2026-01-01', uris: ['https://other.example/'] }]);
  assert.equal(result.format, 'community'); assert.equal(result.skipped, 3);
  assert.deepEqual(result.entries[0], { ...entry, sourcePage: undefined, steamId: 7, igdbId: 8,
    platform: 'linux', version: undefined, date: undefined, size: '12 MB',
    files: [{ ...file, sizeBytes: undefined, sha256: undefined }] });
  const withoutIdentity = load([{ ...entry, game: { steamId: 99 }, fileSize: 'wrong' }]).entries[0];
  assert.equal(withoutIdentity.steamId, undefined); assert.equal(withoutIdentity.size, undefined);
  assert.throws(() => load([{ ...entry, steamId: -1, game: { steamId: 7 } }]));
});

test('stored Unicode, optional fields, mirrors and magnets preserve previous normalized bytes', () => {
  const magnet = 'magnet:?xt=urn:btih:' + '1'.repeat(40);
  const entries = Array.from({ length: 160 }, (_, i) => ({ ...entry, id: `record-${i}`, title: `  日本\u0001 ${i} v1.2  `,
    steamId: i % 3 ? undefined : i + 1, igdbId: i % 4 ? undefined : i + 2,
    platform: i % 2 ? ' Windows ' : undefined, size: i % 5 ? undefined : ' 12 MB ',
    kind: ['game', 'patch', 'mod', 'extra'][i % 4], version: ' v1.2 ',
    date: i % 2 ? 'invalid' : '2026-01-01', sourcePage: 'https://catalog.example/game#section',
    files: i % 2 ? [file, file, { ...file, url: 'javascript:bad' }] : [
      { name: '', url: magnet + '&tr=https%3A%2F%2Fa.example%2Fannounce', kind: 'magnet' },
      { name: 'Other', url: magnet + '&tr=https%3A%2F%2Fb.example%2Fannounce', kind: 'magnet' },
      { ...file, sha256: 'A'.repeat(64), sizeBytes: 12 },
    ] }));
  const oldManifest = parseSourceManifest({ schema: SOURCE_SCHEMA, name: header.name,
    items: entries.map(item => ({ ...item, fileSize: item.size, game: { steamId: item.steamId, igdbId: item.igdbId, platform: item.platform } })) });
  assert.equal(JSON.stringify(load(entries).entries), JSON.stringify(oldManifest.entries));
  assert.equal(load(entries).entries[0].files.length, 2);
  assert.equal(load(entries).entries[0].files[1].sha256, 'a'.repeat(64));
  assert.equal(load(entries).entries[1].files[0].url, file.url);
});

test('corrupt stored entries cannot become a partial successful catalog', () => {
  for (const bad of [null, 1, [], { ...entry, title: '' }, { ...entry, id: '' },
    { ...entry, igdbId: '8' }, { ...entry, files: [] },
    { ...entry, files: [{ ...file, url: 'https://bad%20hostname/game' }] },
    { ...entry, files: [{ ...file, sizeBytes: -1 }] }, { ...entry, files: [{ ...file, sha256: 'invalid' }] },
    { ...entry, files: new Array(65).fill(file) }]) {
    assert.throws(() => load([bad]));
    assert.throws(() => load([{ ...entry, id: 'healthy' }, bad]));
  }
  assert.throws(() => load([entry, entry]), /source_storage/);
  assert.throws(() => load(new Array(SOURCE_MAX_ENTRIES + 1)), /source_limit/);
  assert.throws(() => validateSourceStore([{ ...header, entries: undefined }]), /source_format/);
});

test('stored source headers retain URL, website, timestamp and duplicate protections', () => {
  for (const bad of [{ url: 'file:///catalog.json' }, { checkedAt: NaN }, { id: '../catalog' },
    { name: '' }, { format: 'website' },
    { format: 'website', website: { kind: 'wordpress', api: 'https://catalog.example/api', site: 'https://other.example/' } }]) {
    assert.throws(() => validateSourceStore([{ ...header, ...bad, entries: [entry] }]));
  }
  assert.throws(() => validateSourceStore([{ ...header, entries: [] }, { ...header, id: 'another', entries: [] }]), /source_storage/);
  const original = { ...header, entries: [structuredClone(entry)] };
  const expected = structuredClone(original);
  validateSourceStore([original]); assert.deepEqual(original, expected);
});
