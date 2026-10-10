import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeSourceChunk, encodeSourceChunk, sourceChunkCount } from '../src/lib/games/source-chunk.ts';
import { SOURCE_CHUNK_BYTES } from '../src/lib/games/source-store-format.ts';
import { SOURCE_MAX_ENTRIES, type SourceRelease } from '../src/lib/games/sources.ts';

const entries = (count: number): SourceRelease[] => Array.from({ length: count }, (_, index) => ({ id: String(index), title: `日本 🎮 Game ${index} \ud800`, kind: 'game', files: [{ name: 'Game.zip', kind: 'archive', url: `https://example.org/${index}.zip?key=literal%2Bvalue#part` }] }));

test('packed chunks retain every Unicode record and exact selected page-boundary rows', () => {
  const original = entries(777), before = structuredClone(original), packed = encodeSourceChunk(original);
  assert.equal(sourceChunkCount(packed), 777);
  assert.equal(packed.ends.length, 4);
  assert.equal(packed.data.byteLength, new TextEncoder().encode(JSON.stringify(original)).byteLength + 3);
  assert.deepEqual(decodeSourceChunk(packed), original);
  const rows = [0, 255, 256, 511, 512, 776];
  assert.deepEqual(decodeSourceChunk(packed, rows), rows.map(row => original[row]));
  assert.deepEqual(decodeSourceChunk(packed, []), []);
  assert.deepEqual(original, before);
});

test('legacy object chunks remain readable without rewriting or changing exact selected records', () => {
  const original = entries(5);
  assert.equal(sourceChunkCount(original), 5);
  assert.equal(decodeSourceChunk(original), original);
  assert.deepEqual(decodeSourceChunk(original, [1, 4]), [original[1], original[4]]);
  assert.deepEqual(decodeSourceChunk([], []), []);
});

test('selective reads do not parse unrelated pages; full reads still detect their corruption', () => {
  const original = entries(600), packed = encodeSourceChunk(original);
  packed.data[0] = 0xff;
  assert.deepEqual(decodeSourceChunk(packed, [256, 599]), [original[256], original[599]]);
  assert.throws(() => decodeSourceChunk(packed, [0]), /source_storage/);
  assert.throws(() => decodeSourceChunk(packed), /source_storage/);
});

test('unknown encodings, bad bounds, offsets, counts and oversized backing allocations reject', () => {
  const packed = encodeSourceChunk(entries(600));
  const cases = [
    null, {}, { ...packed, encoding: 'future' }, { ...packed, version: 2 },
    { ...packed, count: 0 }, { ...packed, count: SOURCE_MAX_ENTRIES + 1 },
    { ...packed, ends: Array.from(packed.ends) }, { ...packed, data: Array.from(packed.data) },
    { ...packed, ends: new Uint32Array([10, 10, packed.data.byteLength]) },
    { ...packed, ends: new Uint32Array([10, 20, packed.data.byteLength - 1]) },
    { ...packed, ends: new Uint32Array([packed.data.byteLength]) },
    { ...packed, data: new Uint8Array(new ArrayBuffer(SOURCE_CHUNK_BYTES + 1024), 0, packed.data.byteLength) },
    { ...packed, data: packed.data.subarray(1) },
  ];
  for (const value of cases) assert.throws(() => decodeSourceChunk(value), /source_storage/);
  assert.throws(() => decodeSourceChunk({ ...packed, count: 599 }), /source_storage/);
  const shifted = structuredClone(packed); shifted.ends[0]--;
  assert.throws(() => decodeSourceChunk(shifted), /source_storage/);
});

test('invalid selected rows reject equally for legacy and packed representations', () => {
  const original = entries(4), packed = encodeSourceChunk(original);
  for (const value of [original, packed]) for (const rows of [[-1], [4], [NaN], [0.5], [2, 1], [1, 1]]) assert.throws(() => decodeSourceChunk(value, rows), /source_storage/);
});

test('the normalized 8 MiB boundary and entry bound remain exact', () => {
  const value = entries(1);
  value[0].title = '';
  const overhead = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  value[0].title = 'x'.repeat(SOURCE_CHUNK_BYTES - overhead);
  const packed = encodeSourceChunk(value);
  assert.equal(packed.data.byteLength, SOURCE_CHUNK_BYTES);
  assert.equal(decodeSourceChunk(packed)[0].title.length, value[0].title.length);
  value[0].title += 'x'; assert.throws(() => encodeSourceChunk(value), /source_limit/);
  assert.throws(() => encodeSourceChunk([]), /source_storage/);
  assert.throws(() => encodeSourceChunk(new Array(SOURCE_MAX_ENTRIES + 1)), /source_storage/);
});
