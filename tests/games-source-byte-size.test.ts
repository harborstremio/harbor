import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceByteSize } from '../src/lib/games/source-byte-size.ts';
import { parseSourceText, SOURCE_MAX_BYTES } from '../src/lib/games/sources.ts';

function check(value: string) {
  const expected = Buffer.byteLength(value, 'utf8');
  assert.equal(sourceByteSize(value), expected);
  for (const limit of [0, 1, 10, 65535, 65536, expected - 1, expected, expected + 1].filter(value => value >= 0)) {
    assert.equal(sourceByteSize(value, limit), Math.min(expected, limit + 1));
  }
}

test('source sizes retain exact Unicode and buffer-boundary limits', () => {
  for (const value of ['', 'plain\0text', '日本語 العربية 🎮', '\ud800', '\udfff', '\ud800x\udfff', 'x'.repeat(16383) + '🎮', 'x'.repeat(65535) + '🎮', '界'.repeat(100000), '🎮'.repeat(100000)]) check(value);
  let state = 7;
  for (let attempt = 0; attempt < 120; attempt++) {
    const values = Array.from({ length: 500 }, () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state & 0xffff; });
    check(String.fromCharCode(...values));
  }
});

test('source size checks reuse bounded storage instead of encoding whole inputs', () => {
  const original = TextEncoder.prototype.encodeInto, lengths: number[] = [], inputs: number[] = [];
  TextEncoder.prototype.encodeInto = function(value, destination) { lengths.push(destination.byteLength); inputs.push(value.length); return original.call(this, value, destination); };
  try {
    const value = '🎮'.repeat(1000000); assert.equal(sourceByteSize(value), 4000000);
    assert.ok(lengths.length > 1); assert.ok(lengths.every(size => size === 64 * 1024));
    assert.ok(inputs.every(size => size <= 16 * 1024));
    lengths.length = 0; assert.equal(sourceByteSize(value, 100), 101); assert.equal(lengths.length, 0);
  } finally { TextEncoder.prototype.encodeInto = original; }
});

test('older WebView fallback counts paired and unpaired surrogates without encoding', () => {
  const original = Object.getOwnPropertyDescriptor(TextEncoder.prototype, 'encodeInto')!;
  Object.defineProperty(TextEncoder.prototype, 'encodeInto', { ...original, value: undefined });
  try { for (const value of ['日本🎮\ud800\udfff\ud800', 'x'.repeat(65535) + '\udfff', '界'.repeat(40000)]) check(value); }
  finally { Object.defineProperty(TextEncoder.prototype, 'encodeInto', original); }
});

test('catalog parser keeps the exact UTF-8 input cap', () => {
  // Valid empty feed padded to exactly the limit; over-limit rejection precedes JSON parsing.
  const body = JSON.stringify({ name: '日本🎮', downloads: [] });
  const exact = body + ' '.repeat(SOURCE_MAX_BYTES - Buffer.byteLength(body));
  assert.equal(parseSourceText(exact).entries.length, 0);
  assert.throws(() => parseSourceText(exact + ' '), /source_limit/);
});
