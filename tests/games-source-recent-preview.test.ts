import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceRecentPreview, validateRecentPreviews } from '../src/lib/games/source-recent-preview.ts';
import { hydrateRecentPages } from '../src/lib/games/source-recent-hydration.ts';
import type { GameSource, SourceRelease } from '../src/lib/games/sources.ts';
const now = Date.parse('2026-10-04T12:00:00Z'), filters = { query: '', sort: 'newest' as const, since: 0, now };
const entry = (id: string, time = now): SourceRelease => ({ id, title: id, date: new Date(time).toISOString(), kind: 'game', files: [{ name: 'Game.zip', url: `https://example.org/${id}.zip#key`, kind: 'direct' }] });
const source = (id: string, entries: SourceRelease[]): GameSource => ({ id, name: id, url: `https://example.org/${id}`, enabled: true, format: 'harbor', skipped: 0, checkedAt: 1, entries });

test('recent previews retain ranking identity without mirrors, arbitrary properties or nested references', () => {
  const full = { ...entry('game'), files: Array.from({length:64}, () => ({name:'mirror',kind:'page' as const,url:'https://example.org/'+'x'.repeat(8000)})), source: { entries: [] } };
  const preview = sourceRecentPreview(full, 4), actual = validateRecentPreviews([{ ...preview, files: full.files, source: full.source }], 10, now, 36)[0];
  assert.deepEqual(actual, preview); assert.ok(!('files' in actual)); assert.ok(!('source' in actual));
  assert.ok(JSON.stringify(actual).length < 200); assert.equal(full.files.length, 64);
});

test('invalid, duplicate, oversized, future and non-game preview metadata is rejected', () => {
  const valid = sourceRecentPreview(entry('game'), 0);
  for (const patch of [{ row: -1 }, { row: 1.5 }, { row: 10 }, { id: '' }, { id: 'x'.repeat(201) },
    { title: 'x'.repeat(501) }, { title: 'bad\ntext' }, { steamId: -1 }, { igdbId: '5' },
    { platform: 'x'.repeat(101) }, { date: 'invalid' }, { date: new Date(now + 1).toISOString() }, { kind: 'patch' }]) {
    assert.throws(() => validateRecentPreviews([{...valid,...patch}], 10, now, 36), /source_cache/);
  }
  assert.throws(() => validateRecentPreviews([valid, valid], 10, now, 36));
  assert.throws(() => validateRecentPreviews([valid, {...valid,row:1}], 10, now, 36));
  assert.throws(() => validateRecentPreviews([valid], 10, now, 0));
});

test('stale ranking metadata backfills healthy releases, preserving keyed files and source identity', async () => {
  const bad = source('bad', [entry('changed')]), good = source('good', [entry('one',now-1),entry('two',now-2)]), failures: string[] = [];
  const result = await hydrateRecentPages([
    { source: bad, entries: [sourceRecentPreview(entry('original'), 0)], total: 1 },
    { source: good, entries: good.entries.map(sourceRecentPreview), total: 2 },
  ],filters,2,new AbortController().signal,s => failures.push(s.id));
  assert.deepEqual(failures,['bad']); assert.deepEqual(result.entries.map(item=>item.release.id),['one','two']);
  assert.equal(result.entries[0].source,good); assert.equal(result.entries[0].release,good.entries[0]); assert.equal(result.hasMore,false);
});

test('cancellation during failure reporting rejects instead of returning partial success', async () => {
  const controller = new AbortController(), bad = source('bad', []);
  await assert.rejects(hydrateRecentPages([{source:bad,entries:[sourceRecentPreview(entry('missing'),0)],total:1}],filters,1,controller.signal,()=>controller.abort()),{name:'AbortError'});
});
